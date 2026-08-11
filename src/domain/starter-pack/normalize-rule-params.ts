import { getRuleTemplate, validateRuleParams } from "@/domain/rules/registry";

/** แปลง params ใน pack ให้ตรง schema ของ rule registry */
export function normalizeRuleParams(
  ruleTemplateId: string,
  rawParams: Record<string, unknown>,
): Record<string, unknown> {
  switch (ruleTemplateId) {
    case "MAX_HOURS_IN_WINDOW": {
      const maxHours = rawParams.maxHours;
      const windowDays = rawParams.windowDays;
      if (typeof maxHours === "number" && typeof windowDays === "number") {
        return {
          rollingWindowHours: windowDays * 24,
          maxHoursInWindow: maxHours,
        };
      }
      return rawParams;
    }
    case "MAX_CONSECUTIVE_NIGHTS": {
      const maxNights = rawParams.maxNights ?? rawParams.maxConsecutiveNights;
      const nightCodes = rawParams.nightCodes ?? rawParams.nightShiftCodes;
      const nightCodePattern = rawParams.nightCodePattern;

      const normalized: Record<string, unknown> = {};
      if (typeof maxNights === "number") {
        normalized.maxConsecutiveNights = maxNights;
      }
      if (Array.isArray(nightCodes)) {
        normalized.nightShiftCodes = nightCodes;
      } else if (typeof nightCodePattern === "string" && nightCodePattern.length > 0) {
        normalized.nightShiftCodes = nightCodePattern.endsWith("-*")
          ? [nightCodePattern.replace("-*", "")]
          : [nightCodePattern];
      }
      return Object.keys(normalized).length > 0 ? normalized : rawParams;
    }
    case "MAX_CONSECUTIVE_DAYS": {
      const maxDays = rawParams.maxDays ?? rawParams.maxConsecutiveDays;
      if (typeof maxDays === "number") {
        return { maxConsecutiveDays: maxDays };
      }
      return rawParams;
    }
    case "REQUIRED_COVERAGE":
      if ("sourceFile" in rawParams) {
        return { enforceFromCoverageRequirements: true };
      }
      return rawParams;
    case "GRADE_CODE_WHITELIST":
      if ("sourceFile" in rawParams) {
        return { enforceFromShiftCodes: true };
      }
      return rawParams;
    default:
      return rawParams;
  }
}

/** ตรวจ params หลัง normalize กับ registry */
export function validateNormalizedRuleParams(
  ruleTemplateId: string,
  rawParams: Record<string, unknown>,
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const template = getRuleTemplate(ruleTemplateId);
  if (!template) {
    return { ok: false, error: `ไม่พบ rule template: ${ruleTemplateId}` };
  }

  const normalized = normalizeRuleParams(ruleTemplateId, rawParams);
  return validateRuleParams(ruleTemplateId, normalized);
}
