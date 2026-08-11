import { describe, expect, it } from "vitest";

import {
  buildWorkloadStatsSnapshot,
  formatWorkloadStatsCsv,
  recomputeWorkloadStatsFromDraft,
} from "@/domain/optimize/fairness/workload-stats";
import { buildAssignmentInterval } from "@/domain/schedule/time";
import type {
  RuleInstanceSnapshot,
  ScheduleAssignment,
  ShiftCodeSnapshot,
  StaffSnapshot,
} from "@/domain/schedule/types";

const TIMEZONE = "Asia/Bangkok";

/** สร้าง shift code สำหรับ unit test */
function makeShiftCode(
  overrides: Partial<ShiftCodeSnapshot> & Pick<ShiftCodeSnapshot, "id" | "code">,
): ShiftCodeSnapshot {
  return {
    departmentId: "dept-a",
    startTime: "08:00",
    endTime: "16:00",
    standardHours: 8,
    allowedGradeIds: ["grade-a"],
    needsConfirmation: false,
    active: true,
    ...overrides,
  };
}

/** rule instance FAIR_DISTRIBUTION */
function fairDistributionRule(): RuleInstanceSnapshot {
  return {
    id: "fair-1",
    ruleTemplateId: "FAIR_DISTRIBUTION",
    params: {
      dimension: "TOTAL_HOURS",
      scope: "GROUP",
      toleranceHours: 4,
      normalizeByFte: true,
      lookbackMonths: 2,
    },
    severity: "SOFT",
    weight: 1,
    overrideClass: "NEVER",
    enabled: true,
  };
}

describe("workload stats (unit)", () => {
  const dayShift = makeShiftCode({ id: "code-day", code: "DAY", otHours: 2 });
  const staff: StaffSnapshot[] = [
    {
      id: "staff-heavy",
      gradeId: "grade-a",
      staffGroupId: "group-a",
      fte: 1,
      shiftAuthorizations: [],
    },
    {
      id: "staff-light",
      gradeId: "grade-a",
      staffGroupId: "group-a",
      fte: 1,
      shiftAuthorizations: [],
    },
  ];

  const lookbackMonths = ["2026-05", "2026-06"];

  it("buildWorkloadStatsSnapshot รวม archived + carry-over offsets", () => {
    const snapshot = buildWorkloadStatsSnapshot({
      asOfDate: "2026-07-15",
      fairnessLookbackMonths: lookbackMonths,
      staffMeta: [
        {
          staffId: "staff-heavy",
          staffCode: "S-HEAVY",
          displayName: "Heavy Worker",
          staffGroupId: "group-a",
          staffGroupName: "Group A",
          fte: 1,
          targetHoursPerMonth: 160,
        },
        {
          staffId: "staff-light",
          staffCode: "S-LIGHT",
          displayName: "Light Worker",
          staffGroupId: "group-a",
          staffGroupName: "Group A",
          fte: 1,
          targetHoursPerMonth: 160,
        },
      ],
      staffGroups: [{ id: "group-a", code: "GRP-A", displayName: "Group A" }],
      engineInput: {
        organizationId: "org-a",
        timezone: TIMEZONE,
        cycleStartDate: "2026-08-01",
        cycleEndDate: "2026-08-31",
        assignments: [],
        staff,
        shiftCodes: [dayShift],
        shiftDemands: [],
        ruleInstances: [fairDistributionRule()],
        plannedNonWorkingDays: [],
        holidayDates: [],
        staffWorkloadMonthly: [
          {
            staffId: "staff-heavy",
            yearMonth: "2026-05",
            plannedHours: 180,
            otHours: 10,
            nightCount: 4,
            weekendCount: 2,
            holidayCount: 0,
            workedDays: 22,
            daysOff: 8,
            fteAtPeriod: 1,
          },
          {
            staffId: "staff-heavy",
            yearMonth: "2026-06",
            plannedHours: 170,
            otHours: 8,
            nightCount: 3,
            weekendCount: 2,
            holidayCount: 0,
            workedDays: 21,
            daysOff: 9,
            fteAtPeriod: 1,
          },
          {
            staffId: "staff-light",
            yearMonth: "2026-05",
            plannedHours: 140,
            otHours: 2,
            nightCount: 1,
            weekendCount: 1,
            holidayCount: 0,
            workedDays: 18,
            daysOff: 10,
            fteAtPeriod: 1,
          },
          {
            staffId: "staff-light",
            yearMonth: "2026-06",
            plannedHours: 145,
            otHours: 3,
            nightCount: 1,
            weekendCount: 1,
            holidayCount: 0,
            workedDays: 19,
            daysOff: 9,
            fteAtPeriod: 1,
          },
        ],
      },
    });

    expect(snapshot.staffTrends).toHaveLength(2);
    expect(snapshot.groupStats).toHaveLength(1);
    expect(snapshot.carryOverOffsets["staff-heavy"]).toBeGreaterThan(
      snapshot.carryOverOffsets["staff-light"] ?? 0,
    );
    expect(snapshot.staffTrends[0]?.monthlyRows).toHaveLength(2);
  });

  it("recomputeWorkloadStatsFromDraft อัปเดตรอบปัจจุบันสด", () => {
    const interval = buildAssignmentInterval(dayShift, "2026-08-05", TIMEZONE);
    const liveAssignments: ScheduleAssignment[] = [
      {
        id: "live-1",
        staffId: "staff-light",
        shiftCodeId: dayShift.id,
        scheduleDate: "2026-08-05",
        startAt: interval.startAt,
        endAt: interval.endAt,
        plannedOtHours: 2,
      },
    ];

    const base = buildWorkloadStatsSnapshot({
      asOfDate: "2026-08-01",
      fairnessLookbackMonths: lookbackMonths,
      staffMeta: [
        {
          staffId: "staff-light",
          staffCode: "S-LIGHT",
          displayName: "Light Worker",
          staffGroupId: "group-a",
          fte: 1,
        },
      ],
      staffGroups: [{ id: "group-a", code: "GRP-A", displayName: "Group A" }],
      engineInput: {
        organizationId: "org-a",
        timezone: TIMEZONE,
        cycleStartDate: "2026-08-01",
        cycleEndDate: "2026-08-31",
        assignments: [],
        staff,
        shiftCodes: [dayShift],
        shiftDemands: [],
        ruleInstances: [fairDistributionRule()],
        plannedNonWorkingDays: [],
        holidayDates: [],
        staffWorkloadMonthly: [],
      },
      currentCycle: {
        cycleId: "cycle-1",
        draftId: "draft-1",
        cycleName: "2026-08",
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        yearMonth: "2026-08",
      },
      currentCycleAssignments: [],
    });

    const updated = recomputeWorkloadStatsFromDraft(base, {
      engineInput: base.staffTrends.length
        ? {
            organizationId: "org-a",
            timezone: TIMEZONE,
            cycleStartDate: "2026-08-01",
            cycleEndDate: "2026-08-31",
            assignments: [],
            staff,
            shiftCodes: [dayShift],
            shiftDemands: [],
            ruleInstances: [fairDistributionRule()],
            plannedNonWorkingDays: [],
            holidayDates: [],
          }
        : {
            organizationId: "org-a",
            timezone: TIMEZONE,
            cycleStartDate: "2026-08-01",
            cycleEndDate: "2026-08-31",
            assignments: [],
            staff,
            shiftCodes: [dayShift],
            shiftDemands: [],
            ruleInstances: [fairDistributionRule()],
            plannedNonWorkingDays: [],
            holidayDates: [],
          },
      currentCycleAssignments: liveAssignments,
    });

    expect(updated.staffTrends[0]?.currentCycle?.plannedHours).toBe(8);
    expect(updated.staffTrends[0]?.currentCycle?.otHours).toBe(4);
  });

  it("formatWorkloadStatsCsv มี header และแถว staff", () => {
    const snapshot = buildWorkloadStatsSnapshot({
      asOfDate: "2026-07-01",
      fairnessLookbackMonths: ["2026-06"],
      staffMeta: [
        {
          staffId: "staff-light",
          staffCode: "S-LIGHT",
          displayName: "Light Worker",
          staffGroupId: "group-a",
          fte: 1,
        },
      ],
      staffGroups: [{ id: "group-a", code: "GRP-A", displayName: "Group A" }],
      engineInput: {
        organizationId: "org-a",
        timezone: TIMEZONE,
        cycleStartDate: "2026-07-01",
        cycleEndDate: "2026-07-31",
        assignments: [],
        staff,
        shiftCodes: [dayShift],
        shiftDemands: [],
        ruleInstances: [],
        plannedNonWorkingDays: [],
        holidayDates: [],
        staffWorkloadMonthly: [
          {
            staffId: "staff-light",
            yearMonth: "2026-06",
            plannedHours: 150,
            otHours: 3,
            nightCount: 1,
            weekendCount: 1,
            holidayCount: 0,
            workedDays: 20,
            daysOff: 8,
            fteAtPeriod: 1,
          },
        ],
      },
    });

    const csv = formatWorkloadStatsCsv(snapshot);
    expect(csv.startsWith("staff_code,display_name")).toBe(true);
    expect(csv).toContain("S-LIGHT");
    expect(csv).toContain("2026-06");
  });
});
