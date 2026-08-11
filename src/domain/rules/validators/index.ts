import type { RuleValidatorFn } from "@/domain/rules/types";
import { validateDayOffQuota } from "./day-off-quota";
import { validateFairDistribution } from "./fair-distribution";
import { validateForbiddenCodeSequence } from "./forbidden-code-sequence";
import { validateGradeCodeWhitelist } from "./grade-code-whitelist";
import { validateMaxConsecutiveDays } from "./max-consecutive-days";
import { validateMaxConsecutiveNights } from "./max-consecutive-nights";
import { validateMaxHoursInWindow } from "./max-hours-in-window";
import { validateMaxStaffOffPerDay } from "./max-staff-off-per-day";
import { validateMinRestBetweenShifts } from "./min-rest-between-shifts";
import { validateOtLimit } from "./ot-limit";
import { validatePreferredPattern } from "./preferred-pattern";
import { validateRequiredCompetencyInShift } from "./required-competency-in-shift";
import { validateRequiredCoverage } from "./required-coverage";

/** map validatorKey → pure function */
export const RULE_VALIDATOR_REGISTRY: Readonly<Record<string, RuleValidatorFn>> = {
  validateMinRestBetweenShifts,
  validateMaxHoursInWindow,
  validateMaxConsecutiveNights,
  validateMaxConsecutiveDays,
  validateForbiddenCodeSequence,
  validateRequiredCoverage,
  validateRequiredCompetencyInShift,
  validateGradeCodeWhitelist,
  validateFairDistribution,
  validateDayOffQuota,
  validateMaxStaffOffPerDay,
  validateOtLimit,
  validatePreferredPattern,
};

/** ค้นหา validator จาก template id */
export function getRuleValidator(ruleTemplateId: string): RuleValidatorFn | undefined {
  const keyByTemplate: Readonly<Record<string, string>> = {
    MIN_REST_BETWEEN_SHIFTS: "validateMinRestBetweenShifts",
    MAX_HOURS_IN_WINDOW: "validateMaxHoursInWindow",
    MAX_CONSECUTIVE_NIGHTS: "validateMaxConsecutiveNights",
    MAX_CONSECUTIVE_DAYS: "validateMaxConsecutiveDays",
    FORBIDDEN_CODE_SEQUENCE: "validateForbiddenCodeSequence",
    REQUIRED_COVERAGE: "validateRequiredCoverage",
    REQUIRED_COMPETENCY_IN_SHIFT: "validateRequiredCompetencyInShift",
    GRADE_CODE_WHITELIST: "validateGradeCodeWhitelist",
    FAIR_DISTRIBUTION: "validateFairDistribution",
    DAY_OFF_QUOTA: "validateDayOffQuota",
    MAX_STAFF_OFF_PER_DAY: "validateMaxStaffOffPerDay",
    OT_LIMIT: "validateOtLimit",
    PREFERRED_PATTERN: "validatePreferredPattern",
  };

  const key = keyByTemplate[ruleTemplateId];
  return key ? RULE_VALIDATOR_REGISTRY[key] : undefined;
}

export {
  validateDayOffQuota,
  validateFairDistribution,
  validateForbiddenCodeSequence,
  validateGradeCodeWhitelist,
  validateMaxConsecutiveDays,
  validateMaxConsecutiveNights,
  validateMaxHoursInWindow,
  validateMaxStaffOffPerDay,
  validateMinRestBetweenShifts,
  validateOtLimit,
  validatePreferredPattern,
  validateRequiredCompetencyInShift,
  validateRequiredCoverage,
};
