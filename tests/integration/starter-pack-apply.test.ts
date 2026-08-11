import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { loadStarterPack } from "@/domain/starter-pack";
import { prisma } from "@/lib/prisma";
import { applyStarterPack } from "@/lib/starter-pack/apply-pack";

/** integration — apply starter pack หลังมี schedule version ผูก rule set */
describe("applyStarterPack (integration)", () => {
  const organizationId = randomUUID();
  const orgSlug = `test-apply-pack-${organizationId.slice(0, 8)}`;

  afterAll(async () => {
    await prisma.plannedNonWorkingDay.deleteMany({ where: { organizationId } });
    await prisma.assignment.deleteMany({ where: { organizationId } });
    await prisma.scheduleRun.deleteMany({ where: { organizationId } });
    await prisma.staffWorkloadMonthly.deleteMany({ where: { organizationId } });
    await prisma.schedulingPolicy.deleteMany({ where: { organizationId } });
    await prisma.scheduleVersion.deleteMany({ where: { organizationId } });
    await prisma.scheduleDraft.deleteMany({ where: { organizationId } });
    await prisma.scheduleCycle.deleteMany({ where: { organizationId } });
    await prisma.ruleInstance.deleteMany({ where: { organizationId } });
    await prisma.ruleSetVersion.deleteMany({ where: { organizationId } });
    await prisma.shiftCodeDemand.deleteMany({ where: { organizationId } });
    await prisma.holidayDate.deleteMany({
      where: { holidayCalendar: { organizationId } },
    });
    await prisma.holidayCalendar.deleteMany({ where: { organizationId } });
    await prisma.shiftInstance.deleteMany({ where: { organizationId } });
    await prisma.shiftTemplate.deleteMany({ where: { organizationId } });
    await prisma.staffShiftAuthorization.deleteMany({ where: { organizationId } });
    await prisma.shiftCode.deleteMany({ where: { organizationId } });
    await prisma.employmentContract.deleteMany({ where: { organizationId } });
    await prisma.staffProfile.deleteMany({ where: { organizationId } });
    await prisma.staffGroup.deleteMany({ where: { organizationId } });
    await prisma.staffGrade.deleteMany({ where: { organizationId } });
    await prisma.nonWorkingDayKind.deleteMany({ where: { organizationId } });
    await prisma.department.deleteMany({ where: { organizationId } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("replaceExisting สำเร็จแม้มี ScheduleVersion อ้าง ruleSetVersion", async () => {
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: "Test Apply Pack Org",
        slug: orgSlug,
        timezone: "Asia/Bangkok",
      },
    });

    const snapshot = loadStarterPack("pilot-lab-example");
    const firstApply = await applyStarterPack(prisma, {
      organizationId,
      snapshot,
      replaceExisting: true,
      includeStaff: true,
      includeHolidays: true,
      includeDemoRoster: true,
    });

    expect(firstApply.rosterAssignments).toBe(12 * 31);

    expect(firstApply.staffShiftAuthorizations).toBeGreaterThan(0);

    const ruleSet = await prisma.ruleSetVersion.findFirst({
      where: { organizationId },
      orderBy: { versionNumber: "desc" },
    });

    expect(ruleSet).not.toBeNull();

    const schedulingPolicy = await prisma.schedulingPolicy.findFirst({
      where: { organizationId },
    });
    expect(schedulingPolicy?.historyWindowMonths).toBe(6);
    expect(schedulingPolicy?.planningHorizonMonths).toBe(1);

    // สร้าง cycle เพิ่มเพื่อทดสอบว่า replaceExisting ล้าง version ที่อ้าง rule set ได้
    const cycle = await prisma.scheduleCycle.create({
      data: {
        organizationId,
        name: "Test cycle",
        periodStart: new Date("2026-09-01"),
        periodEnd: new Date("2026-09-30"),
      },
    });

    const draft = await prisma.scheduleDraft.create({
      data: {
        organizationId,
        scheduleCycleId: cycle.id,
        draftNumber: 1,
        status: "EDITING",
      },
    });

    await prisma.scheduleVersion.create({
      data: {
        organizationId,
        scheduleCycleId: cycle.id,
        scheduleDraftId: draft.id,
        versionNumber: 1,
        status: "PUBLISHED",
        ruleSetVersionId: ruleSet!.id,
        publishedAt: new Date("2026-07-28T09:00:00.000Z"),
      },
    });

    await expect(
      applyStarterPack(prisma, {
        organizationId,
        snapshot: loadStarterPack("pilot-lab-example"),
        replaceExisting: true,
        includeStaff: true,
        includeHolidays: true,
        includeDemoRoster: true,
      }),
    ).resolves.toMatchObject({
      departments: expect.any(Number),
      shiftCodes: expect.any(Number),
      rosterAssignments: 12 * 31,
    });

    // replace ล้าง version เดิมแล้ว publish ตารางตัวอย่างชุดใหม่
    const scheduleCount = await prisma.scheduleVersion.count({ where: { organizationId } });
    expect(scheduleCount).toBe(1);
  });
});
