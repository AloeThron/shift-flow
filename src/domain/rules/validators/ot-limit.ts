import { orgOtHoursInCycle, staffOtHoursInCycle } from "@/domain/rules/helpers/schedule-metrics";
import type { RuleValidatorFn } from "@/domain/rules/types";
import type { ConstraintViolation } from "@/domain/schedule/types";

/** HC-012 — เพดาน OT ต่อเดือน */
export const validateOtLimit: RuleValidatorFn = (context, ruleInstance) => {
  const params = ruleInstance.params as {
    maxOtHoursPerStaffPerCycle?: number;
    maxOtHoursPerOrgPerCycle?: number;
  };

  const violations: ConstraintViolation[] = [];

  if (params.maxOtHoursPerStaffPerCycle !== undefined) {
    for (const member of context.staff) {
      const otHours = staffOtHoursInCycle(context, member.id);
      if (otHours > params.maxOtHoursPerStaffPerCycle) {
        violations.push({
          code: "OT_LIMIT",
          source: "RULE",
          ruleTemplateId: ruleInstance.ruleTemplateId,
          ruleInstanceId: ruleInstance.id,
          severity: ruleInstance.severity,
          weight: ruleInstance.weight ?? undefined,
          messageTh: `OT สะสม ${otHours.toFixed(1)} ชม. เกินเพดาน ${params.maxOtHoursPerStaffPerCycle} ชม. ต่อคน`,
          staffId: member.id,
          details: {
            otHours,
            maxOtHoursPerStaffPerCycle: params.maxOtHoursPerStaffPerCycle,
            excess: otHours - params.maxOtHoursPerStaffPerCycle,
          },
        });
      }
    }
  }

  if (params.maxOtHoursPerOrgPerCycle !== undefined) {
    const orgOtHours = orgOtHoursInCycle(context);
    if (orgOtHours > params.maxOtHoursPerOrgPerCycle) {
      violations.push({
        code: "OT_LIMIT",
        source: "RULE",
        ruleTemplateId: ruleInstance.ruleTemplateId,
        ruleInstanceId: ruleInstance.id,
        severity: ruleInstance.severity,
        weight: ruleInstance.weight ?? undefined,
        messageTh: `OT ทั้งองค์กร ${orgOtHours.toFixed(1)} ชม. เกินเพดาน ${params.maxOtHoursPerOrgPerCycle} ชม.`,
        details: {
          orgOtHours,
          maxOtHoursPerOrgPerCycle: params.maxOtHoursPerOrgPerCycle,
          excess: orgOtHours - params.maxOtHoursPerOrgPerCycle,
        },
      });
    }
  }

  return violations;
};
