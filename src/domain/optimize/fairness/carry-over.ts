import {
  buildToleranceLadder,
  type ConvexCostLadder,
  FLOW_COST_SCALE,
} from "@/domain/optimize/flow";
import {
  type FairnessDimension,
  type FairnessScope,
  groupStaffIdsByScope,
  staffFairnessMetric,
} from "@/domain/rules/helpers/schedule-metrics";
import type {
  RuleInstanceSnapshot,
  ScheduleEngineInput,
  StaffSnapshot,
} from "@/domain/schedule/types";
import { buildValidationContext } from "@/domain/schedule/validate";

/** พารามิเตอร์ FAIR_DISTRIBUTION ที่ solver ใช้ */
export type FairDistributionParams = {
  readonly dimension: FairnessDimension;
  readonly scope: FairnessScope;
  readonly toleranceHours: number;
  readonly normalizeByFte: boolean;
  readonly lookbackMonths: number;
};

const DEFAULT_FAIR_PARAMS: FairDistributionParams = {
  dimension: "TOTAL_HOURS",
  scope: "GROUP",
  toleranceHours: 4,
  normalizeByFte: true,
  lookbackMonths: 6,
};

/** อ่าน FAIR_DISTRIBUTION จาก rule instances */
export function resolveFairDistributionParams(
  ruleInstances: readonly RuleInstanceSnapshot[],
): FairDistributionParams | undefined {
  const rule = ruleInstances.find(
    (instance) => instance.enabled && instance.ruleTemplateId === "FAIR_DISTRIBUTION",
  );
  if (!rule) {
    return undefined;
  }

  const params = rule.params as Partial<FairDistributionParams>;
  return {
    dimension: params.dimension ?? DEFAULT_FAIR_PARAMS.dimension,
    scope: params.scope ?? DEFAULT_FAIR_PARAMS.scope,
    toleranceHours: params.toleranceHours ?? DEFAULT_FAIR_PARAMS.toleranceHours,
    normalizeByFte: params.normalizeByFte ?? DEFAULT_FAIR_PARAMS.normalizeByFte,
    lookbackMonths: params.lookbackMonths ?? DEFAULT_FAIR_PARAMS.lookbackMonths,
  };
}

/** คำนวณ offset ชั่วโมง (carry-over) สำหรับขั้นบันได convex ต่อ staff */
export function computeStaffHourOffset(
  input: ScheduleEngineInput,
  staffId: string,
  fairParams: FairDistributionParams,
): number {
  const context = buildValidationContext(input);
  const staffMetric = staffFairnessMetric(
    context,
    staffId,
    fairParams.dimension,
    fairParams.lookbackMonths,
    fairParams.normalizeByFte,
  );

  const groups = groupStaffIdsByScope(context, fairParams.scope);
  const staff = context.staffById.get(staffId);
  const groupKey =
    fairParams.scope === "GROUP" ? (staff?.staffGroupId ?? "__ungrouped__") : "__org__";
  const peerIds = groups.get(groupKey) ?? [];

  if (peerIds.length === 0) {
    return 0;
  }

  const peerMetrics = peerIds.map((peerId) =>
    staffFairnessMetric(
      context,
      peerId,
      fairParams.dimension,
      fairParams.lookbackMonths,
      fairParams.normalizeByFte,
    ),
  );
  const groupMean = peerMetrics.reduce((sum, value) => sum + value, 0) / peerMetrics.length;

  // offset = ส่วนที่สูงกว่าค่ากลางกลุ่ม — คนใหม่ไม่มีประวัติจะได้ค่าใกล้ mean
  return Math.max(0, Math.round((staffMetric - groupMean) * 100) / 100);
}

/** สร้างขั้นบันได convex ต่อ staff สำหรับ Stage B (หน่วยชั่วโมง) */
export function buildStaffConvexLadder(
  input: ScheduleEngineInput,
  staff: StaffSnapshot,
  maxHours: number,
  fairParams: FairDistributionParams | undefined,
): ConvexCostLadder {
  const offset = fairParams ? computeStaffHourOffset(input, staff.id, fairParams) : 0;
  const toleranceHours = fairParams?.toleranceHours ?? 4;

  return buildToleranceLadder({
    offset,
    maxUnits: Math.max(1, Math.ceil(maxHours)),
    toleranceUnits: Math.max(1, Math.ceil(toleranceHours)),
    baseMarginalCost: FLOW_COST_SCALE,
    costIncrementPerUnit: FLOW_COST_SCALE,
  });
}

/** สร้างขั้นบันได convex ต่อ staff บน arc staff→sink (หน่วยเวร) */
export function buildStaffShiftLadder(
  input: ScheduleEngineInput,
  staff: StaffSnapshot,
  maxShifts: number,
  avgShiftHours: number,
  fairParams: FairDistributionParams | undefined,
): ConvexCostLadder {
  const safeAvgHours = Math.max(avgShiftHours, 1);
  const offset = fairParams
    ? Math.round(computeStaffHourOffset(input, staff.id, fairParams) / safeAvgHours)
    : 0;
  const toleranceHours = fairParams?.toleranceHours ?? 4;

  return buildToleranceLadder({
    offset,
    maxUnits: Math.max(1, maxShifts),
    toleranceUnits: Math.max(1, Math.round(toleranceHours / safeAvgHours)),
    baseMarginalCost: FLOW_COST_SCALE,
    costIncrementPerUnit: FLOW_COST_SCALE,
  });
}
