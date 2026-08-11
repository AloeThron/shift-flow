import { z } from "zod";

import type { OverrideClass, RuleSeverity } from "@/generated/client/client";

/** หมวด rule template */
export type RuleTemplateCategory =
  "SAFETY" | "LABOR" | "COVERAGE" | "COMPETENCY" | "FAIRNESS" | "PATTERN";

/** นิยาม rule template ใน registry */
export type RuleTemplateDefinition = {
  id: string;
  displayNameTh: string;
  descriptionTh: string;
  category: RuleTemplateCategory;
  paramSchema: z.ZodType<Record<string, unknown>>;
  defaultParams: Record<string, unknown>;
  defaultSeverity: RuleSeverity;
  allowedSeverities: readonly RuleSeverity[];
  defaultOverrideClass: OverrideClass;
  allowedOverrideClasses: readonly OverrideClass[];
  safetyLocked: boolean;
  validatorKey: string;
  constraintCatalogRef?: string;
};

const minRestParams = z.object({ minRestHours: z.number().min(0).max(48) });
const maxHoursParams = z.object({
  rollingWindowHours: z.number().int().min(1).max(168),
  maxHoursInWindow: z.number().min(0).max(48),
});
const maxNightsParams = z.object({
  maxConsecutiveNights: z.number().int().min(1).max(14),
  nightShiftCodes: z.array(z.string()).optional(),
});
const forbiddenSequenceParams = z.object({
  sequences: z.array(z.object({ from: z.string(), to: z.string() })),
});
const requiredCoverageParams = z.object({
  enforceFromCoverageRequirements: z.boolean().default(true),
});
const gradeWhitelistParams = z.object({
  enforceFromShiftCodes: z.boolean().default(true),
});
const preferredPatternParams = z.object({
  description: z.string().optional(),
  gradeCode: z.string().optional(),
  pattern: z.array(z.string()).optional(),
});
const maxConsecutiveDaysParams = z.object({
  maxConsecutiveDays: z.number().int().min(1).max(14),
  countOffAsBreak: z.boolean().default(true),
});
const fairDistributionParams = z.object({
  dimension: z.enum(["TOTAL_HOURS", "OT_HOURS", "NIGHT_SHIFTS", "WEEKEND_DAYS", "HOLIDAY_DAYS"]),
  scope: z.enum(["GROUP", "ORG"]).default("GROUP"),
  toleranceHours: z.number().min(0).max(48).default(4),
  normalizeByFte: z.boolean().default(true),
  lookbackMonths: z.number().int().min(1).max(12).default(6),
});
const dayOffQuotaParams = z
  .object({
    daysOffPerCycle: z.number().int().min(0).max(31).optional(),
    daysOffPerWeek: z.number().min(0).max(7).optional(),
    minWeekendDaysOff: z.number().int().min(0).max(8).default(0),
    scope: z.enum(["GROUP", "ORG", "STAFF"]).default("GROUP"),
  })
  .superRefine((value, ctx) => {
    if (value.daysOffPerCycle === undefined && value.daysOffPerWeek === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ต้องระบุ daysOffPerCycle หรือ daysOffPerWeek อย่างน้อยหนึ่งค่า",
      });
    }
  });
const maxStaffOffPerDayParams = z.object({
  maxOffWeekday: z.number().int().min(0).optional(),
  maxOffWeekend: z.number().int().min(0).optional(),
  maxOffHoliday: z.number().int().min(0).optional(),
  scope: z.enum(["GROUP", "ORG"]).default("GROUP"),
});
const otLimitParams = z
  .object({
    maxOtHoursPerStaffPerCycle: z.number().min(0).max(200).optional(),
    maxOtHoursPerOrgPerCycle: z.number().min(0).max(10000).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.maxOtHoursPerStaffPerCycle === undefined &&
      value.maxOtHoursPerOrgPerCycle === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "ต้องระบุ maxOtHoursPerStaffPerCycle หรือ maxOtHoursPerOrgPerCycle อย่างน้อยหนึ่งค่า",
      });
    }
  });

/** registry หลัก — อ้าง docs/domain/rule-templates.md */
export const RULE_TEMPLATE_REGISTRY: readonly RuleTemplateDefinition[] = [
  {
    id: "MIN_REST_BETWEEN_SHIFTS",
    displayNameTh: "พักขั้นต่ำระหว่างเวร",
    descriptionTh: "ระยะห่างระหว่างจบเวรหนึ่งกับเริ่มเวรถัดไปของคนเดียวกัน",
    category: "LABOR",
    paramSchema: minRestParams,
    defaultParams: { minRestHours: 11 },
    defaultSeverity: "HARD",
    allowedSeverities: ["HARD"],
    defaultOverrideClass: "NEVER",
    allowedOverrideClasses: ["NEVER"],
    safetyLocked: true,
    validatorKey: "validateMinRestBetweenShifts",
    constraintCatalogRef: "HC-005",
  },
  {
    id: "MAX_HOURS_IN_WINDOW",
    displayNameTh: "ชั่วโมงสูงสุดในกรอบเวลา",
    descriptionTh: "จำกัดชั่วโมงงานสะสมใน rolling window",
    category: "LABOR",
    paramSchema: maxHoursParams,
    defaultParams: { rollingWindowHours: 24, maxHoursInWindow: 16 },
    defaultSeverity: "HARD",
    allowedSeverities: ["HARD"],
    defaultOverrideClass: "NEVER",
    allowedOverrideClasses: ["NEVER"],
    safetyLocked: true,
    validatorKey: "validateMaxHoursInWindow",
    constraintCatalogRef: "HC-006",
  },
  {
    id: "MAX_CONSECUTIVE_NIGHTS",
    displayNameTh: "เวรดึกติดกันสูงสุด",
    descriptionTh: "จำกัดจำนวนเวรดึกติดกันต่อ staff",
    category: "LABOR",
    paramSchema: maxNightsParams,
    defaultParams: { maxConsecutiveNights: 3 },
    defaultSeverity: "SOFT",
    allowedSeverities: ["HARD", "SOFT"],
    defaultOverrideClass: "APPROVER_REQUIRED",
    allowedOverrideClasses: ["NEVER", "APPROVER_REQUIRED"],
    safetyLocked: false,
    validatorKey: "validateMaxConsecutiveNights",
    constraintCatalogRef: "HC-007",
  },
  {
    id: "MAX_CONSECUTIVE_DAYS",
    displayNameTh: "วันทำงานติดกันสูงสุด",
    descriptionTh: "จำกัดจำนวนวันที่มี assignment ติดกัน (นับตาม local date)",
    category: "LABOR",
    paramSchema: maxConsecutiveDaysParams,
    defaultParams: { maxConsecutiveDays: 6, countOffAsBreak: true },
    defaultSeverity: "HARD",
    allowedSeverities: ["HARD", "SOFT"],
    defaultOverrideClass: "NEVER",
    allowedOverrideClasses: ["NEVER", "APPROVER_REQUIRED"],
    safetyLocked: false,
    validatorKey: "validateMaxConsecutiveDays",
  },
  {
    id: "FORBIDDEN_CODE_SEQUENCE",
    displayNameTh: "ห้ามลำดับรหัสต่อกัน",
    descriptionTh: "ห้ามรหัสหนึ่งตามด้วยอีกรหัส เช่น กะดึกต่อกะเช้า",
    category: "LABOR",
    paramSchema: forbiddenSequenceParams,
    defaultParams: { sequences: [] },
    defaultSeverity: "HARD",
    allowedSeverities: ["HARD", "SOFT"],
    defaultOverrideClass: "NEVER",
    allowedOverrideClasses: ["NEVER", "APPROVER_REQUIRED"],
    safetyLocked: false,
    validatorKey: "validateForbiddenCodeSequence",
    constraintCatalogRef: "HC-008",
  },
  {
    id: "REQUIRED_COVERAGE",
    displayNameTh: "coverage ขั้นต่ำ",
    descriptionTh: "บังคับ coverage ตาม CoverageRequirement ขององค์กร",
    category: "COVERAGE",
    paramSchema: requiredCoverageParams,
    defaultParams: { enforceFromCoverageRequirements: true },
    defaultSeverity: "HARD",
    allowedSeverities: ["HARD"],
    defaultOverrideClass: "NEVER",
    allowedOverrideClasses: ["NEVER"],
    safetyLocked: true,
    validatorKey: "validateRequiredCoverage",
    constraintCatalogRef: "HC-004",
  },
  {
    id: "REQUIRED_COMPETENCY_IN_SHIFT",
    displayNameTh: "competency ต้องใช้ได้ตลอดเวร",
    descriptionTh: "ตรวจ authorization และวันหมดอายุตลอดช่วงเวร",
    category: "COMPETENCY",
    paramSchema: z.object({ enforceExpiry: z.boolean().default(true) }),
    defaultParams: { enforceExpiry: true },
    defaultSeverity: "HARD",
    allowedSeverities: ["HARD"],
    defaultOverrideClass: "NEVER",
    allowedOverrideClasses: ["NEVER"],
    safetyLocked: true,
    validatorKey: "validateRequiredCompetencyInShift",
    constraintCatalogRef: "HC-003",
  },
  {
    id: "GRADE_CODE_WHITELIST",
    displayNameTh: "ระดับพนักงานใช้รหัสได้",
    descriptionTh: "จำกัดรหัสเวรตาม allowedGradeCodes ใน ShiftCode",
    category: "LABOR",
    paramSchema: gradeWhitelistParams,
    defaultParams: { enforceFromShiftCodes: true },
    defaultSeverity: "HARD",
    allowedSeverities: ["HARD"],
    defaultOverrideClass: "NEVER",
    allowedOverrideClasses: ["NEVER"],
    safetyLocked: false,
    validatorKey: "validateGradeCodeWhitelist",
  },
  {
    id: "FAIR_DISTRIBUTION",
    displayNameTh: "กระจายเวรอย่างเป็นธรรม",
    descriptionTh: "ลดความไม่สมดุลของชั่วโมง OT เวรดึก วันหยุด ตาม FTE และ carry-over ข้ามรอบ",
    category: "FAIRNESS",
    paramSchema: fairDistributionParams,
    defaultParams: {
      dimension: "TOTAL_HOURS",
      scope: "GROUP",
      toleranceHours: 4,
      normalizeByFte: true,
      lookbackMonths: 6,
    },
    defaultSeverity: "SOFT",
    allowedSeverities: ["SOFT"],
    defaultOverrideClass: "SCHEDULER_ALLOWED",
    allowedOverrideClasses: ["SCHEDULER_ALLOWED", "APPROVER_REQUIRED"],
    safetyLocked: false,
    validatorKey: "validateFairDistribution",
    constraintCatalogRef: "SC-001, SC-002, SC-007",
  },
  {
    id: "DAY_OFF_QUOTA",
    displayNameTh: "โควตาวันหยุดต่อเดือน",
    descriptionTh: "จำนวนวันหยุดที่แต่ละคนต้องได้ในรอบ — อินพุต Stage A",
    category: "LABOR",
    paramSchema: dayOffQuotaParams,
    defaultParams: { daysOffPerCycle: 8, minWeekendDaysOff: 0, scope: "GROUP" },
    defaultSeverity: "HARD",
    allowedSeverities: ["HARD", "SOFT"],
    defaultOverrideClass: "APPROVER_REQUIRED",
    allowedOverrideClasses: ["NEVER", "APPROVER_REQUIRED"],
    safetyLocked: false,
    validatorKey: "validateDayOffQuota",
    constraintCatalogRef: "HC-010",
  },
  {
    id: "MAX_STAFF_OFF_PER_DAY",
    displayNameTh: "เพดานคนหยุดพร้อมกันต่อวัน",
    descriptionTh: "capacity ของ Stage A — แยกวันธรรมดา/สุดสัปดาห์/วันหยุดนักขัตฤกษ์",
    category: "COVERAGE",
    paramSchema: maxStaffOffPerDayParams,
    defaultParams: { maxOffWeekday: 2, scope: "GROUP" },
    defaultSeverity: "HARD",
    allowedSeverities: ["HARD", "SOFT"],
    defaultOverrideClass: "APPROVER_REQUIRED",
    allowedOverrideClasses: ["NEVER", "APPROVER_REQUIRED"],
    safetyLocked: false,
    validatorKey: "validateMaxStaffOffPerDay",
    constraintCatalogRef: "HC-011",
  },
  {
    id: "OT_LIMIT",
    displayNameTh: "เพดาน OT ต่อเดือน",
    descriptionTh: "จำกัด OT สะสมต่อคนและ/หรือทั้งองค์กร — capacity Stage B",
    category: "LABOR",
    paramSchema: otLimitParams,
    defaultParams: { maxOtHoursPerStaffPerCycle: 20 },
    defaultSeverity: "HARD",
    allowedSeverities: ["HARD"],
    defaultOverrideClass: "NEVER",
    allowedOverrideClasses: ["NEVER"],
    safetyLocked: true,
    validatorKey: "validateOtLimit",
    constraintCatalogRef: "HC-012",
  },
  {
    id: "PREFERRED_PATTERN",
    displayNameTh: "รูปแบบหมุนเวียนที่ต้องการ",
    descriptionTh: "soft constraint สำหรับ pattern หมุนเวียน เช่น ผู้ช่วย",
    category: "PATTERN",
    paramSchema: preferredPatternParams,
    defaultParams: { description: "", pattern: [] },
    defaultSeverity: "SOFT",
    allowedSeverities: ["SOFT"],
    defaultOverrideClass: "SCHEDULER_ALLOWED",
    allowedOverrideClasses: ["SCHEDULER_ALLOWED", "APPROVER_REQUIRED"],
    safetyLocked: false,
    validatorKey: "validatePreferredPattern",
    constraintCatalogRef: "SC-004",
  },
] as const;

/** ค้นหา template จาก id */
export function getRuleTemplate(id: string): RuleTemplateDefinition | undefined {
  return RULE_TEMPLATE_REGISTRY.find((template) => template.id === id);
}

/** validate params ตาม template schema */
export function validateRuleParams(
  templateId: string,
  params: unknown,
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const template = getRuleTemplate(templateId);
  if (!template) {
    return { ok: false, error: "ไม่พบ rule template" };
  }

  const parsed = template.paramSchema.safeParse(params);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((issue) => issue.message).join(", ") };
  }

  return { ok: true, data: parsed.data };
}
