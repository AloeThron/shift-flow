import { buildAssignmentInterval } from "@/domain/schedule/time";
import type {
  ScheduleAssignment,
  ScheduleEngineInput,
  ScheduleSlot,
} from "@/domain/schedule/types";
import { wouldAssignmentViolateHard } from "@/domain/schedule/validate";

/** สร้าง assignment จาก slot + staff */
export function createAssignmentFromSlot(
  slot: ScheduleSlot,
  staffId: string,
  shiftCode: ScheduleEngineInput["shiftCodes"][number],
  input: ScheduleEngineInput,
  sequence: number,
): ScheduleAssignment {
  const interval = buildAssignmentInterval(shiftCode, slot.scheduleDate, input.timezone);
  return {
    id: `gen-${slot.id}-${sequence}`,
    staffId,
    shiftCodeId: shiftCode.id,
    scheduleDate: slot.scheduleDate,
    startAt: interval.startAt,
    endAt: interval.endAt,
  };
}

/** เรียง staff ตาม workload แล้ว id — deterministic */
export function rankStaffCandidates(
  staffIds: readonly string[],
  input: ScheduleEngineInput,
): readonly string[] {
  const hoursByStaff = new Map<string, number>();
  for (const assignment of input.assignments) {
    const hours = (Date.parse(assignment.endAt) - Date.parse(assignment.startAt)) / 3_600_000;
    hoursByStaff.set(assignment.staffId, (hoursByStaff.get(assignment.staffId) ?? 0) + hours);
  }

  return [...staffIds].sort((left, right) => {
    const leftHours = hoursByStaff.get(left) ?? 0;
    const rightHours = hoursByStaff.get(right) ?? 0;
    if (leftHours !== rightHours) {
      return leftHours - rightHours;
    }
    return left.localeCompare(right);
  });
}

/** constructive greedy — เติม slot ที่ยังว่าง */
export function constructSchedule(
  input: ScheduleEngineInput,
  slots: readonly ScheduleSlot[],
): readonly ScheduleAssignment[] {
  const shiftCodeById = new Map(input.shiftCodes.map((code) => [code.id, code]));
  let working: ScheduleEngineInput = { ...input, assignments: [...input.assignments] };
  const created: ScheduleAssignment[] = [];
  let sequence = 0;

  const sortedSlots = [...slots].sort((left, right) => {
    const dateCompare = left.scheduleDate.localeCompare(right.scheduleDate);
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return left.id.localeCompare(right.id);
  });

  for (const slot of sortedSlots) {
    const shiftCode = shiftCodeById.get(slot.shiftCodeId);
    if (!shiftCode || shiftCode.needsConfirmation || !shiftCode.active) {
      continue;
    }

    const eligible = working.staff
      .filter((member) => shiftCode.allowedGradeIds.includes(member.gradeId))
      .map((member) => member.id);

    const ranked = rankStaffCandidates(eligible, working);
    let assigned = false;

    for (const staffId of ranked) {
      sequence += 1;
      const candidate = createAssignmentFromSlot(slot, staffId, shiftCode, working, sequence);
      if (wouldAssignmentViolateHard(working, candidate)) {
        continue;
      }

      working = {
        ...working,
        assignments: [...working.assignments, candidate],
      };
      created.push(candidate);
      assigned = true;
      break;
    }

    if (!assigned) {
      continue;
    }
  }

  return [...working.assignments];
}
