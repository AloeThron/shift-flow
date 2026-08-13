import { config } from "dotenv";

/** โหลด env ก่อน import prisma (ESM hoist — ใช้ dynamic import) */
config({ path: ".env.local" });
config();

const DEFAULT_PACK_ID = process.env.SEED_STARTER_PACK ?? "pilot-lab-example";

/** seed สังเคราะห์ — ไม่สร้างรหัสผ่าน production */
async function main(): Promise<void> {
  const { prisma } = await import("../src/lib/prisma");
  const { hash } = await import("../src/lib/auth/password");
  const { DEV_DEMO_ACCOUNTS, DEV_DEMO_PASSWORD } = await import(
    "../src/lib/auth/dev-demo-accounts"
  );
  const { loadStarterPack } = await import("../src/domain/starter-pack");
  const { applyStarterPack } = await import("../src/lib/starter-pack/apply-pack");

  const passwordHash = await hash(DEV_DEMO_PASSWORD);
  const snapshot = loadStarterPack(DEFAULT_PACK_ID);

  const org = await prisma.organization.upsert({
    where: { slug: "demo-lab" },
    update: { name: snapshot.organization.name, timezone: snapshot.organization.timezone },
    create: {
      name: snapshot.organization.name,
      slug: "demo-lab",
      timezone: snapshot.organization.timezone,
    },
  });

  const demoUsers: Record<string, { id: string }> = {};

  for (const account of DEV_DEMO_ACCOUNTS) {
    const user = await prisma.user.upsert({
      where: { username: account.username },
      update: {},
      create: {
        username: account.username,
        email: account.email,
        displayName: account.displayName,
        passwordHash,
        status: "ACTIVE",
      },
    });

    await prisma.organizationMembership.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: org.id,
        },
      },
      update: { status: "ACTIVE", role: account.role },
      create: {
        userId: user.id,
        organizationId: org.id,
        role: account.role,
        status: "ACTIVE",
      },
    });

    demoUsers[account.username] = user;
  }

  const admin = demoUsers["admin.demo"];

  if (!admin) {
    throw new Error("Seed demo users missing — check DEV_DEMO_ACCOUNTS");
  }

  /** ล้าง schedule demo เดิม — config/roster ถูก replace โดย applyStarterPack */
  await prisma.auditEvent.deleteMany({ where: { organizationId: org.id } });
  await prisma.assignment.deleteMany({ where: { organizationId: org.id } });
  await prisma.plannedNonWorkingDay.deleteMany({ where: { organizationId: org.id } });
  await prisma.draftStaffDayOffQuota.deleteMany({ where: { organizationId: org.id } });
  await prisma.scheduleRun.deleteMany({ where: { organizationId: org.id } });
  await prisma.staffWorkloadMonthly.deleteMany({ where: { organizationId: org.id } });
  await prisma.scheduleVersion.deleteMany({ where: { organizationId: org.id } });
  await prisma.scheduleDraft.deleteMany({ where: { organizationId: org.id } });
  await prisma.scheduleCycle.deleteMany({ where: { organizationId: org.id } });

  const stats = await applyStarterPack(prisma, {
    organizationId: org.id,
    snapshot,
    actorUserId: admin.id,
    replaceExisting: true,
    includeStaff: true,
    includeHolidays: true,
    includeDemoRoster: true,
  });

  const { ensurePlanningCycles } = await import("../src/lib/scheduling/ensure-planning-cycles");
  await ensurePlanningCycles(prisma, {
    organizationId: org.id,
    asOfDate: "2026-08-01",
  });

  await prisma.auditEvent.create({
    data: {
      organizationId: org.id,
      actorUserId: admin.id,
      action: "CREATE",
      entityType: "Organization",
      entityId: org.id,
      after: { slug: org.slug, seeded: true, starterPackId: snapshot.packId },
      reason: "Initial synthetic domain seed",
    },
  });

  /** ข้อมูล fairness ledger + two-stage solver demo */
  const draft = await prisma.scheduleDraft.findFirst({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
  });
  const ruleSet = await prisma.ruleSetVersion.findFirst({
    where: { organizationId: org.id },
    orderBy: { versionNumber: "desc" },
  });
  const offKind = await prisma.nonWorkingDayKind.findFirst({
    where: { organizationId: org.id, code: "OFF" },
  });
  const staffProfiles = await prisma.staffProfile.findMany({
    where: { organizationId: org.id, active: true },
    include: { staffGroup: true },
  });

  if (draft && ruleSet && offKind && staffProfiles.length > 0) {
    const demoStaff = staffProfiles.find((profile) => profile.staffCode === "STAFF-DEMO-PL-002");
    const peerStaff = staffProfiles.find((profile) => profile.staffCode === "STAFF-DEMO-PL-003");

    if (demoStaff) {
      await prisma.plannedNonWorkingDay.createMany({
        data: [
          {
            organizationId: org.id,
            scheduleDraftId: draft.id,
            staffProfileId: demoStaff.id,
            localDate: new Date("2026-08-18"),
            nonWorkingDayKindId: offKind.id,
            source: "QUOTA",
            locked: true,
          },
          {
            organizationId: org.id,
            scheduleDraftId: draft.id,
            staffProfileId: demoStaff.id,
            localDate: new Date("2026-08-25"),
            nonWorkingDayKindId: offKind.id,
            source: "REQUEST",
            locked: false,
          },
        ],
        skipDuplicates: true,
      });
    }

    await prisma.scheduleRun.createMany({
      data: [
        {
          organizationId: org.id,
          scheduleDraftId: draft.id,
          ruleSetVersionId: ruleSet.id,
          stage: "DAY_OFF",
          status: "COMPLETED",
          inputChecksum: "seed-day-off-v1",
          solverVersion: "optimize/0.0.0",
          randomSeed: "deterministic-seed",
          startedAt: new Date("2026-08-01T08:00:00.000Z"),
          completedAt: new Date("2026-08-01T08:00:05.000Z"),
          resultSummary: { plannedDaysOff: 2, staffId: demoStaff?.id ?? null },
        },
        {
          organizationId: org.id,
          scheduleDraftId: draft.id,
          ruleSetVersionId: ruleSet.id,
          stage: "BALANCE",
          status: "COMPLETED",
          inputChecksum: "seed-balance-v1",
          solverVersion: "optimize/0.0.0",
          randomSeed: "deterministic-seed",
          startedAt: new Date("2026-08-01T08:01:00.000Z"),
          completedAt: new Date("2026-08-01T08:01:30.000Z"),
          resultSummary: {
            coverageGap: 0,
            otSpreadHours: 4,
            peerStaffId: peerStaff?.id ?? null,
          },
        },
      ],
    });
  }

  /** สรุป workload 6 เดือนย้อนหลังสำหรับ fairness carry-over */
  const lookbackMonths = ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"];
  const workloadRows = staffProfiles.flatMap((profile, staffIndex) =>
    lookbackMonths.map((yearMonth, monthIndex) => {
      const baseHours = 150 + staffIndex * 3 + monthIndex * 2;
      const otHours = Math.max(0, (staffIndex + monthIndex) % 5);
      return {
        organizationId: org.id,
        staffProfileId: profile.id,
        yearMonth,
        staffGroupId: profile.staffGroupId,
        plannedHours: baseHours,
        otHours,
        nightCount: (staffIndex + monthIndex) % 4,
        weekendCount: 4 + (monthIndex % 2),
        holidayCount: monthIndex % 2,
        workedDays: 20 + (monthIndex % 3),
        daysOff: 8 + (monthIndex % 2),
        fteAtPeriod: profile.staffCode === "STAFF-DEMO-PL-007" ? 0.5 : 1,
        computedAt: new Date(`${yearMonth}-28T12:00:00.000Z`),
      };
    }),
  );

  if (workloadRows.length > 0) {
    await prisma.staffWorkloadMonthly.createMany({ data: workloadRows, skipDuplicates: true });
  }

  console.info(
    `Seed complete: demo-lab / starter pack ${snapshot.packId} / admin.demo + scheduler.demo (password: ${DEV_DEMO_PASSWORD})`,
  );
  console.info(
    `  departments: ${stats.departments}, demands: ${stats.shiftCodeDemands}, staff groups: ${stats.staffGroups}, staff: ${stats.staffProfiles}, shift codes: ${stats.shiftCodes}, rules: ${stats.ruleInstances}, roster cells: ${stats.rosterAssignments}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
