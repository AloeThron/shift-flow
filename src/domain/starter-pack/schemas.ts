import { z } from "zod";

/** schema scheduling_policy.yaml */
export const schedulingPolicyYamlSchema = z.object({
  history_window_months: z.coerce.number().int().min(1).max(24).default(6),
  fairness_lookback_months: z.coerce.number().int().min(1).max(24).default(6),
  planning_horizon_months: z.coerce.number().int().min(1).max(3).default(1),
  publish_lead_days: z.coerce.number().int().min(0).max(90).default(7),
  ot_derivation_mode: z
    .enum(["SHIFT_CODE_ONLY", "PLANNED_OVERRIDE_ALLOWED"])
    .default("SHIFT_CODE_ONLY"),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** schema แถว departments.csv */
export const departmentRowSchema = z.object({
  code: z.string().min(1),
  display_name_th: z.string().min(1),
  display_name_en: z.string().min(1),
  sort_order: z.coerce.number().int().min(0),
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
});

/** @deprecated ใช้ departmentRowSchema */
export const workAreaRowSchema = departmentRowSchema;

/** schema แถว staff_grades.csv */
export const staffGradeRowSchema = z.object({
  code: z.string().min(1),
  display_name_th: z.string().min(1),
  sort_order: z.coerce.number().int().min(0),
  can_work_nights: z.enum(["true", "false"]).transform((value) => value === "true"),
});

/** schema แถว staff_groups.csv */
export const staffGroupRowSchema = z.object({
  code: z.string().min(1),
  display_name_th: z.string().min(1),
  sort_order: z.coerce.number().int().min(0),
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
});

/** schema แถว shift_codes.csv */
export const shiftCodeRowSchema = z.object({
  canonical_code: z.string().min(1),
  department_code: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  standard_hours: z.string(),
  ot_hours: z.coerce.number().min(0).default(0),
  is_night_shift: z.enum(["true", "false"]).transform((value) => value === "true"),
  staff_grade_codes: z.string(),
  needs_confirmation: z.enum(["true", "false"]).transform((value) => value === "true"),
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
});

/** schema แถว staff.csv */
export const staffRowSchema = z.object({
  staff_code: z.string().min(1),
  display_name: z.string().min(1),
  grade_code: z.string().min(1),
  staff_group_code: z.string().min(1),
  staff_group_section: z.enum(["RESULT_CAPABLE", "RESULT_NOT_CAPABLE", "PART_TIME"]),
  row_order: z.coerce.number().int().min(0),
  email: z.string().email(),
  fte: z.string(),
  contract_type: z.enum(["FULL_TIME", "PART_TIME", "NO_GUARANTEED_HOURS"]),
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
});

/** schema แถว staff_shift_authorization.csv */
export const staffShiftAuthorizationRowSchema = z.object({
  staff_code: z.string().min(1),
  shift_code: z.string(),
  level: z.string().min(1),
  authorized_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expiry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  authorizer_staff_code: z.string(),
});

/** schema แถว shift_demands.csv */
export const shiftDemandRowSchema = z.object({
  canonical_code: z.string().min(1),
  day_type: z.enum(["WEEKDAY", "WEEKEND", "HOLIDAY", "ALL"]),
  min_count: z.coerce.number().int().min(1),
  requires_lead: z.enum(["true", "false"]).transform((value) => value === "true"),
});

/** @deprecated ใช้ shiftDemandRowSchema */
export const coverageRequirementRowSchema = shiftDemandRowSchema;

/** schema แถว holidays.csv */
export const holidayRowSchema = z.object({
  local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name_th: z.string().min(1),
  name_en: z.string().min(1),
});

/** schema แถว roster_month_sample.csv — ตารางเวรเดือนตัวอย่าง */
export const rosterMonthSampleRowSchema = z.object({
  staff_code: z.string().min(1),
  local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  canonical_code: z.string().min(1),
  notes: z.string().optional().default(""),
});

/** schema organization.yaml แบบ key-value ง่าย */
export const organizationYamlSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  timezone: z.string().min(1),
  locale: z.string().min(1),
  description_th: z.string().min(1),
  description_en: z.string().min(1),
  disclaimer: z.string().min(1),
  pattern_reference: z.string().optional(),
});

/** schema manifest entry */
export const manifestEntrySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  path: z.string().min(1),
  display_name_th: z.string().min(1),
  display_name_en: z.string().min(1),
  complexity: z.enum(["low", "medium", "high"]),
  aliases: z.array(z.string()).default([]),
  disclaimer: z.string().min(1),
  requires_review: z.boolean().optional(),
  pattern_reference: z.string().optional(),
  apply_order: z.array(z.string()).min(1),
});

/** schema manifest ระดับ repo */
export const manifestSchema = z.object({
  version: z.coerce.number().int().min(1),
  packs: z.array(manifestEntrySchema).min(1),
});
