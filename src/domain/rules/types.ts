import type { ConstraintViolation, ScheduleEngineInput } from "@/domain/schedule/types";

/** context ที่ส่งให้ invariant และ validator */
export type ValidationContext = ScheduleEngineInput & {
  shiftCodeById: ReadonlyMap<string, ScheduleEngineInput["shiftCodes"][number]>;
  staffById: ReadonlyMap<string, ScheduleEngineInput["staff"][number]>;
  allAssignments: readonly ScheduleEngineInput["assignments"][number][];
};

/** ฟังก์ชัน validate ต่อ rule template */
export type RuleValidatorFn = (
  context: ValidationContext,
  ruleInstance: ScheduleEngineInput["ruleInstances"][number],
) => readonly ConstraintViolation[];

/** ฟังก์ชัน invariant ระดับ engine */
export type InvariantValidatorFn = (context: ValidationContext) => readonly ConstraintViolation[];
