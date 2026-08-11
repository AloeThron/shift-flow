import type { RuleValidatorFn } from "@/domain/rules/types";
import type { ConstraintViolation } from "@/domain/schedule/types";

/** จำกัดรหัสเวรตาม grade ของ staff */
export const validateGradeCodeWhitelist: RuleValidatorFn = (context, ruleInstance) => {
  const params = ruleInstance.params as {
    enforceFromShiftCodes?: boolean;
    gradeCodeMatrix?: Record<string, readonly string[]>;
  };

  const violations: ConstraintViolation[] = [];

  for (const assignment of context.allAssignments) {
    const shiftCode = context.shiftCodeById.get(assignment.shiftCodeId);
    const staff = context.staffById.get(assignment.staffId);
    if (!shiftCode || !staff) {
      continue;
    }

    const allowedCodes =
      params.enforceFromShiftCodes === false && params.gradeCodeMatrix
        ? (params.gradeCodeMatrix[staff.gradeId] ?? [])
        : shiftCode.allowedGradeIds;

    if (allowedCodes.length === 0) {
      continue;
    }

    const gradeAllowed = allowedCodes.includes(staff.gradeId);
    if (!gradeAllowed) {
      violations.push({
        code: "GRADE_CODE_WHITELIST",
        source: "RULE",
        ruleTemplateId: ruleInstance.ruleTemplateId,
        ruleInstanceId: ruleInstance.id,
        severity: ruleInstance.severity,
        weight: ruleInstance.weight ?? undefined,
        messageTh: `ระดับพนักงานใช้รหัส ${shiftCode.code} ไม่ได้`,
        staffId: assignment.staffId,
        assignmentId: assignment.id,
        scheduleDate: assignment.scheduleDate,
        details: { shiftCode: shiftCode.code, gradeId: staff.gradeId },
      });
    }
  }

  return violations;
};
