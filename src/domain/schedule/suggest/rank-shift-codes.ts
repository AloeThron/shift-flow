import { resolveFairDistributionParams } from "@/domain/optimize/fairness/carry-over";
import { groupStaffIdsByScope, staffFairnessMetric } from "@/domain/rules/helpers/schedule-metrics";
import {
  addDaysToDate,
  buildAssignmentInterval,
  demandAppliesToDate,
} from "@/domain/schedule/time";
import type {
  ConstraintViolation,
  ScheduleEngineInput,
  ShiftCodeSnapshot,
} from "@/domain/schedule/types";
import { buildValidationContext, validateIncremental } from "@/domain/schedule/validate";

import type {
  CoverageGapSnapshot,
  RankShiftCodeCandidatesParams,
  SameDayAssignmentRef,
  ShiftCodeSuggestion,
  SuggestionBaseline,
  SuggestionRank,
} from "./types";

/** สร้างคีย์ violation สำหรับเทียบ baseline */
export function violationKey(violation: ConstraintViolation): string {
  return `${violation.code}:${violation.staffId ?? ""}:${violation.scheduleDate ?? ""}`;
}

/** ขอบเขต incremental — วันก่อน วันเป้าหมาย วันถัดไป */
export function buildSuggestionScope(staffId: string, localDate: string) {
  return {
    changedStaffIds: [staffId] as const,
    changedDates: [addDaysToDate(localDate, -1), localDate, addDaysToDate(localDate, 1)] as const,
  };
}

/** ตัด assignment นอกช่วง ±2 วันของ staff เป้าหมาย — ลดต้นทุนตอนเปิด popup */
export function trimEngineInputForSuggestion(
  input: ScheduleEngineInput,
  staffId: string,
  localDate: string,
): ScheduleEngineInput {
  const windowDates = new Set([
    addDaysToDate(localDate, -2),
    addDaysToDate(localDate, -1),
    localDate,
    addDaysToDate(localDate, 1),
    addDaysToDate(localDate, 2),
  ]);

  const assignments = input.assignments.filter((assignment) => {
    if (assignment.scheduleDate === localDate) {
      return true;
    }
    return assignment.staffId === staffId && windowDates.has(assignment.scheduleDate);
  });

  const boundaryAssignments = input.boundaryAssignments?.filter((assignment) =>
    windowDates.has(assignment.scheduleDate),
  );

  return { ...input, assignments, boundaryAssignments };
}

/** รวบรวม demand gap ของวันเดียวจาก snapshot ปัจจุบัน */
function collectCoverageGapsForDate(
  input: ScheduleEngineInput,
  localDate: string,
): readonly CoverageGapSnapshot[] {
  const shiftCodeById = new Map(input.shiftCodes.map((code) => [code.id, code]));
  const gaps: CoverageGapSnapshot[] = [];

  for (const demand of input.shiftDemands) {
    if (!demandAppliesToDate(demand, localDate, input.holidayDates)) {
      continue;
    }

    const shiftCode = shiftCodeById.get(demand.shiftCodeId);
    if (!shiftCode) {
      continue;
    }

    const interval = buildAssignmentInterval(shiftCode, localDate, input.timezone);

    let matched = 0;
    for (const assignment of input.assignments) {
      if (assignment.shiftCodeId !== demand.shiftCodeId) {
        continue;
      }
      if (assignment.scheduleDate !== localDate) {
        continue;
      }
      matched += 1;
    }

    if (matched < demand.minCount) {
      gaps.push({
        requirementId: demand.id,
        shiftCodeId: demand.shiftCodeId,
        startAt: interval.startAt,
        endAt: interval.endAt,
      });
    }
  }

  return gaps;
}

/** นับ demand ที่รหัสเวรนี้ช่วยเติมช่องว่างได้ */
function countCoverageGapsFilled(
  shiftCode: ShiftCodeSnapshot,
  localDate: string,
  gaps: readonly CoverageGapSnapshot[],
): number {
  if (gaps.length === 0) {
    return 0;
  }

  return gaps.filter((gap) => gap.shiftCodeId === shiftCode.id).length;
}

/** นับความถี่ใช้รหัสในรอบปัจจุบัน */
function buildRecentUsageByCode(
  input: ScheduleEngineInput,
  staffId: string,
): ReadonlyMap<string, number> {
  const shiftCodeById = new Map(input.shiftCodes.map((code) => [code.id, code]));
  const usage = new Map<string, number>();

  for (const assignment of input.assignments) {
    if (assignment.staffId !== staffId) {
      continue;
    }
    const shiftCode = shiftCodeById.get(assignment.shiftCodeId);
    if (!shiftCode) {
      continue;
    }
    usage.set(shiftCode.code, (usage.get(shiftCode.code) ?? 0) + 1);
  }

  return usage;
}

/** คำนวณค่าเฉลี่ยกลุ่ม fairness */
function resolveGroupFairnessMean(
  input: ScheduleEngineInput,
  staffId: string,
): { readonly groupMean: number; readonly staffMetric: number } {
  const fairParams = resolveFairDistributionParams(input.ruleInstances);
  if (!fairParams) {
    return { groupMean: 0, staffMetric: 0 };
  }

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
    return { groupMean: 0, staffMetric };
  }

  const sum = peerIds.reduce(
    (total, peerId) =>
      total +
      staffFairnessMetric(
        context,
        peerId,
        fairParams.dimension,
        fairParams.lookbackMonths,
        fairParams.normalizeByFte,
      ),
    0,
  );

  return { groupMean: sum / peerIds.length, staffMetric };
}

/** ขอบเขต validate สำหรับสลับเวรสองคน */
function buildSwapValidationScope(staffId: string, counterpartStaffId: string, localDate: string) {
  return {
    changedStaffIds: [staffId, counterpartStaffId] as const,
    changedDates: [addDaysToDate(localDate, -1), localDate, addDaysToDate(localDate, 1)] as const,
  };
}

/** สร้าง candidate assignment แทนเซลล์เดิม */
function buildCandidateAssignment(
  input: ScheduleEngineInput,
  staffId: string,
  localDate: string,
  shiftCode: ShiftCodeSnapshot,
): ScheduleEngineInput["assignments"][number] {
  const interval = buildAssignmentInterval(shiftCode, localDate, input.timezone);
  return {
    id: `${staffId}:${localDate}`,
    staffId,
    shiftCodeId: shiftCode.id,
    scheduleDate: localDate,
    startAt: interval.startAt,
    endAt: interval.endAt,
    plannedOtHours: shiftCode.otHours,
  };
}

/** แทนที่ assignment ของเซลล์ — null คือล้าง */
function replaceCellAssignment(
  input: ScheduleEngineInput,
  staffId: string,
  localDate: string,
  candidate: ScheduleEngineInput["assignments"][number] | null,
): ScheduleEngineInput {
  const assignments = input.assignments.filter(
    (assignment) => !(assignment.staffId === staffId && assignment.scheduleDate === localDate),
  );

  if (!candidate) {
    return { ...input, assignments };
  }

  return { ...input, assignments: [...assignments, candidate] };
}

/** หา violation ใหม่ที่ไม่อยู่ใน baseline */
function findNewViolations(
  baselineKeys: ReadonlySet<string>,
  violations: readonly ConstraintViolation[],
): readonly ConstraintViolation[] {
  return violations.filter((violation) => !baselineKeys.has(violationKey(violation)));
}

/** เรียง lexicographic ตาม SuggestionRank */
export function compareSuggestionRank(
  left: SuggestionRank,
  right: SuggestionRank,
  leftCode: string,
  rightCode: string,
): number {
  if (left.blocked !== right.blocked) {
    return left.blocked ? 1 : -1;
  }
  if (left.coverageGapFilled !== right.coverageGapFilled) {
    return right.coverageGapFilled - left.coverageGapFilled;
  }
  if (left.fairnessGain !== right.fairnessGain) {
    return right.fairnessGain - left.fairnessGain;
  }
  if (left.softScoreDelta !== right.softScoreDelta) {
    return left.softScoreDelta - right.softScoreDelta;
  }
  if (left.recentUsage !== right.recentUsage) {
    return right.recentUsage - left.recentUsage;
  }
  return leftCode.localeCompare(rightCode, "en");
}

/** คำนวณ baseline ครั้งเดียวตอนเปิด popup */
export function buildSuggestionBaseline(
  input: ScheduleEngineInput,
  staffId: string,
  localDate: string,
): SuggestionBaseline {
  const scopedInput = trimEngineInputForSuggestion(input, staffId, localDate);
  const scope = buildSuggestionScope(staffId, localDate);
  const validation = validateIncremental(scopedInput, scope);
  const { groupMean, staffMetric } = resolveGroupFairnessMean(scopedInput, staffId);

  return {
    hardViolationKeys: new Set(validation.hardViolations.map(violationKey)),
    softViolationKeys: new Set(validation.softViolations.map(violationKey)),
    softScore: validation.softScore,
    coverageGaps: collectCoverageGapsForDate(scopedInput, localDate),
    groupMean,
    staffMetric,
    recentUsageByCode: buildRecentUsageByCode(scopedInput, staffId),
    scope,
  };
}

/** ประเมินรหัสเวรเดียว */
function evaluateShiftCode(
  input: ScheduleEngineInput,
  params: RankShiftCodeCandidatesParams,
  shiftCode: ShiftCodeSnapshot,
): ShiftCodeSuggestion {
  const { staffId, localDate, baseline } = params;
  const candidate = buildCandidateAssignment(input, staffId, localDate, shiftCode);
  const candidateInput = replaceCellAssignment(input, staffId, localDate, candidate);
  const validation = validateIncremental(candidateInput, baseline.scope);

  const newHard = findNewViolations(baseline.hardViolationKeys, validation.hardViolations);
  const newSoft = findNewViolations(baseline.softViolationKeys, validation.softViolations);
  const otHours = shiftCode.otHours ?? 0;
  const fairnessGain =
    (baseline.groupMean - baseline.staffMetric) * (shiftCode.standardHours + otHours);

  const rank: SuggestionRank = {
    blocked: newHard.length > 0,
    coverageGapFilled: countCoverageGapsFilled(shiftCode, localDate, baseline.coverageGaps),
    fairnessGain,
    softScoreDelta: validation.softScore - baseline.softScore,
    recentUsage: baseline.recentUsageByCode.get(shiftCode.code) ?? 0,
  };

  return {
    action: { kind: "SHIFT_CODE", shiftCodeId: shiftCode.id, code: shiftCode.code },
    labelTh: shiftCode.code,
    standardHours: shiftCode.standardHours,
    otHours,
    isNightShift: shiftCode.isNightShift === true,
    blockingReasonsTh: newHard.map((violation) => violation.messageTh),
    warningsTh: newSoft.map((violation) => violation.messageTh),
    rank,
  };
}

/** ตัวเลือกวันหยุด/ลา — หนึ่งรายการต่อชนิดที่ active */
function buildPlannedOffSuggestions(
  params: RankShiftCodeCandidatesParams,
): readonly ShiftCodeSuggestion[] {
  const rank: SuggestionRank = {
    blocked: false,
    coverageGapFilled: 0,
    fairnessGain: 0,
    softScoreDelta: 0,
    recentUsage: 0,
  };

  return params.nonWorkingDayKinds.map((kind) => ({
    action: {
      kind: "PLANNED_OFF" as const,
      nonWorkingDayKindId: kind.id,
      code: kind.code,
    },
    labelTh: kind.displayName,
    standardHours: 0,
    otHours: 0,
    isNightShift: false,
    blockingReasonsTh: [],
    warningsTh: [],
    rank,
  }));
}

/** ตัวเลือก override สำหรับรหัสที่ถูกบล็อก */
function buildOverrideSuggestions(
  shiftSuggestions: readonly ShiftCodeSuggestion[],
): readonly ShiftCodeSuggestion[] {
  return shiftSuggestions
    .filter((entry) => entry.action.kind === "SHIFT_CODE" && entry.rank.blocked)
    .map((entry) => {
      if (entry.action.kind !== "SHIFT_CODE") {
        return entry;
      }

      return {
        action: {
          kind: "OVERRIDE" as const,
          shiftCodeId: entry.action.shiftCodeId,
          code: entry.action.code,
        },
        labelTh: `Override: ${entry.action.code}`,
        standardHours: entry.standardHours,
        otHours: entry.otHours,
        isNightShift: entry.isNightShift,
        blockingReasonsTh: entry.blockingReasonsTh,
        warningsTh: entry.warningsTh,
        rank: {
          ...entry.rank,
          blocked: false,
        },
      };
    });
}

/** ประเมินตัวเลือกสลับเวรกับคนในกลุ่มเดียวกัน */
function evaluateSwapWith(
  input: ScheduleEngineInput,
  params: RankShiftCodeCandidatesParams,
  counterpart: SameDayAssignmentRef,
): ShiftCodeSuggestion {
  const { staffId, localDate } = params;
  const staffAssignment = input.assignments.find(
    (assignment) => assignment.staffId === staffId && assignment.scheduleDate === localDate,
  );

  const shiftCodeById = new Map(input.shiftCodes.map((code) => [code.id, code]));
  const counterpartShiftCode = shiftCodeById.get(counterpart.shiftCodeId);
  const staffShiftCode = staffAssignment ? shiftCodeById.get(staffAssignment.shiftCodeId) : null;

  let candidateInput = input;

  if (counterpartShiftCode) {
    candidateInput = replaceCellAssignment(
      candidateInput,
      staffId,
      localDate,
      buildCandidateAssignment(input, staffId, localDate, counterpartShiftCode),
    );
  } else {
    candidateInput = replaceCellAssignment(candidateInput, staffId, localDate, null);
  }

  if (staffShiftCode) {
    candidateInput = replaceCellAssignment(
      candidateInput,
      counterpart.staffId,
      localDate,
      buildCandidateAssignment(input, counterpart.staffId, localDate, staffShiftCode),
    );
  } else {
    candidateInput = replaceCellAssignment(candidateInput, counterpart.staffId, localDate, null);
  }

  const swapScope = buildSwapValidationScope(staffId, counterpart.staffId, localDate);
  const beforeValidation = validateIncremental(input, swapScope);
  const afterValidation = validateIncremental(candidateInput, swapScope);
  const beforeHardKeys = new Set(beforeValidation.hardViolations.map(violationKey));
  const newHard = findNewViolations(beforeHardKeys, afterValidation.hardViolations);
  const newSoft = findNewViolations(
    new Set(beforeValidation.softViolations.map(violationKey)),
    afterValidation.softViolations,
  );

  const rank: SuggestionRank = {
    blocked: newHard.length > 0,
    coverageGapFilled: 0,
    fairnessGain: 0,
    softScoreDelta: afterValidation.softScore - beforeValidation.softScore,
    recentUsage: 0,
  };

  return {
    action: {
      kind: "SWAP_WITH",
      counterpartStaffId: counterpart.staffId,
      counterpartCode: counterpart.code,
    },
    labelTh: `สลับกับ ${counterpart.staffDisplayName} (${counterpart.code})`,
    standardHours: counterpartShiftCode?.standardHours ?? 0,
    otHours: counterpartShiftCode?.otHours ?? 0,
    isNightShift: counterpartShiftCode?.isNightShift === true,
    blockingReasonsTh: newHard.map((violation) => violation.messageTh),
    warningsTh: newSoft.map((violation) => violation.messageTh),
    rank,
  };
}

/** ตัวเลือกสลับเวร — คนอื่นในกลุ่มเดียวกันที่มี assignment ในวันเดียวกัน */
function buildSwapWithSuggestions(
  input: ScheduleEngineInput,
  params: RankShiftCodeCandidatesParams,
): readonly ShiftCodeSuggestion[] {
  const candidates = (params.sameDayAssignments ?? []).filter(
    (entry) => entry.staffId !== params.staffId,
  );

  if (params.staffGroupId) {
    const staffById = new Map(input.staff.map((member) => [member.id, member]));
    const filtered = candidates.filter((entry) => {
      const peer = staffById.get(entry.staffId);
      return peer?.staffGroupId === params.staffGroupId;
    });
    return filtered.map((entry) => evaluateSwapWith(input, params, entry));
  }

  return candidates.map((entry) => evaluateSwapWith(input, params, entry));
}

/** ตัวเลือกล้างเซลล์ */
function buildClearSuggestion(): ShiftCodeSuggestion {
  const rank: SuggestionRank = {
    blocked: false,
    coverageGapFilled: 0,
    fairnessGain: 0,
    softScoreDelta: 0,
    recentUsage: 0,
  };

  return {
    action: { kind: "CLEAR" },
    labelTh: "ล้างเซลล์",
    standardHours: 0,
    otHours: 0,
    isNightShift: false,
    blockingReasonsTh: [],
    warningsTh: [],
    rank,
  };
}

/** ตรวจว่ารหัสเวรใช้ได้กับระดับพนักงาน */
function isShiftCodeEligible(shiftCode: ShiftCodeSnapshot, gradeId: string): boolean {
  if (!shiftCode.active || shiftCode.needsConfirmation) {
    return false;
  }
  return shiftCode.allowedGradeIds.includes(gradeId);
}

/** จัดอันดับรหัสเวรที่แนะนำ — ต่อด้วย override, วันหยุด/ลา, สลับ และ CLEAR */
export function rankShiftCodeCandidates(
  input: ScheduleEngineInput,
  params: RankShiftCodeCandidatesParams,
): readonly ShiftCodeSuggestion[] {
  const scopedInput = trimEngineInputForSuggestion(input, params.staffId, params.localDate);
  const staff = scopedInput.staff.find((member) => member.id === params.staffId);

  const tail: ShiftCodeSuggestion[] = [];
  tail.push(...buildPlannedOffSuggestions(params));
  tail.push(...buildSwapWithSuggestions(scopedInput, params));
  tail.push(buildClearSuggestion());

  if (!staff) {
    return tail;
  }

  const shiftSuggestions = scopedInput.shiftCodes
    .filter((shiftCode) => isShiftCodeEligible(shiftCode, staff.gradeId))
    .map((shiftCode) => evaluateShiftCode(scopedInput, params, shiftCode))
    .sort((left, right) =>
      compareSuggestionRank(
        left.rank,
        right.rank,
        left.action.kind === "SHIFT_CODE" ? left.action.code : left.labelTh,
        right.action.kind === "SHIFT_CODE" ? right.action.code : right.labelTh,
      ),
    );

  const overrideSuggestions = buildOverrideSuggestions(shiftSuggestions);

  return [...shiftSuggestions, ...overrideSuggestions, ...tail];
}
