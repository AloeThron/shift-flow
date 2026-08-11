import { getRuleTemplate } from "@/domain/rules/registry";
import { validateSchedulingPolicyValues } from "@/domain/scheduling/policy";

import { validateNormalizedRuleParams } from "./normalize-rule-params";
import type { StarterPackSnapshot, StarterPackValidationResult } from "./types";

/** ตรวจ cross-reference ภายใน starter pack snapshot */
export function validateStarterPack(snapshot: StarterPackSnapshot): StarterPackValidationResult {
  const errors: string[] = [];

  const gradeCodes = new Set(snapshot.staffGrades.map((row) => row.code));
  const staffGroupCodes = new Set(snapshot.staffGroups.map((row) => row.code));
  const departmentCodes = new Set(snapshot.departments.map((row) => row.code));
  const staffCodes = new Set(snapshot.staff.map((row) => row.staffCode));
  const shiftCodeSet = new Set(snapshot.shiftCodes.map((row) => row.canonicalCode));

  for (const row of snapshot.shiftCodes) {
    if (row.departmentCode && !departmentCodes.has(row.departmentCode)) {
      errors.push(`shift code ${row.canonicalCode}: ไม่พบแผนก ${row.departmentCode}`);
    }

    for (const gradeCode of row.staffGradeCodes) {
      if (!gradeCodes.has(gradeCode)) {
        errors.push(`shift code ${row.canonicalCode}: ไม่พบ grade ${gradeCode}`);
      }
    }
  }

  for (const row of snapshot.staff) {
    if (!gradeCodes.has(row.gradeCode)) {
      errors.push(`staff ${row.staffCode}: ไม่พบ grade ${row.gradeCode}`);
    }
    if (!staffGroupCodes.has(row.staffGroupCode)) {
      errors.push(`staff ${row.staffCode}: ไม่พบ staff group ${row.staffGroupCode}`);
    }
  }

  for (const row of snapshot.staffShiftAuthorization) {
    if (!staffCodes.has(row.staffCode)) {
      errors.push(`staff shift auth ${row.staffCode}: ไม่พบ staff`);
    }
    if (row.shiftCode && !shiftCodeSet.has(row.shiftCode)) {
      errors.push(`staff shift auth ${row.staffCode}: ไม่พบรหัสเวร ${row.shiftCode}`);
    }
    if (row.authorizerStaffCode && !staffCodes.has(row.authorizerStaffCode)) {
      errors.push(
        `staff shift auth ${row.staffCode}: ไม่พบ authorizer ${row.authorizerStaffCode}`,
      );
    }
  }

  for (const row of snapshot.shiftDemands) {
    if (!shiftCodeSet.has(row.canonicalCode)) {
      errors.push(`demand ${row.canonicalCode}: ไม่พบ shift code`);
    }
  }

  for (const row of snapshot.ruleInstances) {
    const template = getRuleTemplate(row.ruleTemplateId);
    if (!template) {
      errors.push(`rule ${row.ruleTemplateId}: ไม่พบใน registry`);
      continue;
    }

    const validated = validateNormalizedRuleParams(row.ruleTemplateId, row.params);
    if (!validated.ok) {
      errors.push(`rule ${row.ruleTemplateId}: ${validated.error}`);
    }
  }

  const policyErrors = validateSchedulingPolicyValues({
    historyWindowMonths: snapshot.schedulingPolicy.historyWindowMonths,
    fairnessLookbackMonths: snapshot.schedulingPolicy.fairnessLookbackMonths,
    planningHorizonMonths: snapshot.schedulingPolicy.planningHorizonMonths,
    publishLeadDays: snapshot.schedulingPolicy.publishLeadDays,
  });
  errors.push(...policyErrors);

  for (const row of snapshot.rosterMonthSample) {
    if (!staffCodes.has(row.staffCode)) {
      errors.push(`roster ${row.localDate}: ไม่พบ staff ${row.staffCode}`);
    }
    const resolvedCode = row.canonicalCode;
    if (!shiftCodeSet.has(resolvedCode)) {
      errors.push(`roster ${row.staffCode} ${row.localDate}: ไม่พบรหัสเวร ${row.canonicalCode}`);
    }
  }

  if (snapshot.staff.length === 0) {
    errors.push("staff.csv ว่าง");
  }

  if (snapshot.shiftCodes.length === 0) {
    errors.push("shift_codes.csv ว่าง");
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
