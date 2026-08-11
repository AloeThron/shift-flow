import { resolveOtLimitParams } from "@/domain/optimize/balance/types";
import {
  computeStaffHourOffset,
  resolveFairDistributionParams,
  type FairDistributionParams,
} from "@/domain/optimize/fairness/carry-over";
import {
  computeGroupFairnessReports,
  computeSpread,
  roundFairnessMetric,
  type GroupFairnessReport,
} from "@/domain/optimize/fairness/metrics";
import {
  aggregateStaffWorkloadMonthly,
  computeStaffWorkloadMonthlyForMonth,
  type WorkloadMonthlyInput,
} from "@/domain/optimize/fairness/workload-monthly";
import {
  lookbackYearMonths,
  staffFairnessMetric,
  type FairnessDimension,
} from "@/domain/rules/helpers/schedule-metrics";
import type {
  PlannedNonWorkingDaySnapshot,
  ScheduleEngineInput,
  StaffWorkloadMonthlySnapshot,
} from "@/domain/schedule/types";
import { buildValidationContext } from "@/domain/schedule/validate";

/** ตัวชี้วัด workload รายเดือน */
export type WorkloadMetrics = {
  readonly plannedHours: number;
  readonly otHours: number;
  readonly nightCount: number;
  readonly weekendCount: number;
  readonly holidayCount: number;
  readonly workedDays: number;
  readonly daysOff: number;
};

/** แถว workload รายเดือนของคนเดียว */
export type StaffWorkloadMonthRow = WorkloadMetrics & {
  readonly yearMonth: string;
  readonly fteAtPeriod: number;
  readonly perFte: WorkloadMetrics;
  readonly source: "ARCHIVED" | "COMPUTED" | "CURRENT_CYCLE";
};

/** แนวโน้ม workload ต่อคน — 6 เดือนย้อนหลัง + รอบปัจจุบัน */
export type StaffWorkloadTrend = {
  readonly staffId: string;
  readonly staffCode: string;
  readonly displayName: string;
  readonly staffGroupId?: string;
  readonly staffGroupName?: string;
  readonly fte: number;
  readonly targetHoursPerMonth?: number;
  readonly lookbackMonthsPresent: number;
  readonly lookbackMonthsExpected: number;
  readonly monthlyRows: readonly StaffWorkloadMonthRow[];
  readonly currentCycle?: StaffWorkloadMonthRow;
  readonly lookbackTotals: WorkloadMetrics;
  readonly lookbackTotalsPerFte: WorkloadMetrics;
  readonly carryOverOffset: number;
  readonly fairnessMetric: number;
};

/** คนที่เกินช่วง tolerance ของ FAIR_DISTRIBUTION */
export type OutOfToleranceStaff = {
  readonly staffId: string;
  readonly staffCode: string;
  readonly displayName: string;
  readonly value: number;
  readonly groupMean: number;
  readonly deviation: number;
};

/** สรุป spread ของ metric ในกลุ่ม */
export type GroupMetricSpread = {
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly spread: number;
};

/** สรุป workload ต่อกลุ่ม */
export type GroupWorkloadStats = {
  readonly groupKey: string;
  readonly groupName: string;
  readonly staffCount: number;
  readonly lookbackSpreads: Readonly<Record<keyof WorkloadMetrics, GroupMetricSpread>>;
  readonly currentCycleSpreads?: Readonly<
    Partial<Record<keyof WorkloadMetrics, GroupMetricSpread>>
  >;
  readonly fairnessReport?: GroupFairnessReport;
  readonly outOfTolerance: readonly OutOfToleranceStaff[];
};

/** รอบที่กำลังจัด */
export type CurrentCycleContext = {
  readonly cycleId: string;
  readonly draftId: string;
  readonly cycleName: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly yearMonth: string;
};

/** metadata staff สำหรับแสดงผล */
export type StaffDisplayMeta = {
  readonly staffId: string;
  readonly staffCode: string;
  readonly displayName: string;
  readonly staffGroupId?: string;
  readonly staffGroupName?: string;
  readonly fte: number;
  readonly targetHoursPerMonth?: number;
};

/** ชื่อกลุ่มสำหรับ UI */
export type StaffGroupLabel = {
  readonly id: string;
  readonly code: string;
  readonly displayName: string;
};

/** input สำหรับ buildWorkloadStatsSnapshot */
export type WorkloadStatsInput = {
  readonly asOfDate: string;
  readonly fairnessLookbackMonths: readonly string[];
  readonly staffMeta: readonly StaffDisplayMeta[];
  readonly staffGroups: readonly StaffGroupLabel[];
  readonly engineInput: ScheduleEngineInput;
  readonly currentCycle?: CurrentCycleContext;
  readonly currentCycleAssignments?: WorkloadMonthlyInput["assignments"];
  readonly currentCyclePlannedOff?: readonly PlannedNonWorkingDaySnapshot[];
};

/** snapshot สำหรับหน้า workload และแผง canvas */
export type WorkloadStatsSnapshot = {
  readonly asOfDate: string;
  readonly fairnessLookbackMonths: readonly string[];
  readonly fairParams?: FairDistributionParams;
  readonly fairDimension: FairnessDimension;
  readonly toleranceHours: number;
  readonly maxOtHoursPerStaff?: number;
  readonly currentCycle?: CurrentCycleContext;
  readonly staffTrends: readonly StaffWorkloadTrend[];
  readonly groupStats: readonly GroupWorkloadStats[];
  readonly carryOverOffsets: Readonly<Record<string, number>>;
};

const EMPTY_METRICS: WorkloadMetrics = {
  plannedHours: 0,
  otHours: 0,
  nightCount: 0,
  weekendCount: 0,
  holidayCount: 0,
  workedDays: 0,
  daysOff: 0,
};

const METRIC_KEYS: readonly (keyof WorkloadMetrics)[] = [
  "plannedHours",
  "otHours",
  "nightCount",
  "weekendCount",
  "holidayCount",
  "workedDays",
  "daysOff",
];

/** ปัดทศนิยม 2 ตำแหน่ง */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** แปลง snapshot เป็น WorkloadMetrics */
function toWorkloadMetrics(row: StaffWorkloadMonthlySnapshot): WorkloadMetrics {
  return {
    plannedHours: row.plannedHours,
    otHours: row.otHours,
    nightCount: row.nightCount,
    weekendCount: row.weekendCount,
    holidayCount: row.holidayCount,
    workedDays: row.workedDays,
    daysOff: row.daysOff,
  };
}

/** คำนวณค่า per FTE — นับวันไม่ normalize */
function normalizeMetricsPerFte(metrics: WorkloadMetrics, fte: number): WorkloadMetrics {
  if (fte <= 0) {
    return metrics;
  }

  return {
    plannedHours: round2(metrics.plannedHours / fte),
    otHours: round2(metrics.otHours / fte),
    nightCount: metrics.nightCount,
    weekendCount: metrics.weekendCount,
    holidayCount: metrics.holidayCount,
    workedDays: metrics.workedDays,
    daysOff: metrics.daysOff,
  };
}

/** รวม metrics หลายเดือน */
function sumMetrics(rows: readonly WorkloadMetrics[]): WorkloadMetrics {
  return rows.reduce(
    (total, row) => ({
      plannedHours: round2(total.plannedHours + row.plannedHours),
      otHours: round2(total.otHours + row.otHours),
      nightCount: total.nightCount + row.nightCount,
      weekendCount: total.weekendCount + row.weekendCount,
      holidayCount: total.holidayCount + row.holidayCount,
      workedDays: total.workedDays + row.workedDays,
      daysOff: total.daysOff + row.daysOff,
    }),
    { ...EMPTY_METRICS },
  );
}

/** สร้างแถวรายเดือนจาก archived snapshot */
function monthRowFromArchived(row: StaffWorkloadMonthlySnapshot): StaffWorkloadMonthRow {
  const metrics = toWorkloadMetrics(row);
  return {
    yearMonth: row.yearMonth,
    fteAtPeriod: row.fteAtPeriod,
    ...metrics,
    perFte: normalizeMetricsPerFte(metrics, row.fteAtPeriod),
    source: "ARCHIVED",
  };
}

/** สร้างแถวรายเดือนจากการคำนวณสด */
function monthRowFromComputed(
  row: StaffWorkloadMonthlySnapshot,
  source: StaffWorkloadMonthRow["source"],
): StaffWorkloadMonthRow {
  const metrics = toWorkloadMetrics(row);
  return {
    yearMonth: row.yearMonth,
    fteAtPeriod: row.fteAtPeriod,
    ...metrics,
    perFte: normalizeMetricsPerFte(metrics, row.fteAtPeriod),
    source,
  };
}

/** หา archived row ของ staff ในเดือน */
function findArchivedRow(
  rows: readonly StaffWorkloadMonthlySnapshot[],
  staffId: string,
  yearMonth: string,
): StaffWorkloadMonthlySnapshot | undefined {
  return rows.find((row) => row.staffId === staffId && row.yearMonth === yearMonth);
}

/** คำนวณ spread ต่อ metric ในกลุ่ม */
function computeGroupMetricSpreads(
  staffTrends: readonly StaffWorkloadTrend[],
  staffIds: readonly string[],
  pickMetrics: (trend: StaffWorkloadTrend) => WorkloadMetrics,
): Readonly<Record<keyof WorkloadMetrics, GroupMetricSpread>> {
  const spreads = {} as Record<keyof WorkloadMetrics, GroupMetricSpread>;

  for (const key of METRIC_KEYS) {
    const values = new Map<string, number>();
    for (const staffId of staffIds) {
      const trend = staffTrends.find((entry) => entry.staffId === staffId);
      if (!trend) {
        continue;
      }
      values.set(staffId, pickMetrics(trend)[key]);
    }

    const spread = computeSpread(values);
    spreads[key] = {
      min: roundFairnessMetric(spread.min),
      max: roundFairnessMetric(spread.max),
      mean: roundFairnessMetric(spread.mean),
      spread: roundFairnessMetric(spread.spread),
    };
  }

  return spreads;
}

/** หาคนที่เกิน tolerance ในกลุ่ม */
function findOutOfToleranceStaff(
  staffTrends: readonly StaffWorkloadTrend[],
  staffIds: readonly string[],
  toleranceHours: number,
): readonly OutOfToleranceStaff[] {
  const values = new Map<string, number>();
  for (const staffId of staffIds) {
    const trend = staffTrends.find((entry) => entry.staffId === staffId);
    if (trend) {
      values.set(staffId, trend.fairnessMetric);
    }
  }

  const spread = computeSpread(values);
  const mean = spread.mean;
  const out: OutOfToleranceStaff[] = [];

  for (const staffId of staffIds) {
    const trend = staffTrends.find((entry) => entry.staffId === staffId);
    const value = values.get(staffId);
    if (!trend || value === undefined) {
      continue;
    }

    const deviation = Math.abs(value - mean);
    if (deviation > toleranceHours) {
      out.push({
        staffId,
        staffCode: trend.staffCode,
        displayName: trend.displayName,
        value: roundFairnessMetric(value),
        groupMean: roundFairnessMetric(mean),
        deviation: roundFairnessMetric(deviation),
      });
    }
  }

  return out.sort((left, right) => right.deviation - left.deviation);
}

/** สร้าง monthly rows ย้อนหลัง + รอบปัจจุบัน */
function buildStaffMonthlyRows(
  input: WorkloadStatsInput,
  meta: StaffDisplayMeta,
): {
  readonly monthlyRows: readonly StaffWorkloadMonthRow[];
  readonly currentCycle?: StaffWorkloadMonthRow;
  readonly lookbackMonthsPresent: number;
} {
  const archivedRows = input.engineInput.staffWorkloadMonthly ?? [];
  const historyAssignments = input.engineInput.assignments.filter(
    (assignment) => assignment.scheduleDate < (input.currentCycle?.periodStart ?? "9999-99-99"),
  );

  const monthlyInput: WorkloadMonthlyInput = {
    staff: input.engineInput.staff,
    shiftCodes: input.engineInput.shiftCodes,
    assignments: historyAssignments,
    holidayDates: input.engineInput.holidayDates,
    plannedNonWorkingDays: input.engineInput.plannedNonWorkingDays,
  };

  const monthlyRows: StaffWorkloadMonthRow[] = [];
  let lookbackMonthsPresent = 0;

  for (const yearMonth of input.fairnessLookbackMonths) {
    if (input.currentCycle && yearMonth === input.currentCycle.yearMonth) {
      continue;
    }

    const archived = findArchivedRow(archivedRows, meta.staffId, yearMonth);
    if (archived) {
      monthlyRows.push(monthRowFromArchived(archived));
      lookbackMonthsPresent += 1;
      continue;
    }

    const computed = computeStaffWorkloadMonthlyForMonth(monthlyInput, meta.staffId, yearMonth);
    if (computed) {
      monthlyRows.push(monthRowFromComputed(computed, "COMPUTED"));
      lookbackMonthsPresent += 1;
    }
  }

  let currentCycle: StaffWorkloadMonthRow | undefined;
  if (input.currentCycle && input.currentCycleAssignments) {
    const liveInput: WorkloadMonthlyInput = {
      staff: input.engineInput.staff,
      shiftCodes: input.engineInput.shiftCodes,
      assignments: input.currentCycleAssignments,
      holidayDates: input.engineInput.holidayDates,
      plannedNonWorkingDays: input.currentCyclePlannedOff,
    };
    const liveRow = computeStaffWorkloadMonthlyForMonth(
      liveInput,
      meta.staffId,
      input.currentCycle.yearMonth,
    );
    if (liveRow) {
      currentCycle = monthRowFromComputed(liveRow, "CURRENT_CYCLE");
    }
  }

  return { monthlyRows, currentCycle, lookbackMonthsPresent };
}

/** สร้าง snapshot workload สำหรับ UI และ carry-over solver */
export function buildWorkloadStatsSnapshot(input: WorkloadStatsInput): WorkloadStatsSnapshot {
  const fairParams = resolveFairDistributionParams(input.engineInput.ruleInstances);
  const otLimit = resolveOtLimitParams(input.engineInput.ruleInstances);
  const fairDimension = fairParams?.dimension ?? "TOTAL_HOURS";
  const toleranceHours = fairParams?.toleranceHours ?? 4;
  const lookbackMonths = fairParams?.lookbackMonths ?? input.fairnessLookbackMonths.length;

  const engineForFairness: ScheduleEngineInput = {
    ...input.engineInput,
    cycleStartDate: input.currentCycle?.periodStart ?? input.engineInput.cycleStartDate,
    cycleEndDate: input.currentCycle?.periodEnd ?? input.engineInput.cycleEndDate,
    assignments: [
      ...input.engineInput.assignments.filter(
        (assignment) =>
          !input.currentCycle ||
          assignment.scheduleDate < input.currentCycle.periodStart ||
          assignment.scheduleDate > input.currentCycle.periodEnd,
      ),
      ...(input.currentCycleAssignments ?? []),
    ],
  };

  const validationContext = buildValidationContext(engineForFairness);
  const groupLabels = new Map(input.staffGroups.map((group) => [group.id, group.displayName]));

  const carryOverOffsets: Record<string, number> = {};
  const staffTrends: StaffWorkloadTrend[] = [];

  for (const meta of input.staffMeta) {
    const { monthlyRows, currentCycle, lookbackMonthsPresent } = buildStaffMonthlyRows(input, meta);

    const lookbackTotals = sumMetrics(monthlyRows);
    const lookbackTotalsPerFte = normalizeMetricsPerFte(lookbackTotals, meta.fte);

    const carryOverOffset = fairParams
      ? computeStaffHourOffset(engineForFairness, meta.staffId, fairParams)
      : 0;
    carryOverOffsets[meta.staffId] = carryOverOffset;

    const fairnessMetric = staffFairnessMetric(
      validationContext,
      meta.staffId,
      fairDimension,
      lookbackMonths,
      fairParams?.normalizeByFte ?? true,
    );

    staffTrends.push({
      staffId: meta.staffId,
      staffCode: meta.staffCode,
      displayName: meta.displayName,
      staffGroupId: meta.staffGroupId,
      staffGroupName: meta.staffGroupId ? groupLabels.get(meta.staffGroupId) : undefined,
      fte: meta.fte,
      targetHoursPerMonth: meta.targetHoursPerMonth,
      lookbackMonthsPresent,
      lookbackMonthsExpected: input.fairnessLookbackMonths.filter(
        (yearMonth) => !input.currentCycle || yearMonth !== input.currentCycle.yearMonth,
      ).length,
      monthlyRows,
      currentCycle,
      lookbackTotals,
      lookbackTotalsPerFte,
      carryOverOffset,
      fairnessMetric: roundFairnessMetric(fairnessMetric),
    });
  }

  staffTrends.sort((left, right) => {
    const groupCompare = (left.staffGroupName ?? "").localeCompare(right.staffGroupName ?? "");
    if (groupCompare !== 0) {
      return groupCompare;
    }
    return left.displayName.localeCompare(right.displayName, "th");
  });

  const fairnessReports =
    fairParams &&
    computeGroupFairnessReports(
      engineForFairness,
      fairParams.dimension,
      fairParams.scope,
      lookbackMonths,
      fairParams.normalizeByFte,
    );

  const groupKeys = new Map<string, string>();
  for (const meta of input.staffMeta) {
    const key = meta.staffGroupId ?? "__ungrouped__";
    const name =
      meta.staffGroupId && groupLabels.has(meta.staffGroupId)
        ? (groupLabels.get(meta.staffGroupId) ?? key)
        : "ไม่ระบุกลุ่ม";
    groupKeys.set(key, name);
  }

  const groupStats: GroupWorkloadStats[] = [];
  for (const [groupKey, groupName] of [...groupKeys.entries()].sort((left, right) =>
    left[1].localeCompare(right[1], "th"),
  )) {
    const staffIds = staffTrends
      .filter((trend) => (trend.staffGroupId ?? "__ungrouped__") === groupKey)
      .map((trend) => trend.staffId);

    if (staffIds.length === 0) {
      continue;
    }

    groupStats.push({
      groupKey,
      groupName,
      staffCount: staffIds.length,
      lookbackSpreads: computeGroupMetricSpreads(
        staffTrends,
        staffIds,
        (trend) => trend.lookbackTotalsPerFte,
      ),
      currentCycleSpreads:
        input.currentCycle &&
        computeGroupMetricSpreads(staffTrends, staffIds, (trend) =>
          trend.currentCycle ? trend.currentCycle.perFte : EMPTY_METRICS,
        ),
      fairnessReport: fairnessReports?.get(groupKey),
      outOfTolerance: fairParams
        ? findOutOfToleranceStaff(staffTrends, staffIds, toleranceHours)
        : [],
    });
  }

  return {
    asOfDate: input.asOfDate,
    fairnessLookbackMonths: input.fairnessLookbackMonths,
    fairParams,
    fairDimension,
    toleranceHours,
    maxOtHoursPerStaff: otLimit.maxOtHoursPerStaffPerCycle,
    currentCycle: input.currentCycle,
    staffTrends,
    groupStats,
    carryOverOffsets,
  };
}

/** คำนวณสดจาก draft assignments — ใช้ใน canvas เมื่อแก้เซลล์ */
export function recomputeWorkloadStatsFromDraft(
  base: WorkloadStatsSnapshot,
  draftInput: Pick<
    WorkloadStatsInput,
    "currentCycleAssignments" | "currentCyclePlannedOff" | "engineInput"
  > &
    Partial<
      Pick<
        WorkloadStatsInput,
        "staffMeta" | "staffGroups" | "fairnessLookbackMonths" | "asOfDate" | "currentCycle"
      >
    >,
): WorkloadStatsSnapshot {
  return buildWorkloadStatsSnapshot({
    asOfDate: draftInput.asOfDate ?? base.asOfDate,
    fairnessLookbackMonths: draftInput.fairnessLookbackMonths ?? base.fairnessLookbackMonths,
    staffMeta:
      draftInput.staffMeta ??
      base.staffTrends.map((trend) => ({
        staffId: trend.staffId,
        staffCode: trend.staffCode,
        displayName: trend.displayName,
        staffGroupId: trend.staffGroupId,
        staffGroupName: trend.staffGroupName,
        fte: trend.fte,
        targetHoursPerMonth: trend.targetHoursPerMonth,
      })),
    staffGroups:
      draftInput.staffGroups ??
      base.groupStats.map((group) => ({
        id: group.groupKey === "__ungrouped__" ? "" : group.groupKey,
        code: group.groupKey,
        displayName: group.groupName,
      })),
    engineInput: draftInput.engineInput,
    currentCycle: draftInput.currentCycle ?? base.currentCycle,
    currentCycleAssignments: draftInput.currentCycleAssignments,
    currentCyclePlannedOff: draftInput.currentCyclePlannedOff,
  });
}

/** สร้าง yearMonth list จาก cycle start — helper สำหรับ loader */
export function workloadLookbackMonthsFromCycle(
  cycleStartDate: string,
  lookbackCount: number,
): readonly string[] {
  return lookbackYearMonths(cycleStartDate, lookbackCount);
}

/** สร้าง CSV จาก snapshot — ใช้หลัง filter RBAC แล้ว */
export function formatWorkloadStatsCsv(snapshot: WorkloadStatsSnapshot): string {
  const headers = [
    "staff_code",
    "display_name",
    "staff_group",
    "year_month",
    "planned_hours",
    "ot_hours",
    "night_count",
    "weekend_count",
    "holiday_count",
    "worked_days",
    "days_off",
    "fte",
    "carry_over_offset",
    "fairness_metric",
  ];

  const rows: string[] = [headers.join(",")];

  for (const trend of snapshot.staffTrends) {
    for (const row of trend.monthlyRows) {
      rows.push(
        [
          trend.staffCode,
          `"${trend.displayName.replaceAll('"', '""')}"`,
          `"${(trend.staffGroupName ?? "").replaceAll('"', '""')}"`,
          row.yearMonth,
          row.plannedHours,
          row.otHours,
          row.nightCount,
          row.weekendCount,
          row.holidayCount,
          row.workedDays,
          row.daysOff,
          row.fteAtPeriod,
          trend.carryOverOffset,
          trend.fairnessMetric,
        ].join(","),
      );
    }

    if (trend.currentCycle) {
      rows.push(
        [
          trend.staffCode,
          `"${trend.displayName.replaceAll('"', '""')}"`,
          `"${(trend.staffGroupName ?? "").replaceAll('"', '""')}"`,
          `${trend.currentCycle.yearMonth}*`,
          trend.currentCycle.plannedHours,
          trend.currentCycle.otHours,
          trend.currentCycle.nightCount,
          trend.currentCycle.weekendCount,
          trend.currentCycle.holidayCount,
          trend.currentCycle.workedDays,
          trend.currentCycle.daysOff,
          trend.currentCycle.fteAtPeriod,
          trend.carryOverOffset,
          trend.fairnessMetric,
        ].join(","),
      );
    }
  }

  return `${rows.join("\n")}\n`;
}

/** รวม assignments ใน history window เป็น monthly archive สำหรับเดือนที่ยังไม่มีแถว */
export function backfillWorkloadMonthlyFromAssignments(
  input: WorkloadMonthlyInput,
  yearMonths: readonly string[],
  existingRows: readonly StaffWorkloadMonthlySnapshot[],
): readonly StaffWorkloadMonthlySnapshot[] {
  const computed = aggregateStaffWorkloadMonthly(input, yearMonths);
  const merged = new Map<string, StaffWorkloadMonthlySnapshot>();

  for (const row of existingRows) {
    merged.set(`${row.staffId}:${row.yearMonth}`, row);
  }

  for (const row of computed) {
    const key = `${row.staffId}:${row.yearMonth}`;
    if (!merged.has(key)) {
      merged.set(key, row);
    }
  }

  return [...merged.values()].sort((left, right) => {
    const monthCompare = left.yearMonth.localeCompare(right.yearMonth);
    if (monthCompare !== 0) {
      return monthCompare;
    }
    return left.staffId.localeCompare(right.staffId);
  });
}
