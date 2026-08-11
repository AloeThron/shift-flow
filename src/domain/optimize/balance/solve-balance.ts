import {
    buildStaffShiftLadder,
    resolveFairDistributionParams,
} from "@/domain/optimize/fairness/carry-over";
import {
    buildToleranceLadder,
    expandConvexLadderToArcs,
    FLOW_COST_SCALE,
    solveMinCostFlow,
    sortArcsDeterministic,
} from "@/domain/optimize/flow";
import type { FlowArcInput, FlowNodeId, MinCostFlowProblem } from "@/domain/optimize/flow/types";
import { assignmentOtHours } from "@/domain/rules/helpers/schedule-metrics";
import { buildAssignmentInterval } from "@/domain/schedule/time";
import type { ScheduleAssignment, ShiftCodeSnapshot } from "@/domain/schedule/types";

import {
    buildBalanceSlots,
    buildFillPools,
    createSlotValidationContext,
    listEligibleStaffForSlot,
    listFillArcOptions,
    otArcPenaltyCost,
    summarizeMandatorySlotBlockReasons,
    type MandatorySlotBlockSummary,
    type SlotValidationContext,
} from "./build-slot-graph";
import type {
    ArcCostAdjustment,
    BalancePlanInput,
    BalancePlanResult,
    BalanceShiftCodeRef,
    BalanceSlot,
    FillPool,
    OtLimitParams,
    StaffSlotBlockReason,
} from "./types";
import { FILL_SKIP_PENALTY, resolveOtLimitParams } from "./types";

const SOLVER_VERSION = "stage-b-min-cost-flow@1";

const SOURCE_NODE = "stage-b::source";
const SINK_NODE = "stage-b::sink";
const RELIEF_ARC_ID = "relief::skip-fill";

/** เกลี่ยงาน Stage B ด้วย min-cost flow + convex cost */
export function solveBalance(
  input: BalancePlanInput,
  arcCostAdjustments: readonly ArcCostAdjustment[] = [],
): BalancePlanResult {
  const mandatorySlots = buildBalanceSlots(input);
  const fillPools = buildFillPools(input, mandatorySlots);
  const fillEnabled = input.fillEveryAvailableCell !== false;
  const totalFillCount = fillPools.reduce((sum, pool) => sum + pool.count, 0);
  const pinnedAssignments = input.assignments.filter((assignment) => assignment.isPinned === true);
  const mutableInput: BalancePlanInput = {
    ...input,
    assignments: [...input.assignments.filter((assignment) => assignment.isPinned !== true)],
  };

  const emptyResult = (overrides: Partial<BalancePlanResult> = {}): BalancePlanResult => ({
    feasible: true,
    assignments: [...pinnedAssignments],
    unfilledMandatorySlotIds: [],
    filledCellCount: 0,
    skippedFillSlotCount: 0,
    totalCost: 0,
    solverVersion: SOLVER_VERSION,
    ...overrides,
  });

  if (mandatorySlots.length === 0 && (!fillEnabled || totalFillCount === 0)) {
    return emptyResult();
  }

  const validationCtx = createSlotValidationContext(mutableInput);
  const mandatoryBlockSummary = summarizeMandatorySlotBlockReasons(
    mutableInput,
    mandatorySlots,
    validationCtx,
  );
  const graph = buildBalanceFlowGraph({
    input: mutableInput,
    mandatorySlots,
    fillPools,
    arcCostAdjustments,
    validationCtx,
  });

  if (graph.totalSupply === 0) {
    const unfilled = graph.preUnfilledMandatorySlotIds;
    if (unfilled.length === 0) {
      return emptyResult();
    }
    return {
      feasible: false,
      assignments: [...pinnedAssignments],
      unfilledMandatorySlotIds: unfilled,
      filledCellCount: 0,
      skippedFillSlotCount: totalFillCount,
      totalCost: 0,
      solverVersion: SOLVER_VERSION,
      messageTh: buildUnfilledMandatoryMessage(
        unfilled.length,
        0,
        unfilled.length,
        mandatoryBlockSummary,
      ),
    };
  }

  const solution = solveMinCostFlow(graph.problem);

  if (!solution.feasible) {
    return {
      feasible: false,
      assignments: [...pinnedAssignments, ...mutableInput.assignments],
      unfilledMandatorySlotIds: [
        ...graph.preUnfilledMandatorySlotIds,
        ...mandatorySlots
          .map((slot) => slot.id)
          .filter((id) => !graph.preUnfilledMandatorySlotIds.includes(id)),
      ],
      filledCellCount: 0,
      skippedFillSlotCount: totalFillCount,
      totalCost: solution.totalCost,
      solverVersion: SOLVER_VERSION,
      messageTh:
        "Stage B min-cost flow ไม่ feasible — จำนวน demand ต่อวันเกิน staff ที่ว่างหรือ capacity ขัดแย้ง",
    };
  }

  const extracted = extractAssignments({
    input: mutableInput,
    mandatorySlots,
    fillPools,
    flows: solution.flows,
    preUnfilledMandatorySlotIds: graph.preUnfilledMandatorySlotIds,
  });

  const unfilledMandatorySlotIds = mergeUnfilledMandatoryIds(
    graph.preUnfilledMandatorySlotIds,
    extracted.unfilledMandatorySlotIds,
  );

  return {
    feasible: unfilledMandatorySlotIds.length === 0,
    assignments: [...pinnedAssignments, ...mutableInput.assignments, ...extracted.assignments],
    unfilledMandatorySlotIds,
    filledCellCount: extracted.filledCellCount,
    skippedFillSlotCount: extracted.skippedFillSlotCount,
    totalCost: solution.totalCost,
    solverVersion: SOLVER_VERSION,
    messageTh:
      unfilledMandatorySlotIds.length > 0
        ? buildUnfilledMandatoryMessage(
            graph.preUnfilledMandatorySlotIds.length,
            extracted.unfilledMandatorySlotIds.length,
            unfilledMandatorySlotIds.length,
            mandatoryBlockSummary,
          )
        : undefined,
  };
}

/** ข้อความเมื่อ slot บังคับเติมไม่ครบ */
function buildUnfilledMandatoryMessage(
  preUnfilledCount: number,
  solverUnfilledCount: number,
  uniqueCount: number,
  blockSummary?: MandatorySlotBlockSummary,
): string {
  const reasonHint = formatMandatoryBlockReasonHint(blockSummary);

  if (preUnfilledCount > 0 && solverUnfilledCount === 0) {
    return `ยังเติม slot บังคับไม่ครบ ${uniqueCount} ช่อง — ไม่มี staff ผ่านสิทธิรหัสเวร/ว่างสำหรับ demand เหล่านี้${reasonHint}`;
  }

  if (preUnfilledCount > 0 && solverUnfilledCount > 0) {
    return `ยังเติม slot บังคับไม่ครบ ${uniqueCount} ช่อง — ${preUnfilledCount} ช่องไม่มีคน eligible${reasonHint}, ${solverUnfilledCount} ช่อง solver จัดไม่ได้ (capacity/ขัดแย้ง)`;
  }

  return `ยังเติม slot บังคับไม่ครบ ${uniqueCount} ช่อง — ตรวจสิทธิรหัสเวรหมดอายุ รหัสยังไม่ยืนยัน หรือ staff ว่างไม่พอ${reasonHint}`;
}

/** สรุป block reason เป็นข้อความสั้นใน error Stage B */
function formatMandatoryBlockReasonHint(summary?: MandatorySlotBlockSummary): string {
  if (!summary || summary.total === 0) {
    return " (ตรวจสิทธิหมดอายุ รหัสยังไม่ยืนยัน หรือวันหยุด Stage A)";
  }

  const labels: Partial<Record<StaffSlotBlockReason, string>> = {
    SHIFT_AUTH: "สิทธิรหัสเวร",
    GRADE: "grade ไม่ตรง",
    PLANNED_OFF: "วันหยุด Stage A",
    APPROVED_LEAVE: "ลาอนุมัติ",
    PINNED: "เวร pin",
    OVERLAP: "เวลาทับ",
    LOCKED_DAY_OFF: "วันหยุดล็อก",
  };

  const parts = (Object.entries(summary.byReason) as [StaffSlotBlockReason, number][])
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1])
    .map(([reason, count]) => `${labels[reason] ?? reason} ${count} ช่อง`);

  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}

/** รวม id slot บังคับที่ว่าง — ไม่นับซ้ำระหว่าง pre-unfilled กับ extract */
function mergeUnfilledMandatoryIds(
  preUnfilled: readonly string[],
  extracted: readonly string[],
): readonly string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const slotId of [...preUnfilled, ...extracted]) {
    if (seen.has(slotId)) {
      continue;
    }
    seen.add(slotId);
    merged.push(slotId);
  }

  return merged.sort((left, right) => left.localeCompare(right));
}

/** สร้างกราฟ source → slot/pool → staffDay → staff → sink */
function buildBalanceFlowGraph(args: {
  input: BalancePlanInput;
  mandatorySlots: readonly BalanceSlot[];
  fillPools: readonly FillPool[];
  arcCostAdjustments: readonly ArcCostAdjustment[];
  validationCtx: SlotValidationContext;
}): {
  problem: MinCostFlowProblem;
  totalSupply: number;
  preUnfilledMandatorySlotIds: readonly string[];
} {
  const shiftCodeById = new Map(args.input.shiftCodes.map((code) => [code.id, code]));
  const fairParams = resolveFairDistributionParams(args.input.ruleInstances);
  const otLimit = resolveOtLimitParams(args.input.ruleInstances);
  const avgShiftHours = resolveAvgShiftHours(args.input.shiftCodes);
  const adjustmentMap = buildAdjustmentMap(args.arcCostAdjustments);
  const preUnfilledMandatory: string[] = [];

  const nodes = new Set<FlowNodeId>([SOURCE_NODE, SINK_NODE]);
  const arcs: FlowArcInput[] = [];
  const staffDayNodes = new Set<FlowNodeId>();
  let totalSupply = 0;

  const sortedStaff = [...args.input.staff].sort((left, right) => left.id.localeCompare(right.id));
  for (const member of sortedStaff) {
    nodes.add(staffNodeId(member.id));
    const maxShifts = resolveStaffMaxShifts(args.input, member, otLimit);
    const ladder = buildStaffShiftLadder(
      args.input,
      member,
      maxShifts,
      avgShiftHours,
      fairParams,
    );
    arcs.push(
      ...expandConvexLadderToArcs({
        from: staffNodeId(member.id),
        to: SINK_NODE,
        ladder,
        idPrefix: `capacity::${member.id}`,
      }),
    );
  }

  const totalFillCount = args.fillPools.reduce((sum, pool) => sum + pool.count, 0);
  if (totalFillCount > 0) {
    arcs.push({
      id: RELIEF_ARC_ID,
      from: SOURCE_NODE,
      to: SINK_NODE,
      upperBound: totalFillCount,
      cost: FILL_SKIP_PENALTY,
    });
  }

  const sortedMandatorySlots = [...args.mandatorySlots].sort((left, right) =>
    left.id.localeCompare(right.id),
  );

  for (const slot of sortedMandatorySlots) {
    const slotNode = slotNodeId(slot.id);

    const shiftCode = slot.shiftCodeId ? shiftCodeById.get(slot.shiftCodeId) : undefined;
    if (!shiftCode) {
      preUnfilledMandatory.push(slot.id);
      continue;
    }

    const eligibleStaff = listEligibleStaffForSlot(
      args.input,
      slot,
      shiftCodeById,
      args.validationCtx,
    );
    if (eligibleStaff.length === 0) {
      preUnfilledMandatory.push(slot.id);
      continue;
    }

    nodes.add(slotNode);
    arcs.push({
      id: `supply::${slot.id}`,
      from: SOURCE_NODE,
      to: slotNode,
      lowerBound: 1,
      upperBound: 1,
      cost: 0,
    });
    totalSupply += 1;

    addMandatoryAssignmentArcs({
      arcs,
      staffDayNodes,
      slot,
      shiftCode,
      eligibleStaff,
      avgShiftHours,
      adjustmentMap,
    });
  }

  const sortedFillPools = [...args.fillPools].sort((left, right) =>
    left.scheduleDate.localeCompare(right.scheduleDate),
  );

  for (const pool of sortedFillPools) {
    addFillPoolArcs({
      arcs,
      nodes,
      staffDayNodes,
      pool,
      input: args.input,
      avgShiftHours,
      adjustmentMap,
      shiftCodeById,
      validationCtx: args.validationCtx,
    });
    nodes.add(fillPoolNodeId(pool.scheduleDate));
    arcs.push({
      id: `supply::${pool.id}`,
      from: SOURCE_NODE,
      to: fillPoolNodeId(pool.scheduleDate),
      upperBound: pool.count,
      cost: 0,
    });
    totalSupply += pool.count;
  }

  for (const staffDayNode of staffDayNodes) {
    nodes.add(staffDayNode);
    const staffId = parseStaffDayNode(staffDayNode)?.staffId;
    if (!staffId) {
      continue;
    }
    arcs.push({
      id: `staff-day::${staffId}::${parseStaffDayNode(staffDayNode)?.date ?? "unknown"}`,
      from: staffDayNode,
      to: staffNodeId(staffId),
      upperBound: 1,
      cost: 0,
    });
  }

  const problem: MinCostFlowProblem = {
    nodes: [...nodes].sort((left, right) => left.localeCompare(right)),
    arcs: sortArcsDeterministic(arcs),
    supplies: {
      [SOURCE_NODE]: totalSupply,
      [SINK_NODE]: -totalSupply,
    },
  };

  return {
    problem,
    totalSupply,
    preUnfilledMandatorySlotIds: preUnfilledMandatory.sort((left, right) =>
      left.localeCompare(right),
    ),
  };
}

/** เพิ่ม arc จาก slot บังคับไป staffDay */
function addMandatoryAssignmentArcs(args: {
  arcs: FlowArcInput[];
  staffDayNodes: Set<FlowNodeId>;
  slot: BalanceSlot;
  shiftCode: BalanceShiftCodeRef;
  eligibleStaff: readonly BalancePlanInput["staff"][number][];
  avgShiftHours: number;
  adjustmentMap: ReadonlyMap<string, number>;
}): void {
  const slotNode = slotNodeId(args.slot.id);

  for (const member of args.eligibleStaff) {
    const staffDay = ensureStaffDayNode(args.staffDayNodes, member.id, args.slot.scheduleDate);
    const adjustment =
      args.adjustmentMap.get(
        adjustmentKey(member.id, args.slot.id, args.shiftCode.id),
      ) ?? 0;

    args.arcs.push({
      id: assignArcId(args.slot.id, member.id, args.shiftCode.id),
      from: slotNode,
      to: staffDay,
      upperBound: 1,
      cost: computeAssignmentArcCost({
        standardHours: args.shiftCode.standardHours,
        avgShiftHours: args.avgShiftHours,
        otHours: args.shiftCode.otHours,
        adjustment,
      }),
    });
  }
}

/** เพิ่ม fillPool → fillCode ladder และ arc มอบหมาย */
function addFillPoolArcs(args: {
  arcs: FlowArcInput[];
  nodes: Set<FlowNodeId>;
  staffDayNodes: Set<FlowNodeId>;
  pool: FillPool;
  input: BalancePlanInput;
  avgShiftHours: number;
  adjustmentMap: ReadonlyMap<string, number>;
  shiftCodeById: ReadonlyMap<string, BalanceShiftCodeRef>;
  validationCtx: SlotValidationContext;
}): void {
  const poolNode = fillPoolNodeId(args.pool.scheduleDate);
  const codeLadder = buildToleranceLadder({
    offset: 0,
    maxUnits: args.pool.count,
    toleranceUnits: 1,
    baseMarginalCost: FLOW_COST_SCALE,
    costIncrementPerUnit: FLOW_COST_SCALE,
  });

  const shiftCodeIds = new Set<string>();
  for (const member of args.input.staff) {
    for (const option of listFillArcOptions(
      args.input,
      args.pool.scheduleDate,
      member,
      args.validationCtx,
    )) {
      shiftCodeIds.add(option.shiftCodeId);
    }
  }

  const sortedCodeIds = [...shiftCodeIds].sort((left, right) => left.localeCompare(right));
  for (const shiftCodeId of sortedCodeIds) {
    const codeNode = fillCodeNodeId(args.pool.scheduleDate, shiftCodeId);
    args.nodes.add(codeNode);
    args.arcs.push(
      ...expandConvexLadderToArcs({
        from: poolNode,
        to: codeNode,
        ladder: codeLadder,
        idPrefix: `fill-code-ladder::${args.pool.scheduleDate}::${shiftCodeId}`,
      }),
    );
  }

  for (const member of args.input.staff) {
    const options = listFillArcOptions(
      args.input,
      args.pool.scheduleDate,
      member,
      args.validationCtx,
    );
    if (options.length === 0) {
      continue;
    }

    const staffDay = ensureStaffDayNode(args.staffDayNodes, member.id, args.pool.scheduleDate);

    for (const option of options) {
      const shiftCode = args.shiftCodeById.get(option.shiftCodeId);
      if (!shiftCode) {
        continue;
      }

      const adjustment =
        args.adjustmentMap.get(
          adjustmentKey(member.id, args.pool.id, option.shiftCodeId),
        ) ?? 0;

      args.arcs.push({
        id: assignArcId(args.pool.id, member.id, option.shiftCodeId),
        from: fillCodeNodeId(args.pool.scheduleDate, option.shiftCodeId),
        to: staffDay,
        upperBound: 1,
        cost: computeAssignmentArcCost({
          standardHours: shiftCode.standardHours,
          avgShiftHours: args.avgShiftHours,
          otHours: shiftCode.otHours,
          adjustment,
        }),
      });
    }
  }
}

/** ต้นทุน arc slot/fillCode → staffDay — hour diff + OT + Lagrangian adjustment */
function computeAssignmentArcCost(args: {
  standardHours: number;
  avgShiftHours: number;
  otHours?: number;
  adjustment: number;
}): number {
  const hourDiffCost = Math.max(
    0,
    Math.round((args.standardHours - args.avgShiftHours) * FLOW_COST_SCALE),
  );
  return hourDiffCost + otArcPenaltyCost({ otHours: args.otHours }) + args.adjustment;
}

/** ชั่วโมงเฉลี่ยของรหัสเวร — ใช้แปลง carry-over เป็นหน่วยเวร */
function resolveAvgShiftHours(shiftCodes: readonly BalanceShiftCodeRef[]): number {
  return (
    shiftCodes.reduce((sum, code) => sum + Math.max(code.standardHours, 1), 0) /
    Math.max(1, shiftCodes.length)
  );
}

/** เพดานจำนวนเวรต่อ staff จาก OT_LIMIT และขนาดรอบ */
function resolveStaffMaxShifts(
  input: BalancePlanInput,
  staff: BalancePlanInput["staff"][number],
  otLimit: OtLimitParams,
): number {
  const cycleDays =
    Math.round(
      (Date.parse(`${input.cycleEndDate}T12:00:00Z`) -
        Date.parse(`${input.cycleStartDate}T12:00:00Z`)) /
        86_400_000,
    ) + 1;
  const baseline = Math.max(cycleDays, 31);

  if (otLimit.maxOtHoursPerStaffPerCycle === undefined) {
    return baseline;
  }

  const avgShiftHours = resolveAvgShiftHours(input.shiftCodes);
  const extraShifts = Math.ceil(otLimit.maxOtHoursPerStaffPerCycle / Math.max(avgShiftHours, 1));
  return baseline + extraShifts;
}

/** แปลง map adjustment */
function buildAdjustmentMap(
  adjustments: readonly ArcCostAdjustment[],
): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  for (const entry of adjustments) {
    const key = adjustmentKey(entry.staffId, entry.slotId, entry.shiftCodeId);
    map.set(key, (map.get(key) ?? 0) + entry.additionalCost);
  }
  return map;
}

/** คีย์ arc adjustment */
function adjustmentKey(staffId: string, slotId: string, shiftCodeId?: string): string {
  return shiftCodeId
    ? `${staffId}\x1f${slotId}\x1f${shiftCodeId}`
    : `${staffId}\x1f${slotId}`;
}

/** id arc มอบหมาย */
function assignArcId(slotId: string, staffId: string, shiftCodeId: string): string {
  return `assign::${slotId}::${staffId}::${shiftCodeId}`;
}

/** แกะ id arc มอบหมาย */
function parseAssignArcId(
  arcId: string,
): { slotId: string; staffId: string; shiftCodeId: string } | undefined {
  if (!arcId.startsWith("assign::")) {
    return undefined;
  }

  const body = arcId.slice("assign::".length);
  const shiftSep = body.lastIndexOf("::");
  if (shiftSep < 0) {
    return undefined;
  }

  const shiftCodeId = body.slice(shiftSep + 2);
  const rest = body.slice(0, shiftSep);
  const staffSep = rest.lastIndexOf("::");
  if (staffSep < 0) {
    return undefined;
  }

  return {
    slotId: rest.slice(0, staffSep),
    staffId: rest.slice(staffSep + 2),
    shiftCodeId,
  };
}

/** แปลง flow เป็น assignment */
function extractAssignments(args: {
  input: BalancePlanInput;
  mandatorySlots: readonly BalanceSlot[];
  fillPools: readonly FillPool[];
  flows: Readonly<Partial<Record<string, number>>>;
  preUnfilledMandatorySlotIds: readonly string[];
}): {
  assignments: readonly ScheduleAssignment[];
  unfilledMandatorySlotIds: readonly string[];
  filledCellCount: number;
  skippedFillSlotCount: number;
} {
  const shiftCodeById = new Map(args.input.shiftCodes.map((code) => [code.id, code]));
  const mandatorySlotById = new Map(args.mandatorySlots.map((slot) => [slot.id, slot]));
  const fillPoolById = new Map(args.fillPools.map((pool) => [pool.id, pool]));
  const preUnfilledSet = new Set(args.preUnfilledMandatorySlotIds);
  const created: ScheduleAssignment[] = [];
  const unfilled: string[] = [];
  let sequence = 0;
  let filledCellCount = 0;

  for (const [arcId, flow] of Object.entries(args.flows)) {
    if ((flow ?? 0) <= 0) {
      continue;
    }

    const parsed = parseAssignArcId(arcId);
    if (!parsed) {
      continue;
    }

    const slot =
      mandatorySlotById.get(parsed.slotId) ?? fillPoolById.get(parsed.slotId);
    const shiftCode = shiftCodeById.get(parsed.shiftCodeId);
    if (!slot || !shiftCode) {
      continue;
    }

    sequence += 1;
    filledCellCount += 1;
    const interval = buildAssignmentInterval(shiftCode, slot.scheduleDate, args.input.timezone);
    const plannedOtHours = (shiftCode.otHours ?? 0) > 0 ? shiftCode.otHours : undefined;

    created.push({
      id: `bal-${parsed.slotId}-${sequence}`,
      staffId: parsed.staffId,
      shiftCodeId: parsed.shiftCodeId,
      scheduleDate: slot.scheduleDate,
      startAt: interval.startAt,
      endAt: interval.endAt,
      plannedOtHours,
    });
  }

  for (const slot of args.mandatorySlots) {
    if (preUnfilledSet.has(slot.id)) {
      continue;
    }

    const assignedViaArc = Object.entries(args.flows).some(([arcId, flow]) => {
      if ((flow ?? 0) <= 0) {
        return false;
      }
      const parsed = parseAssignArcId(arcId);
      return parsed?.slotId === slot.id;
    });

    if (!assignedViaArc) {
      unfilled.push(slot.id);
    }
  }

  let skippedFillSlotCount = 0;
  for (const pool of args.fillPools) {
    const assignedCount = Object.entries(args.flows).reduce((count, [arcId, flow]) => {
      if ((flow ?? 0) <= 0) {
        return count;
      }
      const parsed = parseAssignArcId(arcId);
      return parsed?.slotId === pool.id ? count + (flow ?? 0) : count;
    }, 0);
    skippedFillSlotCount += Math.max(0, pool.count - assignedCount);
  }

  return {
    assignments: created.sort((left, right) => left.id.localeCompare(right.id)),
    unfilledMandatorySlotIds: unfilled.sort((left, right) => left.localeCompare(right)),
    filledCellCount,
    skippedFillSlotCount,
  };
}

/** โหนด staff */
function staffNodeId(staffId: string): FlowNodeId {
  return `stage-b::staff::${staffId}`;
}

/** โหนด slot */
function slotNodeId(slotId: string): FlowNodeId {
  return `stage-b::slot::${slotId}`;
}

/** โหนด fill pool ต่อวัน */
function fillPoolNodeId(scheduleDate: string): FlowNodeId {
  return `stage-b::fill-pool::${scheduleDate}`;
}

/** โหนด fill code ต่อ (วัน, รหัส) */
function fillCodeNodeId(scheduleDate: string, shiftCodeId: string): FlowNodeId {
  return `stage-b::fill-code::${scheduleDate}::${shiftCodeId}`;
}

/** โหนด staffDay — บังคับหนึ่งเวรต่อคนต่อวัน */
function staffDayNodeId(staffId: string, date: string): FlowNodeId {
  return `stage-b::staff-day::${staffId}::${date}`;
}

/** ลงทะเบียน staffDay node */
function ensureStaffDayNode(
  staffDayNodes: Set<FlowNodeId>,
  staffId: string,
  date: string,
): FlowNodeId {
  const node = staffDayNodeId(staffId, date);
  staffDayNodes.add(node);
  return node;
}

/** แกะ staffId/date จาก staffDay node */
function parseStaffDayNode(
  node: FlowNodeId,
): { staffId: string; date: string } | undefined {
  const prefix = "stage-b::staff-day::";
  if (!node.startsWith(prefix)) {
    return undefined;
  }

  const body = node.slice(prefix.length);
  const dateSep = body.lastIndexOf("::");
  if (dateSep < 0) {
    return undefined;
  }

  return {
    staffId: body.slice(0, dateSep),
    date: body.slice(dateSep + 2),
  };
}

/** คำนวณ OT สะสมหลัง assignment ชุดหนึ่ง */
export function totalAssignmentOtHours(
  shiftCodes: readonly ShiftCodeSnapshot[],
  assignments: readonly ScheduleAssignment[],
): number {
  const shiftCodeById = new Map(shiftCodes.map((code) => [code.id, code]));
  return assignments.reduce(
    (total, assignment) => total + assignmentOtHours(shiftCodeById, assignment),
    0,
  );
}