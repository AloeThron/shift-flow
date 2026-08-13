import {
  type FairnessDimension,
  type FairnessScope,
  groupStaffIdsByScope,
  staffFairnessMetric,
} from "@/domain/rules/helpers/schedule-metrics";
import type { ScheduleEngineInput } from "@/domain/schedule/types";
import { buildValidationContext } from "@/domain/schedule/validate";

/** สรุป spread ของค่าในกลุ่ม */
export type SpreadSummary = {
  readonly min: number;
  readonly max: number;
  readonly spread: number;
  readonly mean: number;
  readonly values: ReadonlyMap<string, number>;
};

/** รายงาน fairness ต่อกลุ่ม */
export type GroupFairnessReport = {
  readonly groupKey: string;
  readonly staffCount: number;
  readonly spread: SpreadSummary;
  readonly gini: number;
  readonly spreadPerFte: number;
};

/** snapshot สำหรับ golden regression */
export type FairnessSnapshot = {
  readonly dimension: FairnessDimension;
  readonly scope: FairnessScope;
  readonly lookbackMonths: number;
  readonly normalizeByFte: boolean;
  readonly cycleStartDate: string;
  readonly cycleEndDate: string;
  readonly groups: Readonly<Record<string, GroupFairnessSnapshotEntry>>;
};

export type GroupFairnessSnapshotEntry = {
  readonly staffCount: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly spread: number;
  readonly gini: number;
  readonly spreadPerFte: number;
};

/** ปัด metric สำหรับ snapshot */
export function roundFairnessMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

/** คำนวณ min/max/spread/mean จาก map staff → value */
export function computeSpread(values: ReadonlyMap<string, number>): SpreadSummary {
  const entries = [...values.entries()];
  if (entries.length === 0) {
    return { min: 0, max: 0, spread: 0, mean: 0, values };
  }

  const numericValues = entries.map(([, value]) => value);
  const min = Math.min(...numericValues);
  const max = Math.max(...numericValues);
  const mean = numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;

  return {
    min,
    max,
    spread: max - min,
    mean,
    values,
  };
}

/** คoefficient Gini — 0 = เท่ากันทุกคน */
export function computeGini(values: readonly number[]): number {
  if (values.length <= 1) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return 0;
  }

  let weighted = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    weighted += (index + 1) * sorted[index];
  }

  const n = sorted.length;
  return (2 * weighted) / (n * total) - (n + 1) / n;
}

/** คำนวณ spread ต่อกลุ่มตามมิติ fairness */
export function computeGroupFairnessSpread(
  input: ScheduleEngineInput,
  dimension: FairnessDimension,
  scope: FairnessScope,
  lookbackMonths: number,
  normalizeByFte: boolean,
): ReadonlyMap<string, SpreadSummary> {
  const reports = computeGroupFairnessReports(
    input,
    dimension,
    scope,
    lookbackMonths,
    normalizeByFte,
  );
  return new Map([...reports.entries()].map(([key, report]) => [key, report.spread]));
}

/** คำนวณรายงาน fairness ครบต่อกลุ่ม */
export function computeGroupFairnessReports(
  input: ScheduleEngineInput,
  dimension: FairnessDimension,
  scope: FairnessScope,
  lookbackMonths: number,
  normalizeByFte: boolean,
): ReadonlyMap<string, GroupFairnessReport> {
  const context = buildValidationContext(input);
  const groups = groupStaffIdsByScope(context, scope);
  const reports = new Map<string, GroupFairnessReport>();

  for (const [groupKey, staffIds] of groups) {
    const values = new Map<string, number>();
    for (const staffId of staffIds) {
      values.set(
        staffId,
        staffFairnessMetric(context, staffId, dimension, lookbackMonths, normalizeByFte),
      );
    }

    const spread = computeSpread(values);
    const gini = computeGini([...values.values()]);
    const meanFte =
      staffIds.reduce((sum, staffId) => sum + (context.staffById.get(staffId)?.fte ?? 1), 0) /
      Math.max(1, staffIds.length);
    const spreadPerFte = meanFte > 0 ? spread.spread / meanFte : spread.spread;

    reports.set(groupKey, {
      groupKey,
      staffCount: staffIds.length,
      spread,
      gini,
      spreadPerFte,
    });
  }

  return reports;
}

/** สร้าง snapshot สำหรับ golden regression */
export function buildFairnessSnapshot(
  input: ScheduleEngineInput,
  params: {
    dimension: FairnessDimension;
    scope: FairnessScope;
    lookbackMonths: number;
    normalizeByFte: boolean;
  },
): FairnessSnapshot {
  const reports = computeGroupFairnessReports(
    input,
    params.dimension,
    params.scope,
    params.lookbackMonths,
    params.normalizeByFte,
  );

  const groups: Record<string, GroupFairnessSnapshotEntry> = {};
  for (const [groupKey, report] of [...reports.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    groups[groupKey] = {
      staffCount: report.staffCount,
      min: roundFairnessMetric(report.spread.min),
      max: roundFairnessMetric(report.spread.max),
      mean: roundFairnessMetric(report.spread.mean),
      spread: roundFairnessMetric(report.spread.spread),
      gini: roundFairnessMetric(report.gini),
      spreadPerFte: roundFairnessMetric(report.spreadPerFte),
    };
  }

  return {
    dimension: params.dimension,
    scope: params.scope,
    lookbackMonths: params.lookbackMonths,
    normalizeByFte: params.normalizeByFte,
    cycleStartDate: input.cycleStartDate,
    cycleEndDate: input.cycleEndDate,
    groups,
  };
}
