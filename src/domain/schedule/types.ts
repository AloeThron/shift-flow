import type { OverrideClass, RuleSeverity } from "@/generated/client/client";

/** assignment ที่ validator/solver ใช้ — ไม่ผูก Prisma */
export type ScheduleAssignment = {
  id: string;
  staffId: string;
  shiftCodeId: string;
  scheduleDate: string;
  startAt: string;
  endAt: string;
  plannedOtHours?: number;
  isPinned?: boolean;
};

/** snapshot รหัสเวรต่อ org */
export type ShiftCodeSnapshot = {
  id: string;
  code: string;
  departmentId?: string;
  startTime: string;
  endTime: string;
  standardHours: number;
  otHours?: number;
  isNightShift?: boolean;
  allowedGradeIds: readonly string[];
  needsConfirmation: boolean;
  active: boolean;
};

/** snapshot บุคลากร */
export type StaffSnapshot = {
  id: string;
  gradeId: string;
  staffGroupId?: string;
  fte: number;
  shiftAuthorizations: readonly StaffShiftAuthorizationSnapshot[];
};

/** วันหยุดที่วางแผนใน draft — ผล Stage A + แหล่ง HC-002 */
/** snapshot วันหยุดที่วางแผนใน engine */
export type PlannedNonWorkingDaySnapshot = {
  staffId: string;
  localDate: string;
  nonWorkingDayKindId: string;
  blocksScheduling: boolean;
  locked?: boolean;
  source?: "REQUEST" | "QUOTA" | "MANUAL";
};

/** สรุป workload รายเดือนสำหรับ fairness carry-over */
export type StaffWorkloadMonthlySnapshot = {
  staffId: string;
  yearMonth: string;
  staffGroupId?: string;
  plannedHours: number;
  otHours: number;
  nightCount: number;
  weekendCount: number;
  holidayCount: number;
  workedDays: number;
  daysOff: number;
  fteAtPeriod: number;
};

/** authorization รหัสเวรของ staff */
export type StaffShiftAuthorizationSnapshot = {
  shiftCodeId: string | null;
  coversAllShiftCodes?: boolean;
  validFrom: string;
  validTo: string | null;
};

/** ความต้องการกำลังคนต่อรหัสเวร */
export type ShiftDemandSnapshot = {
  id: string;
  shiftCodeId: string;
  dayType: "WEEKDAY" | "WEEKEND" | "HOLIDAY" | "ALL";
  minCount: number;
  requiresLead: boolean;
};

/** rule instance ที่ bind กับ validation run */
export type RuleInstanceSnapshot = {
  id: string;
  ruleTemplateId: string;
  params: Record<string, unknown>;
  severity: RuleSeverity;
  weight: number | null;
  overrideClass: OverrideClass;
  enabled: boolean;
};

/** slot ว่างที่ solver ต้องเติม */
export type ScheduleSlot = {
  id: string;
  scheduleDate: string;
  shiftCodeId: string;
};

/** input ครบสำหรับ validate/feasibility/solver */
export type ScheduleEngineInput = {
  organizationId: string;
  timezone: string;
  cycleStartDate: string;
  cycleEndDate: string;
  assignments: readonly ScheduleAssignment[];
  boundaryAssignments?: readonly ScheduleAssignment[];
  staff: readonly StaffSnapshot[];
  shiftCodes: readonly ShiftCodeSnapshot[];
  shiftDemands: readonly ShiftDemandSnapshot[];
  ruleInstances: readonly RuleInstanceSnapshot[];
  holidayDates: readonly string[];
  plannedNonWorkingDays: readonly PlannedNonWorkingDaySnapshot[];
  staffWorkloadMonthly?: readonly StaffWorkloadMonthlySnapshot[];
  staffDayOffQuotas?: Readonly<Record<string, number>>;
};

/** ผล validate แยก hard/soft */
export type ValidationResult = {
  hardViolations: readonly ConstraintViolation[];
  softViolations: readonly ConstraintViolation[];
  isValid: boolean;
  softScore: number;
};

/** violation จาก invariant หรือ rule instance */
export type ConstraintViolation = {
  code: string;
  source: "INVARIANT" | "RULE";
  ruleTemplateId?: string;
  ruleInstanceId?: string;
  severity: RuleSeverity;
  weight?: number;
  messageTh: string;
  staffId?: string;
  assignmentId?: string;
  scheduleDate?: string;
  departmentId?: string;
  details?: Readonly<Record<string, unknown>>;
};

/** ประเภทปัญหา feasibility */
export type FeasibilityIssueKind =
  | "INSUFFICIENT_STAFF"
  | "MISSING_SHIFT_AUTH"
  | "COVERAGE_GAP"
  | "UNAVAILABLE_STAFF"
  | "UNCONFIRMED_CODE";

/** รายละเอียด feasibility ก่อน solve */
export type FeasibilityIssue = {
  kind: FeasibilityIssueKind;
  messageTh: string;
  scheduleDate?: string;
  departmentId?: string;
  shiftCodeId?: string;
  requirementId?: string;
  startTime?: string;
  endTime?: string;
  requiredCount?: number;
  matchedCount?: number;
  shortfallCount?: number;
  availableCount?: number;
  staffIds?: readonly string[];
};

export type FeasibilityResult = {
  feasible: boolean;
  issues: readonly FeasibilityIssue[];
};

export type SolverInput = ScheduleEngineInput & {
  slots: readonly ScheduleSlot[];
  randomSeed: string;
};

export type SolverResult = {
  assignments: readonly ScheduleAssignment[];
  validation: ValidationResult;
  feasibility: FeasibilityResult;
  iterations: number;
  solverVersion: string;
};
