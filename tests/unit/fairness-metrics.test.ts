import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  aggregateStaffWorkloadMonthly,
  buildFairnessSnapshot,
  buildValidationScheduleInput,
  computeGini,
  computeSpread,
  computeStaffHourOffset,
  computeStaffWorkloadMonthlyForMonth,
  resolveFairDistributionParams,
} from "@/domain/optimize/fairness";
import { lookbackYearMonths } from "@/domain/rules/helpers/schedule-metrics";
import { buildAssignmentInterval } from "@/domain/schedule/time";
import type {
  RuleInstanceSnapshot,
  ScheduleAssignment,
  ShiftCodeSnapshot,
  StaffSnapshot,
} from "@/domain/schedule/types";

const DATASET = join(process.cwd(), "demo/validation-dataset");
const TIMEZONE = "Asia/Bangkok";

type FairnessGolden = {
  cycle_start_date: string;
  cycle_end_date: string;
  lookback_months: number;
  workload_row_count: number;
  snapshots: {
    TOTAL_HOURS: ReturnType<typeof buildFairnessSnapshot>;
    OT_HOURS: ReturnType<typeof buildFairnessSnapshot>;
  };
};

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
function fairDistributionRule(params: Record<string, unknown> = {}): RuleInstanceSnapshot {
  return {
    id: "fair-1",
    ruleTemplateId: "FAIR_DISTRIBUTION",
    params: {
      dimension: "TOTAL_HOURS",
      scope: "GROUP",
      toleranceHours: 4,
      normalizeByFte: true,
      lookbackMonths: 6,
      ...params,
    },
    severity: "SOFT",
    weight: 1,
    overrideClass: "NEVER",
    enabled: true,
  };
}

describe("fairness metrics (unit)", () => {
  it("computeSpread และ computeGini ให้ค่าที่คาดได้", () => {
    const spread = computeSpread(
      new Map([
        ["a", 10],
        ["b", 14],
        ["c", 18],
      ]),
    );

    expect(spread.min).toBe(10);
    expect(spread.max).toBe(18);
    expect(spread.spread).toBe(8);
    expect(spread.mean).toBeCloseTo(14);

    expect(computeGini([10, 10, 10])).toBe(0);
    expect(computeGini([0, 0, 10])).toBeGreaterThan(0);
  });

  it("aggregateStaffWorkloadMonthly idempotent เมื่อรันซ้ำ", () => {
    const dayShift = makeShiftCode({ id: "code-day", code: "DAY" });
    const offShift = makeShiftCode({ id: "code-off", code: "off", standardHours: 0 });
    const staff: StaffSnapshot[] = [
      {
        id: "staff-1",
        gradeId: "grade-a",
        staffGroupId: "group-a",
        fte: 1,
        shiftAuthorizations: [],
      },
    ];

    const dayInterval = buildAssignmentInterval(dayShift, "2026-03-02", TIMEZONE);
    const offInterval = buildAssignmentInterval(offShift, "2026-03-03", TIMEZONE);
    const assignments: ScheduleAssignment[] = [
      {
        id: "a1",
        staffId: "staff-1",
        shiftCodeId: dayShift.id,
        scheduleDate: "2026-03-02",
        startAt: dayInterval.startAt,
        endAt: dayInterval.endAt,
      },
      {
        id: "a2",
        staffId: "staff-1",
        shiftCodeId: offShift.id,
        scheduleDate: "2026-03-03",
        startAt: offInterval.startAt,
        endAt: offInterval.endAt,
      },
    ];

    const input = {
      staff,
      shiftCodes: [dayShift, offShift],
      assignments,
      holidayDates: [],
    };

    const first = aggregateStaffWorkloadMonthly(input, ["2026-03"]);
    const second = aggregateStaffWorkloadMonthly(input, ["2026-03"]);
    expect(first).toEqual(second);
    expect(first[0]).toMatchObject({
      staffId: "staff-1",
      yearMonth: "2026-03",
      plannedHours: 8,
      workedDays: 1,
      daysOff: 1,
    });
  });

  it("computeStaffWorkloadMonthlyForMonth ตรงกับ aggregate แถวเดียว", () => {
    const dayShift = makeShiftCode({ id: "code-day", code: "DAY", otHours: 2, standardHours: 10 });
    const staff: StaffSnapshot[] = [
      {
        id: "staff-1",
        gradeId: "grade-a",
        staffGroupId: "group-a",
        fte: 1,
        shiftAuthorizations: [],
      },
    ];
    const interval = buildAssignmentInterval(dayShift, "2026-05-10", TIMEZONE);
    const input = {
      staff,
      shiftCodes: [dayShift],
      assignments: [
        {
          id: "a1",
          staffId: "staff-1",
          shiftCodeId: dayShift.id,
          scheduleDate: "2026-05-10",
          startAt: interval.startAt,
          endAt: interval.endAt,
        },
      ],
      holidayDates: [],
    };

    const direct = computeStaffWorkloadMonthlyForMonth(input, "staff-1", "2026-05");
    const aggregated = aggregateStaffWorkloadMonthly(input, ["2026-05"]);
    expect(direct).toEqual(aggregated[0]);
  });

  it("คนใหม่ไม่มีประวัติไม่ถูก offset ลงโทษ", () => {
    const dayShift = makeShiftCode({ id: "code-day", code: "DAY" });
    const input = {
      organizationId: "org-a",
      timezone: TIMEZONE,
      cycleStartDate: "2026-06-01",
      cycleEndDate: "2026-06-07",
      assignments: [],
      staff: [
        {
          id: "staff-old",
          gradeId: "grade-a",
          staffGroupId: "group-a",
          fte: 1,
          shiftAuthorizations: [],
        },
        {
          id: "staff-new",
          gradeId: "grade-a",
          staffGroupId: "group-a",
          fte: 1,
          shiftAuthorizations: [],
        },
      ],
      shiftCodes: [dayShift],
      shiftDemands: [],
      ruleInstances: [fairDistributionRule()],
      plannedNonWorkingDays: [],
      holidayDates: [],
      staffWorkloadMonthly: [
        {
          staffId: "staff-old",
          yearMonth: "2026-05",
          plannedHours: 160,
          otHours: 10,
          nightCount: 4,
          weekendCount: 2,
          holidayCount: 0,
          workedDays: 20,
          daysOff: 10,
          fteAtPeriod: 1,
        },
      ],
    };

    const fairParams = resolveFairDistributionParams(input.ruleInstances);
    expect(fairParams).toBeDefined();
    if (!fairParams) {
      return;
    }

    const newStaffOffset = computeStaffHourOffset(input, "staff-new", fairParams);
    expect(newStaffOffset).toBe(0);
  });
});

describe("fairness golden (validation dataset)", () => {
  const golden = JSON.parse(
    readFileSync(join(DATASET, "golden/fairness_metrics.json"), "utf8"),
  ) as FairnessGolden;

  it("มี golden fairness_metrics.json", () => {
    expect(golden.snapshots.TOTAL_HOURS.groups).toBeDefined();
    expect(golden.snapshots.OT_HOURS.groups).toBeDefined();
    expect(golden.workload_row_count).toBeGreaterThan(0);
  });

  it("fairness snapshot ตรง golden สำหรับรอบ 2026-06", () => {
    const { input, allAssignments, shiftCodes } = buildValidationScheduleInput({
      cycleStartDate: golden.cycle_start_date,
      cycleEndDate: golden.cycle_end_date,
      includeHistoricalAssignments: true,
    });

    const lookbackMonths = lookbackYearMonths(golden.cycle_start_date, golden.lookback_months);
    const historicalAssignments = allAssignments.filter(
      (assignment) => assignment.scheduleDate < golden.cycle_start_date,
    );

    const staffWorkloadMonthly = aggregateStaffWorkloadMonthly(
      {
        staff: input.staff,
        shiftCodes,
        assignments: historicalAssignments,
        holidayDates: input.holidayDates,
      },
      lookbackMonths,
    );

    expect(staffWorkloadMonthly.length).toBe(golden.workload_row_count);

    const engineInput = {
      ...input,
      staffWorkloadMonthly,
    };

    const totalHours = buildFairnessSnapshot(engineInput, {
      dimension: "TOTAL_HOURS",
      scope: "GROUP",
      lookbackMonths: golden.lookback_months,
      normalizeByFte: true,
    });
    const otHours = buildFairnessSnapshot(engineInput, {
      dimension: "OT_HOURS",
      scope: "GROUP",
      lookbackMonths: golden.lookback_months,
      normalizeByFte: true,
    });

    expect(totalHours.groups).toEqual(golden.snapshots.TOTAL_HOURS.groups);
    expect(otHours.groups).toEqual(golden.snapshots.OT_HOURS.groups);
  });

  it("lookback 6 เดือนเพิ่ม spread เทียบ cycle-only เพราะรวมประวัติ (grp-mt TOTAL_HOURS)", () => {
    const { input, allAssignments, shiftCodes } = buildValidationScheduleInput({
      cycleStartDate: golden.cycle_start_date,
      cycleEndDate: golden.cycle_end_date,
      includeHistoricalAssignments: true,
    });

    const lookbackMonths = lookbackYearMonths(golden.cycle_start_date, golden.lookback_months);
    const historicalAssignments = allAssignments.filter(
      (assignment) => assignment.scheduleDate < golden.cycle_start_date,
    );
    const staffWorkloadMonthly = aggregateStaffWorkloadMonthly(
      {
        staff: input.staff,
        shiftCodes,
        assignments: historicalAssignments,
        holidayDates: input.holidayDates,
      },
      lookbackMonths,
    );

    const withLookback = buildFairnessSnapshot(
      { ...input, staffWorkloadMonthly },
      {
        dimension: "TOTAL_HOURS",
        scope: "GROUP",
        lookbackMonths: golden.lookback_months,
        normalizeByFte: true,
      },
    );

    const cycleOnly = buildFairnessSnapshot(
      { ...input, staffWorkloadMonthly: [] },
      {
        dimension: "TOTAL_HOURS",
        scope: "GROUP",
        lookbackMonths: golden.lookback_months,
        normalizeByFte: true,
      },
    );

    const lookbackSpread = withLookback.groups["grp-mt"]?.spread ?? 0;
    const cycleOnlySpread = cycleOnly.groups["grp-mt"]?.spread ?? 0;
    expect(lookbackSpread).toBeGreaterThan(cycleOnlySpread);
  });
});
