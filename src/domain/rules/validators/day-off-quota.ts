import { collectStaffOffDates, countWeeksInCycle } from "@/domain/rules/helpers/schedule-metrics";
import type { RuleValidatorFn } from "@/domain/rules/types";
import { resolveDayType } from "@/domain/schedule/time";
import type { ConstraintViolation } from "@/domain/schedule/types";

/** HC-010 — โควตาวันหยุดต่อเดือน */
export const validateDayOffQuota: RuleValidatorFn = (context, ruleInstance) => {
  const params = ruleInstance.params as {
    daysOffPerCycle?: number;
    daysOffPerWeek?: number;
    minWeekendDaysOff?: number;
    scope?: "GROUP" | "ORG" | "STAFF";
  };

  const minWeekendDaysOff = params.minWeekendDaysOff ?? 0;
  const requiredOffDays = resolveRequiredOffDays(
    context.cycleStartDate,
    context.cycleEndDate,
    params,
  );

  const hasDraftQuotas = Object.keys(context.staffDayOffQuotas ?? {}).length > 0;
  if (requiredOffDays === null && minWeekendDaysOff === 0 && !hasDraftQuotas) {
    return [];
  }

  const violations: ConstraintViolation[] = [];

  for (const member of context.staff) {
    const offDates = collectStaffOffDates(context, member.id);
    const offCount = offDates.size;
    const memberRequiredOffDays =
      context.staffDayOffQuotas?.[member.id] ?? requiredOffDays;

    if (memberRequiredOffDays !== null && memberRequiredOffDays !== undefined && offCount < memberRequiredOffDays) {
      violations.push({
        code: "DAY_OFF_QUOTA",
        source: "RULE",
        ruleTemplateId: ruleInstance.ruleTemplateId,
        ruleInstanceId: ruleInstance.id,
        severity: ruleInstance.severity,
        weight: ruleInstance.weight ?? undefined,
        messageTh: `ได้วันหยุด ${offCount} วัน น้อยกว่าโควตา ${memberRequiredOffDays} วัน`,
        staffId: member.id,
        details: {
          offCount,
          requiredOffDays: memberRequiredOffDays,
          deficit: memberRequiredOffDays - offCount,
          scope: params.scope ?? "GROUP",
        },
      });
    }

    if (minWeekendDaysOff > 0) {
      const weekendOffCount = [...offDates].filter(
        (date) => resolveDayType(date, context.holidayDates) === "WEEKEND",
      ).length;

      if (weekendOffCount < minWeekendDaysOff) {
        violations.push({
          code: "DAY_OFF_QUOTA",
          source: "RULE",
          ruleTemplateId: ruleInstance.ruleTemplateId,
          ruleInstanceId: ruleInstance.id,
          severity: ruleInstance.severity,
          weight: ruleInstance.weight ?? undefined,
          messageTh: `วันหยุดสุดสัปดาห์ ${weekendOffCount} วัน น้อยกว่าโควตา ${minWeekendDaysOff} วัน`,
          staffId: member.id,
          details: {
            weekendOffCount,
            minWeekendDaysOff,
            deficit: minWeekendDaysOff - weekendOffCount,
            scope: params.scope ?? "GROUP",
          },
        });
      }
    }
  }

  return violations;
};

/** คำนวณโควตาวันหยุดที่ต้องได้ — null ถ้าไม่ได้กำหนด */
function resolveRequiredOffDays(
  cycleStartDate: string,
  cycleEndDate: string,
  params: {
    daysOffPerCycle?: number;
    daysOffPerWeek?: number;
  },
): number | null {
  if (params.daysOffPerCycle !== undefined) {
    return params.daysOffPerCycle;
  }
  if (params.daysOffPerWeek !== undefined) {
    return params.daysOffPerWeek * countWeeksInCycle(cycleStartDate, cycleEndDate);
  }
  return null;
}
