import { isStaffOffOnDate } from "@/domain/rules/helpers/schedule-metrics";
import type { RuleValidatorFn } from "@/domain/rules/types";
import { eachDateInRange, resolveDayType } from "@/domain/schedule/time";
import type { ConstraintViolation } from "@/domain/schedule/types";

/** HC-011 — เพดานคนหยุดพร้อมกันต่อวัน */
export const validateMaxStaffOffPerDay: RuleValidatorFn = (context, ruleInstance) => {
  const params = ruleInstance.params as {
    maxOffWeekday?: number;
    maxOffWeekend?: number;
    maxOffHoliday?: number;
    scope?: "GROUP" | "ORG";
  };

  const scope = params.scope ?? "GROUP";
  const violations: ConstraintViolation[] = [];
  const cycleDates = eachDateInRange(context.cycleStartDate, context.cycleEndDate);

  for (const date of cycleDates) {
    const dayType = resolveDayType(date, context.holidayDates);
    const maxOff = resolveMaxOffForDayType(dayType, params);

    if (maxOff === undefined) {
      continue;
    }

    const offCounts = countOffStaffByScope(context, date, scope);

    for (const [scopeKey, offStaffIds] of offCounts) {
      if (offStaffIds.length <= maxOff) {
        continue;
      }

      violations.push({
        code: "MAX_STAFF_OFF_PER_DAY",
        source: "RULE",
        ruleTemplateId: ruleInstance.ruleTemplateId,
        ruleInstanceId: ruleInstance.id,
        severity: ruleInstance.severity,
        weight: ruleInstance.weight ?? undefined,
        messageTh: `วันที่ ${date} มีคนหยุด ${offStaffIds.length} คน เกินเพดาน ${maxOff} คน`,
        scheduleDate: date,
        details: {
          dayType,
          scope,
          scopeKey,
          offCount: offStaffIds.length,
          maxOff,
          staffIds: offStaffIds,
        },
      });
    }
  }

  return violations;
};

/** เพดานตามประเภทวัน */
function resolveMaxOffForDayType(
  dayType: "WEEKDAY" | "WEEKEND" | "HOLIDAY",
  params: {
    maxOffWeekday?: number;
    maxOffWeekend?: number;
    maxOffHoliday?: number;
  },
): number | undefined {
  switch (dayType) {
    case "HOLIDAY":
      return params.maxOffHoliday ?? params.maxOffWeekend ?? params.maxOffWeekday;
    case "WEEKEND":
      return params.maxOffWeekend ?? params.maxOffWeekday;
    case "WEEKDAY":
      return params.maxOffWeekday;
    default: {
      const exhaustive: never = dayType;
      return exhaustive;
    }
  }
}

/** นับ staff ที่หยุดต่อ scope key */
function countOffStaffByScope(
  context: Parameters<RuleValidatorFn>[0],
  date: string,
  scope: "GROUP" | "ORG",
): ReadonlyMap<string, readonly string[]> {
  const counts = new Map<string, string[]>();

  for (const member of context.staff) {
    if (!isStaffOffOnDate(context, member.id, date)) {
      continue;
    }

    const key = scope === "GROUP" ? (member.staffGroupId ?? "__ungrouped__") : "__org__";
    const list = counts.get(key) ?? [];
    list.push(member.id);
    counts.set(key, list);
  }

  return counts;
}
