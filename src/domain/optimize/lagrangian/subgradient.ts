import {
    buildBalanceSlots,
    buildFillPools,
} from "@/domain/optimize/balance/build-slot-graph";
import { solveBalance } from "@/domain/optimize/balance/solve-balance";
import type {
    ArcCostAdjustment,
    BalancePlanInput,
    BalancePlanResult,
    BalanceSlot,
    FillPool,
} from "@/domain/optimize/balance/types";
import { areaKeyForShiftCode } from "@/domain/optimize/balance/types";
import type { ScheduleAssignment, ScheduleEngineInput } from "@/domain/schedule/types";
import { validateSchedule } from "@/domain/schedule/validate";

const DEFAULT_SUBGRADIENT_ITERATIONS = 12;
const LAGRANGIAN_PENALTY_STEP = 2_000;

/** rule template ที่ multiplier ชั้น 2 รองรับ */
const SOFT_SEQUENCE_RULES = new Set([
  "MIN_REST_BETWEEN_SHIFTS",
  "FORBIDDEN_CODE_SEQUENCE",
  "MAX_CONSECUTIVE_NIGHTS",
  "MAX_CONSECUTIVE_DAYS",
]);

/** ผล Lagrangian + repair + targeted search */
export type LagrangianBalanceResult = BalancePlanResult & {
  readonly lagrangianIterations: number;
  readonly localSearchIterations: number;
};

/** รัน Stage B พร้อม Lagrangian repair และ targeted local search */
export function runLagrangianBalance(input: BalancePlanInput): LagrangianBalanceResult {
  let arcAdjustments: ArcCostAdjustment[] = [];
  let best = solveBalance(input, arcAdjustments);
  let bestValidation = validateSchedule({ ...input, assignments: best.assignments });

  for (let iteration = 0; iteration < DEFAULT_SUBGRADIENT_ITERATIONS; iteration += 1) {
    if (
      bestValidation.isValid &&
      bestValidation.softViolations.length === 0 &&
      !hasAreaImbalance(input, best.assignments)
    ) {
      break;
    }

    const nextAdjustments = buildSubgradientAdjustments(
      input,
      best.assignments,
      bestValidation,
      arcAdjustments,
    );
    if (adjustmentsUnchanged(arcAdjustments, nextAdjustments)) {
      break;
    }

    arcAdjustments = nextAdjustments;
    const candidate = solveBalance(input, arcAdjustments);
    const candidateValidation = validateSchedule({ ...input, assignments: candidate.assignments });

    if (isBetterCandidate(input, candidate, candidateValidation, best, bestValidation)) {
      best = candidate;
      bestValidation = candidateValidation;
    }
  }

  const repaired = repairHardViolationsTargeted({ ...input, assignments: best.assignments });
  const searched = targetedLocalSearch({ ...input, assignments: repaired });

  const finalValidation = validateSchedule({ ...input, assignments: searched.assignments });

  return {
    ...best,
    assignments: searched.assignments,
    feasible: finalValidation.isValid && best.unfilledMandatorySlotIds.length === 0,
    lagrangianIterations: arcAdjustments.length > 0 ? DEFAULT_SUBGRADIENT_ITERATIONS : 0,
    localSearchIterations: searched.iterations,
  };
}

/** หา slot/fill pool ที่สอดคล้องกับ assignment หลัง solve */
function resolveSlotForAssignment(
  mandatorySlots: readonly BalanceSlot[],
  fillPools: readonly FillPool[],
  assignment: ScheduleAssignment,
): { slotId: string; scheduleDate: string } | undefined {
  const fromMandatory = mandatorySlots.find((slot) =>
    assignment.id.startsWith(`bal-${slot.id}-`),
  );
  if (fromMandatory) {
    return { slotId: fromMandatory.id, scheduleDate: fromMandatory.scheduleDate };
  }

  const fromFill = fillPools.find((pool) => assignment.id.startsWith(`bal-${pool.id}-`));
  if (fromFill) {
    return { slotId: fromFill.id, scheduleDate: fromFill.scheduleDate };
  }

  const fallbackMandatory = mandatorySlots.find(
    (slot) =>
      slot.kind === "MANDATORY" &&
      slot.scheduleDate === assignment.scheduleDate &&
      slot.shiftCodeId === assignment.shiftCodeId,
  );
  if (fallbackMandatory) {
    return { slotId: fallbackMandatory.id, scheduleDate: fallbackMandatory.scheduleDate };
  }

  return undefined;
}

/** นับ assignment ต่อ (staff, work area) */
function countAreaAssignments(
  input: BalancePlanInput,
  assignments: readonly ScheduleAssignment[],
): ReadonlyMap<string, number> {
  const shiftCodeById = new Map(input.shiftCodes.map((code) => [code.id, code]));
  const counts = new Map<string, number>();

  for (const assignment of assignments) {
    const shiftCode = shiftCodeById.get(assignment.shiftCodeId);
    if (!shiftCode) {
      continue;
    }
    const areaKey = areaKeyForShiftCode(shiftCode);
    const key = `${assignment.staffId}\x1f${areaKey}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

/** เป้าหมายสูงสุดต่อ staff ต่อ work area */
function computeAreaTargetPerStaff(
  input: BalancePlanInput,
  assignments: readonly ScheduleAssignment[],
): ReadonlyMap<string, number> {
  const shiftCodeById = new Map(input.shiftCodes.map((code) => [code.id, code]));
  const areaSlotTotal = new Map<string, number>();

  for (const assignment of assignments) {
    const shiftCode = shiftCodeById.get(assignment.shiftCodeId);
    if (!shiftCode) {
      continue;
    }
    const areaKey = areaKeyForShiftCode(shiftCode);
    areaSlotTotal.set(areaKey, (areaSlotTotal.get(areaKey) ?? 0) + 1);
  }

  const eligibleStaffCount = Math.max(1, input.staff.length);
  const targets = new Map<string, number>();
  for (const [areaKey, total] of areaSlotTotal) {
    targets.set(areaKey, Math.ceil(total / eligibleStaffCount));
  }

  return targets;
}

/** ตรวจว่ายังกอง work area เกินเป้า */
function hasAreaImbalance(
  input: BalancePlanInput,
  assignments: readonly ScheduleAssignment[],
): boolean {
  const counts = countAreaAssignments(input, assignments);
  const targets = computeAreaTargetPerStaff(input, assignments);

  for (const [key, count] of counts) {
    const areaKey = key.split("\x1f")[1];
    if (!areaKey) {
      continue;
    }
    const target = targets.get(areaKey) ?? 0;
    if (count > target) {
      return true;
    }
  }

  return false;
}

/** สร้าง arc cost adjustment จาก soft violations และ area imbalance */
function buildSubgradientAdjustments(
  input: BalancePlanInput,
  assignments: readonly ScheduleAssignment[],
  validation: ReturnType<typeof validateSchedule>,
  existing: readonly ArcCostAdjustment[],
): ArcCostAdjustment[] {
  const mandatorySlots = buildBalanceSlots(input);
  const fillPools = buildFillPools(input, mandatorySlots);
  const shiftCodeById = new Map(input.shiftCodes.map((code) => [code.id, code]));
  const adjustmentMap = new Map<string, number>();
  for (const entry of existing) {
    adjustmentMap.set(
      adjustmentKey(entry.staffId, entry.slotId, entry.shiftCodeId),
      entry.additionalCost,
    );
  }

  for (const violation of validation.softViolations) {
    if (!violation.ruleTemplateId || !SOFT_SEQUENCE_RULES.has(violation.ruleTemplateId)) {
      continue;
    }

    const assignment = assignments.find((item) => item.id === violation.assignmentId);
    if (!assignment) {
      continue;
    }

    const slot = resolveSlotForAssignment(mandatorySlots, fillPools, assignment);
    if (!slot) {
      continue;
    }

    const key = adjustmentKey(assignment.staffId, slot.slotId, assignment.shiftCodeId);
    adjustmentMap.set(key, (adjustmentMap.get(key) ?? 0) + LAGRANGIAN_PENALTY_STEP);
  }

  const areaCounts = countAreaAssignments(input, assignments);
  const areaTargets = computeAreaTargetPerStaff(input, assignments);

  for (const assignment of assignments) {
    const shiftCode = shiftCodeById.get(assignment.shiftCodeId);
    if (!shiftCode) {
      continue;
    }

    const areaKey = areaKeyForShiftCode(shiftCode);
    const countKey = `${assignment.staffId}\x1f${areaKey}`;
    const count = areaCounts.get(countKey) ?? 0;
    const target = areaTargets.get(areaKey) ?? 0;
    if (count <= target) {
      continue;
    }

    const slot = resolveSlotForAssignment(mandatorySlots, fillPools, assignment);
    if (!slot) {
      continue;
    }

    const key = adjustmentKey(assignment.staffId, slot.slotId, assignment.shiftCodeId);
    adjustmentMap.set(key, (adjustmentMap.get(key) ?? 0) + LAGRANGIAN_PENALTY_STEP);
  }

  return [...adjustmentMap.entries()]
    .map(([key, additionalCost]) => parseAdjustmentKey(key, additionalCost))
    .sort((left, right) => {
      const staffCompare = left.staffId.localeCompare(right.staffId);
      if (staffCompare !== 0) {
        return staffCompare;
      }
      const slotCompare = left.slotId.localeCompare(right.slotId);
      if (slotCompare !== 0) {
        return slotCompare;
      }
      return (left.shiftCodeId ?? "").localeCompare(right.shiftCodeId ?? "");
    });
}

/** ตรวจว่า adjustment ไม่เปลี่ยน */
function adjustmentsUnchanged(
  current: readonly ArcCostAdjustment[],
  next: readonly ArcCostAdjustment[],
): boolean {
  if (current.length !== next.length) {
    return false;
  }

  const currentMap = new Map(
    current.map((entry) => [
      adjustmentKey(entry.staffId, entry.slotId, entry.shiftCodeId),
      entry.additionalCost,
    ]),
  );

  return next.every(
    (entry) =>
      currentMap.get(adjustmentKey(entry.staffId, entry.slotId, entry.shiftCodeId)) ===
      entry.additionalCost,
  );
}

/** คีย์ arc adjustment */
function adjustmentKey(staffId: string, slotId: string, shiftCodeId?: string): string {
  return shiftCodeId
    ? `${staffId}\x1f${slotId}\x1f${shiftCodeId}`
    : `${staffId}\x1f${slotId}`;
}

/** แกะ adjustment จากคีย์ */
function parseAdjustmentKey(key: string, additionalCost: number): ArcCostAdjustment {
  const parts = key.split("\x1f");
  return {
    staffId: parts[0] ?? "",
    slotId: parts[1] ?? "",
    shiftCodeId: parts[2],
    additionalCost,
  };
}

/** เปรียบเทียบ candidate — hard valid ก่อน แล้ว soft score */
function isBetterCandidate(
  input: BalancePlanInput,
  candidate: BalancePlanResult,
  candidateValidation: ReturnType<typeof validateSchedule>,
  current: BalancePlanResult,
  currentValidation: ReturnType<typeof validateSchedule>,
): boolean {
  if (candidate.unfilledMandatorySlotIds.length !== current.unfilledMandatorySlotIds.length) {
    return candidate.unfilledMandatorySlotIds.length < current.unfilledMandatorySlotIds.length;
  }

  if (candidateValidation.isValid !== currentValidation.isValid) {
    return candidateValidation.isValid;
  }

  if (candidateValidation.softScore !== currentValidation.softScore) {
    return candidateValidation.softScore < currentValidation.softScore;
  }

  const candidateAreaImbalance = hasAreaImbalance(input, candidate.assignments);
  const currentAreaImbalance = hasAreaImbalance(input, current.assignments);
  if (candidateAreaImbalance !== currentAreaImbalance) {
    return !candidateAreaImbalance;
  }

  return candidate.totalCost < current.totalCost;
}

/** ตรวจว่า staff มีเวรในวันนั้นแล้ว (ยกเว้น assignment ที่ระบุ) */
function hasAssignmentOnDate(
  assignments: readonly ScheduleAssignment[],
  staffId: string,
  scheduleDate: string,
  excludeAssignmentId?: string,
): boolean {
  return assignments.some(
    (assignment) =>
      assignment.id !== excludeAssignmentId &&
      assignment.staffId === staffId &&
      assignment.scheduleDate === scheduleDate,
  );
}

/** repair hard violations แบบ deterministic */
function repairHardViolationsTargeted(input: ScheduleEngineInput): readonly ScheduleAssignment[] {
  let assignments = [...input.assignments];
  let validation = validateSchedule({ ...input, assignments });
  let guard = 0;

  while (!validation.isValid && guard < assignments.length * 3) {
    guard += 1;
    const violation = validation.hardViolations[0];
    const targetId = violation?.assignmentId;
    if (!targetId) {
      break;
    }

    const index = assignments.findIndex((item) => item.id === targetId);
    if (index < 0) {
      break;
    }

    const current = assignments[index];
    if (current.isPinned === true) {
      break;
    }

    const candidates = input.staff
      .map((member) => member.id)
      .filter((staffId) => staffId !== current.staffId)
      .sort((left, right) => left.localeCompare(right));

    let repaired = false;
    for (const staffId of candidates) {
      if (hasAssignmentOnDate(assignments, staffId, current.scheduleDate, current.id)) {
        continue;
      }

      const candidate = { ...current, staffId };
      const nextAssignments = assignments.map((item, itemIndex) =>
        itemIndex === index ? candidate : item,
      );
      const nextValidation = validateSchedule({ ...input, assignments: nextAssignments });
      if (
        nextValidation.isValid ||
        nextValidation.hardViolations.length < validation.hardViolations.length
      ) {
        assignments = nextAssignments;
        validation = nextValidation;
        repaired = true;
        break;
      }
    }

    if (!repaired) {
      assignments = assignments.filter((item) => item.id !== targetId);
      validation = validateSchedule({ ...input, assignments });
    }
  }

  return assignments;
}

/** ตรวจว่าสลับ staff ระหว่างสอง assignment ไม่ทำให้ซ้ำวัน */
function isStaffSwapValid(
  assignments: readonly ScheduleAssignment[],
  target: ScheduleAssignment,
  candidate: ScheduleAssignment,
): boolean {
  if (target.scheduleDate === candidate.scheduleDate) {
    return true;
  }

  if (
    hasAssignmentOnDate(assignments, candidate.staffId, target.scheduleDate, candidate.id) ||
    hasAssignmentOnDate(assignments, target.staffId, candidate.scheduleDate, target.id)
  ) {
    return false;
  }

  return true;
}

/** targeted local search — สลับ staff บน assignment ที่มี soft violation */
function targetedLocalSearch(
  input: ScheduleEngineInput,
  maxIterations: number = 100,
): { assignments: readonly ScheduleAssignment[]; iterations: number } {
  let current = [...input.assignments];
  let currentValidation = validateSchedule({ ...input, assignments: current });
  let iterations = 0;

  if (current.length < 2) {
    return { assignments: current, iterations: 0 };
  }

  for (let step = 0; step < maxIterations; step += 1) {
    if (currentValidation.isValid && currentValidation.softViolations.length === 0) {
      break;
    }

    const violation = currentValidation.softViolations[0] ?? currentValidation.hardViolations[0];
    if (!violation?.assignmentId) {
      break;
    }

    const targetIndex = current.findIndex((item) => item.id === violation.assignmentId);
    if (targetIndex < 0) {
      break;
    }

    const target = current[targetIndex];
    if (target.isPinned === true) {
      break;
    }

    const swapCandidates = current
      .map((item, index) => ({ item, index }))
      .filter(({ item, index }) => index !== targetIndex && item.isPinned !== true)
      .sort((left, right) => left.item.id.localeCompare(right.item.id));

    let improved = false;
    for (const candidate of swapCandidates) {
      if (!isStaffSwapValid(current, target, candidate.item)) {
        continue;
      }

      iterations += 1;
      const swapped = current.map((item, index) => {
        if (index === targetIndex) {
          return { ...candidate.item, id: target.id };
        }
        if (index === candidate.index) {
          return { ...target, id: candidate.item.id };
        }
        return item;
      });

      const nextValidation = validateSchedule({ ...input, assignments: swapped });
      if (!nextValidation.isValid) {
        continue;
      }

      if (nextValidation.softScore < currentValidation.softScore) {
        current = swapped;
        currentValidation = nextValidation;
        improved = true;
        break;
      }
    }

    if (!improved) {
      break;
    }
  }

  return { assignments: current, iterations };
}
