import type { InvariantValidatorFn } from "@/domain/rules/types";
import { intervalsOverlap } from "@/domain/schedule/time";
import type { ConstraintViolation, ScheduleAssignment } from "@/domain/schedule/types";

/** HC-001 — staff คนเดียวไม่มี assignment ทับเวลา */
export const validateNoTimeOverlap: InvariantValidatorFn = (context) => {
  const byStaff = new Map<string, ScheduleAssignment[]>();
  for (const assignment of context.allAssignments) {
    const list = byStaff.get(assignment.staffId) ?? [];
    list.push(assignment);
    byStaff.set(assignment.staffId, list);
  }

  const violations: ConstraintViolation[] = [];
  for (const [staffId, assignments] of byStaff) {
    const sorted = [...assignments].sort(
      (left, right) => Date.parse(left.startAt) - Date.parse(right.startAt),
    );
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (intervalsOverlap(previous.startAt, previous.endAt, current.startAt, current.endAt)) {
        violations.push({
          code: "NO_TIME_OVERLAP",
          source: "INVARIANT",
          severity: "HARD",
          messageTh: "พบ assignment ทับเวลาของ staff เดียวกัน",
          staffId,
          assignmentId: current.id,
          scheduleDate: current.scheduleDate,
          details: {
            previousAssignmentId: previous.id,
            currentAssignmentId: current.id,
          },
        });
      }
    }
  }
  return violations;
};
