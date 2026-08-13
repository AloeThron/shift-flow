import { isStaffOffOnDate, isWorkingAssignment } from "@/domain/rules/helpers/schedule-metrics";
import type { RuleValidatorFn } from "@/domain/rules/types";
import { addDaysToDate, eachDateInRange } from "@/domain/schedule/time";
import type { ConstraintViolation } from "@/domain/schedule/types";

/** วันทำงานติดกันสูงสุด */
export const validateMaxConsecutiveDays: RuleValidatorFn = (context, ruleInstance) => {
  const params = ruleInstance.params as {
    maxConsecutiveDays?: number;
    countOffAsBreak?: boolean;
  };
  const maxConsecutiveDays = params.maxConsecutiveDays ?? 6;
  const countOffAsBreak = params.countOffAsBreak ?? true;
  const violations: ConstraintViolation[] = [];

  for (const member of context.staff) {
    if (countOffAsBreak) {
      violations.push(
        ...validateWithCalendarBreaks(context, member.id, maxConsecutiveDays, ruleInstance),
      );
    } else {
      violations.push(
        ...validateWorkingDateStreak(context, member.id, maxConsecutiveDays, ruleInstance),
      );
    }
  }

  return violations;
};

/** นับ streak ตามปฏิทิน — วันหยุด/ว่างตัด streak */
function validateWithCalendarBreaks(
  context: Parameters<RuleValidatorFn>[0],
  staffId: string,
  maxConsecutiveDays: number,
  ruleInstance: Parameters<RuleValidatorFn>[1],
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  const cycleDates = eachDateInRange(context.cycleStartDate, context.cycleEndDate);
  let streak = 0;
  let streakStart = cycleDates[0];

  for (const date of cycleDates) {
    const working = context.allAssignments.some(
      (assignment) =>
        assignment.staffId === staffId &&
        assignment.scheduleDate === date &&
        isWorkingAssignment(context.shiftCodeById, assignment),
    );
    const off = isStaffOffOnDate(context, staffId, date);

    if (working && !off) {
      if (streak === 0) {
        streakStart = date;
      }
      streak += 1;
    } else {
      streak = 0;
    }

    if (streak > maxConsecutiveDays) {
      violations.push({
        code: "MAX_CONSECUTIVE_DAYS",
        source: "RULE",
        ruleTemplateId: ruleInstance.ruleTemplateId,
        ruleInstanceId: ruleInstance.id,
        severity: ruleInstance.severity,
        weight: ruleInstance.weight ?? undefined,
        messageTh: `ทำงานติดกัน ${streak} วัน เกิน ${maxConsecutiveDays} วัน`,
        staffId,
        scheduleDate: date,
        details: { streak, streakStart, maxConsecutiveDays, countOffAsBreak: true },
      });
    }
  }

  return violations;
}

/** นับ streak เฉพาะวันที่มี assignment ทำงาน — ช่องว่างไม่ตัด streak */
function validateWorkingDateStreak(
  context: Parameters<RuleValidatorFn>[0],
  staffId: string,
  maxConsecutiveDays: number,
  ruleInstance: Parameters<RuleValidatorFn>[1],
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  const workingDates = [
    ...new Set(
      context.allAssignments
        .filter(
          (assignment) =>
            assignment.staffId === staffId &&
            assignment.scheduleDate >= context.cycleStartDate &&
            assignment.scheduleDate <= context.cycleEndDate &&
            isWorkingAssignment(context.shiftCodeById, assignment),
        )
        .map((assignment) => assignment.scheduleDate),
    ),
  ].sort();

  let streak = 0;
  let streakStart = workingDates[0];

  for (let index = 0; index < workingDates.length; index += 1) {
    const currentDate = workingDates[index];
    const previousDate = index > 0 ? workingDates[index - 1] : null;
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

    if (streak > maxConsecutiveDays) {
      violations.push({
        code: "MAX_CONSECUTIVE_DAYS",
        source: "RULE",
        ruleTemplateId: ruleInstance.ruleTemplateId,
        ruleInstanceId: ruleInstance.id,
        severity: ruleInstance.severity,
        weight: ruleInstance.weight ?? undefined,
        messageTh: `ทำงานติดกัน ${streak} วัน เกิน ${maxConsecutiveDays} วัน`,
        staffId,
        scheduleDate: currentDate,
        details: { streak, streakStart, maxConsecutiveDays, countOffAsBreak: false },
      });
    }
  }

  return violations;
}
