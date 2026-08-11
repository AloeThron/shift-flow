import type { OverrideClass, RuleSeverity } from "@/generated/client/client";

/** รายการ pack ใน manifest ระดับ repo */
export type StarterPackManifestEntry = {
  id: string;
  slug: string;
  path: string;
  displayNameTh: string;
  displayNameEn: string;
  complexity: "low" | "medium" | "high";
  aliases: readonly string[];
  disclaimer: string;
  requiresReview?: boolean;
  patternReference?: string;
  applyOrder: readonly string[];
};

/** manifest ทั้งหมด */
export type StarterPackManifest = {
  version: number;
  packs: readonly StarterPackManifestEntry[];
};

/** metadata องค์กรใน pack */
export type StarterPackOrganization = {
  name: string;
  slug: string;
  timezone: string;
  locale: string;
  descriptionTh: string;
  descriptionEn: string;
  disclaimer: string;
  patternReference?: string;
};

/** แถวแผนก */
export type DepartmentRow = {
  code: string;
  displayNameTh: string;
  displayNameEn: string;
  sortOrder: number;
  active: boolean;
};

/** @deprecated ใช้ DepartmentRow */
export type WorkAreaRow = DepartmentRow & { departmentCode: string };

/** แถว staff grade */
export type StaffGradeRow = {
  code: string;
  displayNameTh: string;
  sortOrder: number;
  canWorkNights: boolean;
};

/** แถว staff group — หัวข้อ canvas + ขอบเขต fairness */
export type StaffGroupRow = {
  code: string;
  displayNameTh: string;
  sortOrder: number;
  active: boolean;
};

/** แถว shift code */
export type ShiftCodeRow = {
  canonicalCode: string;
  departmentCode: string;
  startTime: string;
  endTime: string;
  standardHours: number | null;
  otHours: number;
  isNightShift: boolean;
  staffGradeCodes: readonly string[];
  needsConfirmation: boolean;
  active: boolean;
};

/** แถว staff */
export type StaffRow = {
  staffCode: string;
  displayName: string;
  gradeCode: string;
  staffGroupCode: string;
  staffGroupSection: "RESULT_CAPABLE" | "RESULT_NOT_CAPABLE" | "PART_TIME";
  rowOrder: number;
  email: string;
  fte: string;
  contractType: "FULL_TIME" | "PART_TIME" | "NO_GUARANTEED_HOURS";
  active: boolean;
};

/** แถว staff shift authorization */
export type StaffShiftAuthorizationRow = {
  staffCode: string;
  shiftCode: string;
  level: string;
  authorizedDate: string;
  expiryDate: string | null;
  authorizerStaffCode: string;
};

/** ชนิดวันใน demand CSV */
export type CoverageDayType = "WEEKDAY" | "WEEKEND" | "HOLIDAY" | "ALL";

/** แถว shift code demand */
export type ShiftDemandRow = {
  canonicalCode: string;
  dayType: CoverageDayType;
  minCount: number;
  requiresLead: boolean;
};

/** @deprecated ใช้ ShiftDemandRow */
export type CoverageRequirementRow = ShiftDemandRow & {
  workAreaCode: string;
  startTime: string;
  endTime: string;
};

/** แถววันหยุด */
export type HolidayRow = {
  localDate: string;
  nameTh: string;
  nameEn: string;
};

/** แถวตารางเวรเดือนตัวอย่าง (long format) */
export type RosterMonthSampleRow = {
  staffCode: string;
  localDate: string;
  canonicalCode: string;
  notes: string;
};

/** rule instance ใน pack */
export type RuleInstancePackRow = {
  ruleTemplateId: string;
  enabled: boolean;
  severity: RuleSeverity;
  overrideClass: OverrideClass;
  params: Record<string, unknown>;
};

/** นโยบายจัดตารางจาก scheduling_policy.yaml */
export type SchedulingPolicyPackRow = {
  historyWindowMonths: number;
  fairnessLookbackMonths: number;
  planningHorizonMonths: number;
  publishLeadDays: number;
  otDerivationMode: "SHIFT_CODE_ONLY" | "PLANNED_OVERRIDE_ALLOWED";
  effectiveFrom: string;
};

/** snapshot ที่โหลดจาก disk ครบชุด */
export type StarterPackSnapshot = {
  packId: string;
  packPath: string;
  organization: StarterPackOrganization;
  schedulingPolicy: SchedulingPolicyPackRow;
  departments: readonly DepartmentRow[];
  staffGrades: readonly StaffGradeRow[];
  staffGroups: readonly StaffGroupRow[];
  shiftCodes: readonly ShiftCodeRow[];
  staff: readonly StaffRow[];
  staffShiftAuthorization: readonly StaffShiftAuthorizationRow[];
  shiftDemands: readonly ShiftDemandRow[];
  holidays: readonly HolidayRow[];
  rosterMonthSample: readonly RosterMonthSampleRow[];
  ruleInstances: readonly RuleInstancePackRow[];
};

/** ผล validate pack */
export type StarterPackValidationResult = { ok: true } | { ok: false; errors: readonly string[] };

/** สถิติหลัง apply */
export type StarterPackApplyStats = {
  departments: number;
  staffGrades: number;
  staffGroups: number;
  shiftCodes: number;
  staffProfiles: number;
  staffShiftAuthorizations: number;
  shiftCodeDemands: number;
  holidayDates: number;
  ruleInstances: number;
  rosterAssignments: number;
  skippedRuleTemplates: readonly string[];
};
