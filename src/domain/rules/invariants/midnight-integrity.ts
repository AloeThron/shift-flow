import type { InvariantValidatorFn } from "@/domain/rules/types";
import { buildAssignmentInterval } from "@/domain/schedule/time";
import type { ConstraintViolation } from "@/domain/schedule/types";

/** HC-009 — assignment ข้ามคืนต้องสอดคล้องกับ shift code */
export const validateMidnightIntegrity: InvariantValidatorFn = (context) => {
  const violations: ConstraintViolation[] = [];

  for (const assignment of context.allAssignments) {
    const shiftCode = context.shiftCodeById.get(assignment.shiftCodeId);
    if (!shiftCode) {
      continue;
    }

    const expected = buildAssignmentInterval(shiftCode, assignment.scheduleDate, context.timezone);
    const startDiff = Math.abs(Date.parse(assignment.startAt) - Date.parse(expected.startAt));
    const endDiff = Math.abs(Date.parse(assignment.endAt) - Date.parse(expected.endAt));

    if (startDiff > 60_000 || endDiff > 60_000) {
      violations.push({
        code: "MIDNIGHT_INTEGRITY",
        source: "INVARIANT",
        severity: "HARD",
        messageTh: "ช่วงเวลา assignment ไม่สอดคล้องกับรหัสเวรและวันที่",
        assignmentId: assignment.id,
        scheduleDate: assignment.scheduleDate,
        details: {
          expectedStartAt: expected.startAt,
          expectedEndAt: expected.endAt,
          actualStartAt: assignment.startAt,
          actualEndAt: assignment.endAt,
        },
      });
    }
  }

  return violations;
};
