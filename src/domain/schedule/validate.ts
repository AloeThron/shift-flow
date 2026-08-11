import { runEngineInvariants } from "@/domain/rules/invariants";
import type { ValidationContext } from "@/domain/rules/types";
import { getRuleValidator } from "@/domain/rules/validators";
import type {
    ConstraintViolation,
    ScheduleEngineInput,
    ValidationResult,
} from "@/domain/schedule/types";

/** input เก่าที่ยังส่ง coverageRequirements มาจาก bundle/cache ก่อนย้าย model */
type LegacyScheduleEngineInput = ScheduleEngineInput & {
  coverageRequirements?: ScheduleEngineInput["shiftDemands"];
};

/** เพิ่ม alias legacy สำหรับ client bundle เก่าระหว่าง HMR */
export function withLegacyShiftDemandAlias(
  input: ScheduleEngineInput,
): ScheduleEngineInput & { coverageRequirements: ScheduleEngineInput["shiftDemands"] } {
  return {
    ...input,
    shiftDemands: resolveShiftDemands(input),
    coverageRequirements: resolveShiftDemands(input),
  };
}

/** รวม shiftDemands จาก field ใหม่หรือ legacy alias */
function resolveShiftDemands(
  input: ScheduleEngineInput,
): ScheduleEngineInput["shiftDemands"] {
  if (input.shiftDemands !== undefined) {
    return input.shiftDemands;
  }

  const legacy = input as LegacyScheduleEngineInput;
  return legacy.coverageRequirements ?? [];
}

/** สร้าง lookup maps สำหรับ validation context */
export function buildValidationContext(input: ScheduleEngineInput): ValidationContext {
  const shiftCodeById = new Map(input.shiftCodes.map((code) => [code.id, code]));
  const staffById = new Map(input.staff.map((member) => [member.id, member]));
  const boundary = input.boundaryAssignments ?? [];
  const allAssignments = [...boundary, ...input.assignments];
  const normalizedInput: ScheduleEngineInput = {
    ...input,
    shiftDemands: resolveShiftDemands(input),
  };

  return {
    ...normalizedInput,
    shiftCodeById,
    staffById,
    allAssignments,
  };
}

/** รวม soft score — ค่าน้อยดีกว่า */
export function computeSoftScore(violations: readonly ConstraintViolation[]): number {
  return violations.reduce((total, violation) => total + (violation.weight ?? 1), 0);
}

/** validate schedule จาก rule instance + engine invariants */
export function validateSchedule(input: ScheduleEngineInput): ValidationResult {
  const context = buildValidationContext(input);
  const invariantViolations = runEngineInvariants(context);

  const ruleViolations = input.ruleInstances
    .filter((instance) => instance.enabled)
    .flatMap((instance) => {
      const validator = getRuleValidator(instance.ruleTemplateId);
      if (!validator) {
        return [];
      }
      return validator(context, instance);
    });

  const allViolations = [...invariantViolations, ...ruleViolations];
  const hardViolations = allViolations.filter((item) => item.severity === "HARD");
  const softViolations = allViolations.filter((item) => item.severity === "SOFT");

  return {
    hardViolations,
    softViolations,
    isValid: hardViolations.length === 0,
    softScore: computeSoftScore(softViolations),
  };
}

/** ตรวจว่า assignment ใหม่ยังผ่าน hard constraints */
export function wouldAssignmentViolateHard(
  input: ScheduleEngineInput,
  candidate: ScheduleEngineInput["assignments"][number],
): boolean {
  const merged: ScheduleEngineInput = {
    ...input,
    assignments: [...input.assignments, candidate],
  };
  return !validateSchedule(merged).isValid;
}

/** ขอบเขตการ validate แบบ incremental — ใช้ตอนแก้เซลล์ใน canvas */
export type IncrementalValidationScope = {
  readonly changedStaffIds: readonly string[];
  readonly changedDates: readonly string[];
};

/** ตรวจว่า violation เกี่ยวข้องกับ staff/วันที่ที่เปลี่ยนหรือเป็น global */
function violationMatchesScope(
  violation: ConstraintViolation,
  staffSet: ReadonlySet<string>,
  dateSet: ReadonlySet<string>,
): boolean {
  const hasStaff = violation.staffId !== undefined;
  const hasDate = violation.scheduleDate !== undefined;

  if (!hasStaff && !hasDate) {
    return true;
  }

  if (violation.staffId && staffSet.has(violation.staffId)) {
    return true;
  }

  if (violation.scheduleDate && dateSet.has(violation.scheduleDate)) {
    return true;
  }

  return false;
}

/** validate แบบ incremental — รันเต็มแล้วกรอง violation ที่เกี่ยวข้องกับ scope */
export function validateIncremental(
  input: ScheduleEngineInput,
  scope: IncrementalValidationScope,
): ValidationResult {
  const full = validateSchedule(input);
  const staffSet = new Set(scope.changedStaffIds);
  const dateSet = new Set(scope.changedDates);

  const filterRelevant = (violations: readonly ConstraintViolation[]) =>
    violations.filter((violation) => violationMatchesScope(violation, staffSet, dateSet));

  return {
    hardViolations: filterRelevant(full.hardViolations),
    softViolations: filterRelevant(full.softViolations),
    isValid: full.isValid,
    softScore: full.softScore,
  };
}
