import { config } from "dotenv";

config({ path: ".env.test" });
config({ path: ".env.local" });

/** จำนวนวันในรอบ e2e — สอดคล้อง performance gate (~7 วัน) */
const E2E_CYCLE_DAYS = 7;
/** วันที่ seed assignment — ครบ 7 วัน แล้วเว้น 1 เซลล์สำหรับ e2e ลงวันหยุด */
const E2E_ASSIGNMENT_DAYS = E2E_CYCLE_DAYS;

/** เลื่อน YYYY-MM-DD ไปเดือนถัดไป */
function shiftDateByOneMonth(localDate: string): string {
  const [yearText, monthText, dayText] = localDate.split("-");
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)));
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

/** เพิ่มวันจาก YYYY-MM-DD */
function addDays(localDate: string, days: number): string {
  const [yearText, monthText, dayText] = localDate.split("-");
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const { prisma } = await import("../src/lib/prisma");
  const { loadCanvasDraftSnapshot } = await import("../src/lib/scheduling/load-canvas-draft");
  const { buildIntervalForShift } = await import("../src/lib/scheduling/apply-canvas-changes");

  const org = await prisma.organization.findFirst({ where: { slug: "demo-lab" } });
  const editingDraft = await prisma.scheduleDraft.findFirst({
    where: { organizationId: org?.id, status: "EDITING" },
    orderBy: { updatedAt: "desc" },
  });
  const published = await prisma.scheduleVersion.findFirst({
    where: {
      organizationId: org?.id,
      status: { in: ["PUBLISHED", "LOCKED"] },
    },
    orderBy: { publishedAt: "desc" },
    include: { assignments: true },
  });

  if (!org || !editingDraft || !published || published.assignments.length === 0) {
    throw new Error("missing e2e canvas seed prerequisites");
  }

  const snapshot = await loadCanvasDraftSnapshot(prisma, {
    organizationId: org.id,
    cycleId: editingDraft.scheduleCycleId,
  });
  if (!snapshot) {
    throw new Error("missing september canvas snapshot");
  }

  const periodStart = snapshot.periodStart;
  const e2ePeriodEnd = addDays(periodStart, E2E_ASSIGNMENT_DAYS - 1);
  const shiftById = new Map(snapshot.shiftCodes.map((code) => [code.id, code]));

  const copiedRows = published.assignments
    .map((row) => {
      if (!row.shiftCodeId) {
        return null;
      }
      const localDateText = shiftDateByOneMonth(row.localDate.toISOString().slice(0, 10));
      const shiftCode = shiftById.get(row.shiftCodeId);
      if (!shiftCode) {
        return null;
      }

      const interval = buildIntervalForShift(shiftCode, localDateText, snapshot.timezone);
      return {
        organizationId: org.id,
        scheduleVersionId: snapshot.draftVersionId,
        staffProfileId: row.staffProfileId,
        shiftCodeId: row.shiftCodeId,
        localDateText,
        startsAt: interval.startsAt,
        endsAt: interval.endsAt,
        plannedOtHours: row.plannedOtHours,
      };
    })
    .filter(
      (row): row is NonNullable<typeof row> =>
        row !== null && row.localDateText >= periodStart && row.localDateText <= e2ePeriodEnd,
    );

  await prisma.assignment.deleteMany({
    where: {
      organizationId: org.id,
      scheduleVersionId: snapshot.draftVersionId,
    },
  });

  await prisma.assignment.createMany({
    data: copiedRows.map((row) => ({
      organizationId: row.organizationId,
      scheduleVersionId: row.scheduleVersionId,
      staffProfileId: row.staffProfileId,
      shiftCodeId: row.shiftCodeId,
      localDate: new Date(row.localDateText),
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      plannedOtHours: row.plannedOtHours,
      isPinned: false,
      isManualOverride: false,
    })),
  });

  // เว้น 1 เซลล์ว่างบนวันสุดท้ายของสัปดาห์ e2e
  const lastDay = addDays(periodStart, E2E_CYCLE_DAYS - 1);
  const firstStaff = await prisma.staffProfile.findFirst({
    where: { organizationId: org.id, active: true },
    orderBy: [{ staffGroup: { sortOrder: "asc" } }, { rowOrder: "asc" }],
  });
  if (firstStaff) {
    await prisma.assignment.deleteMany({
      where: {
        organizationId: org.id,
        scheduleVersionId: snapshot.draftVersionId,
        staffProfileId: firstStaff.id,
        localDate: new Date(lastDay),
      },
    });
  }

  await prisma.scheduleDraft.update({
    where: { id: editingDraft.id },
    data: { optimisticVersion: { increment: 1 } },
  });

  console.info(
    `Prepared canvas e2e draft (${periodStart}..${snapshot.periodEnd}, assignment days=${E2E_ASSIGNMENT_DAYS}, count=${copiedRows.length})`,
  );
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
