import type { RuleValidatorFn } from "@/domain/rules/types";
import { addDaysToDate } from "@/domain/schedule/time";
import type { ConstraintViolation } from "@/domain/schedule/types";

/** SC-004 — soft pattern หมุนเวียน */
export const validatePreferredPattern: RuleValidatorFn = (context, ruleInstance) => {
  const params = ruleInstance.params as {
    pattern?: readonly string[];
    gradeCode?: string;
    description?: string;
  };
  const pattern = params.pattern ?? [];
  if (pattern.length < 2) {
    return [];
  }

  const violations: ConstraintViolation[] = [];

  for (const staff of context.staff) {
    if (params.gradeCode && staff.gradeId !== params.gradeCode) {
      continue;
    }

    const staffAssignments = context.allAssignments
      .filter((item) => item.staffId === staff.id)
      .sort((left, right) => left.scheduleDate.localeCompare(right.scheduleDate));

    if (staffAssignments.length === 0) {
      continue;
    }

    const observed: string[] = [];
    for (const assignment of staffAssignments) {
      const shiftCode = context.shiftCodeById.get(assignment.shiftCodeId);
      observed.push(shiftCode?.code.toLowerCase() ?? "?");
    }

    let bestMismatch = observed.length;
    for (let offset = 0; offset < pattern.length; offset += 1) {
      let mismatch = 0;
      for (let index = 0; index < observed.length; index += 1) {
        const expected = pattern[(index + offset) % pattern.length]?.toLowerCase();
        if (expected !== observed[index]) {
          mismatch += 1;
        }
      }
      bestMismatch = Math.min(bestMismatch, mismatch);
    }

    if (bestMismatch > 0) {
      violations.push({
        code: "PREFERRED_PATTERN",
        source: "RULE",
        ruleTemplateId: ruleInstance.ruleTemplateId,
        ruleInstanceId: ruleInstance.id,
        severity: ruleInstance.severity,
        weight: ruleInstance.weight ?? 1,
        messageTh: params.description
          ? `pattern ไม่ตรง: ${params.description}`
          : "pattern หมุนเวียนไม่ตรงที่กำหนด",
        staffId: staff.id,
        scheduleDate: staffAssignments[0]?.scheduleDate,
        details: {
          observed,
          pattern,
          mismatchCount: bestMismatch,
          cycleEnd:
            staffAssignments.at(-1)?.scheduleDate ?? addDaysToDate(context.cycleStartDate, 0),
        },
      });
    }
  }

  return violations;
};
