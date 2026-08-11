import type { ScheduleAssignment, ScheduleEngineInput } from "@/domain/schedule/types";
import { validateSchedule } from "@/domain/schedule/validate";

/** ลบ assignment ที่มี hard violation แล้วลอง assign ใหม่จาก candidate pool */
export function repairHardViolations(
  input: ScheduleEngineInput,
  candidateStaffByAssignment: Readonly<Record<string, readonly string[]>>,
): readonly ScheduleAssignment[] {
  let assignments = [...input.assignments];
  let validation = validateSchedule({ ...input, assignments });
  let guard = 0;

  while (!validation.isValid && guard < assignments.length * 2) {
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
    const candidates = candidateStaffByAssignment[current.id] ?? [];
    let repaired = false;

    for (const staffId of candidates) {
      if (staffId === current.staffId) {
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
