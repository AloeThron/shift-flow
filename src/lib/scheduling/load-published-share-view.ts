import { hashShareToken, isShareLinkActive } from "@/domain/schedule/share/token";
import type { PublishedRosterGridView } from "@/domain/share";
import { buildPublishedRosterGrid } from "@/domain/share";
import { prisma } from "@/lib/prisma";

/** แปลง Date เป็น YYYY-MM-DD */
function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** โหลดตารางเวรสำหรับหน้า share สาธารณะ — allowlist fields เท่านั้น */
export async function loadPublishedShareView(
  token: string,
): Promise<PublishedRosterGridView | null> {
  const tokenHash = hashShareToken(token);
  const now = new Date();

  const link = await prisma.scheduleShareLink.findUnique({
    where: { tokenHash },
    include: {
      scheduleVersion: {
        include: {
          scheduleCycle: true,
          organization: { select: { timezone: true } },
        },
      },
    },
  });

  if (!link || !isShareLinkActive(link, now)) {
    return null;
  }

  const { scheduleVersion } = link;
  if (scheduleVersion.status !== "PUBLISHED" && scheduleVersion.status !== "LOCKED") {
    return null;
  }

  const periodStart = formatDateInput(scheduleVersion.scheduleCycle.periodStart);
  const periodEnd = formatDateInput(scheduleVersion.scheduleCycle.periodEnd);

  const [assignmentRows, staffRows, shiftCodeRows, offKindRows] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        organizationId: link.organizationId,
        scheduleVersionId: scheduleVersion.id,
        localDate: {
          gte: scheduleVersion.scheduleCycle.periodStart,
          lte: scheduleVersion.scheduleCycle.periodEnd,
        },
      },
      include: {
        shiftCode: { select: { canonicalCode: true, isNightShift: true } },
        staffProfile: { select: { id: true, displayName: true } },
      },
      orderBy: [{ staffProfileId: "asc" }, { localDate: "asc" }],
    }),
    prisma.staffProfile.findMany({
      where: {
        organizationId: link.organizationId,
        active: true,
        assignments: {
          some: { scheduleVersionId: scheduleVersion.id },
        },
      },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.shiftCode.findMany({
      where: { organizationId: link.organizationId, deprecated: false },
      select: { canonicalCode: true, isNightShift: true },
    }),
    prisma.nonWorkingDayKind.findMany({
      where: { organizationId: link.organizationId, active: true },
      select: { code: true },
    }),
  ]);

  await prisma.scheduleShareLink.update({
    where: { id: link.id },
    data: {
      viewCount: { increment: 1 },
      lastViewedAt: now,
    },
  });

  const offKindCodes = new Set(offKindRows.map((kind) => kind.code));

  const assignments = assignmentRows.map((row) => {
    const shiftCode = row.shiftCode?.canonicalCode ?? null;
    const isOff = shiftCode !== null && offKindCodes.has(shiftCode);

    return {
      staffProfileId: row.staffProfileId,
      displayName: row.staffProfile.displayName,
      localDate: formatDateInput(row.localDate),
      shiftCode: isOff ? null : shiftCode,
      nonWorkingDayKindCode: isOff ? shiftCode : null,
      startsAt: isOff ? null : row.startsAt.toISOString(),
      endsAt: isOff ? null : row.endsAt.toISOString(),
    };
  });

  const staff =
    staffRows.length > 0
      ? staffRows
      : [...new Map(assignments.map((row) => [row.staffProfileId, row.displayName])).entries()].map(
          ([id, displayName]) => ({ id, displayName }),
        );

  const grid = buildPublishedRosterGrid({
    periodStart,
    periodEnd,
    staff,
    assignments,
  });

  return {
    schedule: {
      id: scheduleVersion.id,
      versionNumber: scheduleVersion.versionNumber,
      cycleName: scheduleVersion.scheduleCycle.name,
      periodStart,
      periodEnd,
      publishedAt: scheduleVersion.publishedAt?.toISOString() ?? null,
    },
    timezone: scheduleVersion.organization.timezone,
    dates: grid.dates,
    rows: grid.rows,
    shiftCodes: shiftCodeRows.map((row) => ({
      code: row.canonicalCode,
      isNightShift: row.isNightShift,
    })),
  };
}
