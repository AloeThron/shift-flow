import { staffHasShiftAuthForInterval } from "@/domain/schedule/shift-auth";
import type { RuleValidatorFn } from "@/domain/rules/types";
import type { ConstraintViolation } from "@/domain/schedule/types";

/** HC-003 — ต้องมีสิทธิรหัสเวร valid ตลอดเวร (template id คงเดิมเพื่อ YAML) */
export const validateRequiredCompetencyInShift: RuleValidatorFn = (context, ruleInstance) => {
  const params = ruleInstance.params as { enforceExpiry?: boolean };
  const enforceExpiry = params.enforceExpiry ?? true;
  const violations: ConstraintViolation[] = [];

  for (const assignment of context.allAssignments) {
    if (!assignment.shiftCodeId) {
      continue;
    }

    const staff = context.staffById.get(assignment.staffId);
    if (!staff) {
      violations.push({
        code: "REQUIRED_COMPETENCY_IN_SHIFT",
        source: "RULE",
        ruleTemplateId: ruleInstance.ruleTemplateId,
        ruleInstanceId: ruleInstance.id,
        severity: ruleInstance.severity,
        weight: ruleInstance.weight ?? undefined,
        messageTh: "ไม่พบ staff ใน snapshot",
        staffId: assignment.staffId,
        assignmentId: assignment.id,
        scheduleDate: assignment.scheduleDate,
      });
      continue;
    }

    const startMs = Date.parse(assignment.startAt);
    const endMs = Date.parse(assignment.endAt);

    const authorized = staffHasShiftAuthForInterval(
      staff.shiftAuthorizations,
      assignment.shiftCodeId,
      startMs,
      endMs,
      { enforceExpiry },
    );

    if (!authorized) {
      violations.push({
        code: "REQUIRED_COMPETENCY_IN_SHIFT",
        source: "RULE",
        ruleTemplateId: ruleInstance.ruleTemplateId,
        ruleInstanceId: ruleInstance.id,
        severity: ruleInstance.severity,
        weight: ruleInstance.weight ?? undefined,
        messageTh: "ไม่มีสิทธิรหัสเวรนี้",
        staffId: assignment.staffId,
        assignmentId: assignment.id,
        scheduleDate: assignment.scheduleDate,
        details: { shiftCodeId: assignment.shiftCodeId },
      });
    }
  }

  return violations;
};
