import type { RuleValidatorFn } from "@/domain/rules/types";
import { addDaysToDate } from "@/domain/schedule/time";
import type { ConstraintViolation, ScheduleAssignment } from "@/domain/schedule/types";

/** HC-007 — เวรดึกติดกันสูงสุด */
export const validateMaxConsecutiveNights: RuleValidatorFn = (context, ruleInstance) => {
  const params = ruleInstance.params as {
    maxConsecutiveNights?: number;
    nightShiftCodes?: readonly string[];
  };
  const maxConsecutiveNights = params.maxConsecutiveNights ?? 3;
  const nightCodes = new Set(params.nightShiftCodes ?? []);
  const violations: ConstraintViolation[] = [];

  if (nightCodes.size === 0) {
    return violations;
  }

  const byStaff = new Map<string, ScheduleAssignment[]>();
  for (const assignment of context.allAssignments) {
    const shiftCode = context.shiftCodeById.get(assignment.shiftCodeId);
    if (!shiftCode || !nightCodes.has(shiftCode.code)) {
      continue;
    }
    const list = byStaff.get(assignment.staffId) ?? [];
    list.push(assignment);
    byStaff.set(assignment.staffId, list);
  }

  for (const [staffId, nightAssignments] of byStaff) {
    const sortedDates = [...new Set(nightAssignments.map((item) => item.scheduleDate))].sort();
    let streak = 0;
    let streakStart = sortedDates[0];

    for (let index = 0; index < sortedDates.length; index += 1) {
      const currentDate = sortedDates[index];
      const previousDate = index > 0 ? sortedDates[index - 1] : null;
      const isConsecutive = previousDate === null || addDaysToDate(previousDate, 1) === currentDate;

      if (isConsecutive) {
        streak += 1;
        if (streak === 1) {
          streakStart = currentDate;
        }
      } else {
        streak = 1;
        streakStart = currentDate;
      }

      if (streak > maxConsecutiveNights) {
        violations.push({
          code: "MAX_CONSECUTIVE_NIGHTS",
          source: "RULE",
          ruleTemplateId: ruleInstance.ruleTemplateId,
          ruleInstanceId: ruleInstance.id,
          severity: ruleInstance.severity,
          weight: ruleInstance.weight ?? undefined,
          messageTh: `เวรดึกติดกัน ${streak} วัน เกิน ${maxConsecutiveNights} วัน`,
          staffId,
          scheduleDate: currentDate,
          details: { streak, streakStart, maxConsecutiveNights },
        });
      }
    }
  }

  return violations;
};
