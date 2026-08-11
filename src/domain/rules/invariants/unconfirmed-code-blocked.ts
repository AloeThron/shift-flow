import type { InvariantValidatorFn } from "@/domain/rules/types";
import type { ConstraintViolation } from "@/domain/schedule/types";

/** ไม่ assign รหัสที่องค์กรยังไม่ยืนยัน */
export const validateUnconfirmedCodeBlocked: InvariantValidatorFn = (context) => {
  const violations: ConstraintViolation[] = [];

  for (const assignment of context.allAssignments) {
    const shiftCode = context.shiftCodeById.get(assignment.shiftCodeId);
    if (!shiftCode) {
      violations.push({
        code: "UNCONFIRMED_CODE_BLOCKED",
        source: "INVARIANT",
        severity: "HARD",
        messageTh: "ไม่พบรหัสเวรใน snapshot",
        assignmentId: assignment.id,
        scheduleDate: assignment.scheduleDate,
        details: { shiftCodeId: assignment.shiftCodeId },
      });
      continue;
    }

    if (shiftCode.needsConfirmation || !shiftCode.active) {
      violations.push({
        code: "UNCONFIRMED_CODE_BLOCKED",
        source: "INVARIANT",
        severity: "HARD",
        messageTh: "ใช้รหัสเวรที่ยังไม่ยืนยันหรือเลิกใช้แล้ว",
        assignmentId: assignment.id,
        scheduleDate: assignment.scheduleDate,
        details: { shiftCodeId: shiftCode.id, code: shiftCode.code },
      });
    }
  }

  return violations;
};
