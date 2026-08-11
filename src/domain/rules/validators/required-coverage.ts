import { staffHasShiftAuthForInterval } from "@/domain/schedule/shift-auth";
import type { RuleValidatorFn } from "@/domain/rules/types";
import {
  buildAssignmentInterval,
  demandAppliesToDate,
  eachDateInRange,
} from "@/domain/schedule/time";
import type { ConstraintViolation } from "@/domain/schedule/types";

/** ตรวจว่า staff มีสิทธิรหัสเวรครอบคลุมช่วงเวร */
function hasShiftAuthThroughShift(
  staffId: string,
  shiftCodeId: string,
  startAt: string,
  endAt: string,
  context: Parameters<RuleValidatorFn>[0],
): boolean {
  const staff = context.staffById.get(staffId);
  if (!staff) {
    return false;
  }

  const startMs = Date.parse(startAt);
  const endMs = Date.parse(endAt);

  return staffHasShiftAuthForInterval(staff.shiftAuthorizations, shiftCodeId, startMs, endMs);
}

/** HC-004 — ความต้องการกำลังคนขั้นต่ำต่อรหัสเวร */
export const validateRequiredCoverage: RuleValidatorFn = (context, ruleInstance) => {
  const params = ruleInstance.params as { enforceFromShiftDemands?: boolean };
  if (params.enforceFromShiftDemands === false) {
    return [];
  }

  const violations: ConstraintViolation[] = [];
  const dates = eachDateInRange(context.cycleStartDate, context.cycleEndDate);

  for (const date of dates) {
    for (const demand of context.shiftDemands) {
      if (!demandAppliesToDate(demand, date, context.holidayDates)) {
        continue;
      }

      const shiftCode = context.shiftCodeById.get(demand.shiftCodeId);
      if (!shiftCode) {
        continue;
      }

      const interval = buildAssignmentInterval(shiftCode, date, context.timezone);

      let matched = 0;
      for (const assignment of context.allAssignments) {
        if (assignment.shiftCodeId !== demand.shiftCodeId) {
          continue;
        }
        if (assignment.scheduleDate !== date) {
          continue;
        }

        if (
          !hasShiftAuthThroughShift(
            assignment.staffId,
            demand.shiftCodeId,
            assignment.startAt,
            assignment.endAt,
            context,
          )
        ) {
          continue;
        }

        matched += 1;
      }

      if (matched < demand.minCount) {
        violations.push({
          code: "REQUIRED_COVERAGE",
          source: "RULE",
          ruleTemplateId: ruleInstance.ruleTemplateId,
          ruleInstanceId: ruleInstance.id,
          severity: ruleInstance.severity,
          weight: ruleInstance.weight ?? undefined,
          messageTh: `coverage ไม่ครบ: ได้ ${matched}/${demand.minCount} คน`,
          scheduleDate: date,
          departmentId: shiftCode.departmentId,
          details: {
            requirementId: demand.id,
            shiftCodeId: demand.shiftCodeId,
            matched,
            minCount: demand.minCount,
            startAt: interval.startAt,
            endAt: interval.endAt,
          },
        });
      }
    }
  }

  return violations;
};
