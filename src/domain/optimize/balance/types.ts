import type {
    RuleInstanceSnapshot,
    ScheduleAssignment,
    ScheduleEngineInput,
    ScheduleSlot,
    ShiftCodeSnapshot,
} from "@/domain/schedule/types";

/** ประเภท slot ใน Stage B */
export type BalanceSlotKind = "MANDATORY" | "FILL";

/** ที่มาของ slot — demand จาก ShiftCodeDemand หรือเติมส่วนเกิน */
export type BalanceSlotOrigin = "DEMAND" | "FILL";

/** สรุป fill ต่อวัน — ใช้ fillPool → fillCode แทน slot ราย index */
export type FillPool = {
  readonly id: string;
  readonly scheduleDate: string;
  readonly count: number;
};

/** slot ที่ Stage B จับคู่ — demand บังคับ หรือ fill ทางเลือก (ไม่ผูกรหัสตั้งแต่ต้น) */
export type BalanceSlot = {
  readonly id: string;
  readonly scheduleDate: string;
  readonly shiftCodeId?: string;
  readonly kind: BalanceSlotKind;
  readonly origin: BalanceSlotOrigin;
  readonly standardHours?: number;
  readonly otHours?: number;
  readonly staffGroupId?: string;
};

/** น้ำหนักต้นทุนเพิ่มบน arc slot→staffDay — จาก Lagrangian multiplier */
export type ArcCostAdjustment = {
  readonly staffId: string;
  readonly slotId: string;
  readonly shiftCodeId?: string;
  readonly additionalCost: number;
};

/** อินพุต Stage B */
export type BalancePlanInput = ScheduleEngineInput & {
  readonly slots: readonly ScheduleSlot[];
  readonly otSlotLimitPerShiftCode?: number;
  /** เปิดโหมดเติมเวรให้ทุกคนที่ไม่ได้หยุด/ลา (default true) */
  readonly fillEveryAvailableCell?: boolean;
};

/** ผล Stage B */
export type BalancePlanResult = {
  readonly feasible: boolean;
  readonly assignments: readonly ScheduleAssignment[];
  readonly unfilledMandatorySlotIds: readonly string[];
  readonly filledCellCount: number;
  readonly skippedFillSlotCount: number;
  readonly totalCost: number;
  readonly solverVersion: string;
  readonly messageTh?: string;
};

/** สถานะ staff ที่ใช้ตัด arc ชั้น 1 */
export type StaffSlotBlockReason =
  | "PINNED"
  | "LOCKED_DAY_OFF"
  | "APPROVED_LEAVE"
  | "GRADE"
  | "SHIFT_AUTH"
  | "OVERLAP"
  | "PLANNED_OFF";

/** ข้อมูล shift code สำหรับ balance slot */
export type BalanceShiftCodeRef = Pick<
  ShiftCodeSnapshot,
  | "id"
  | "code"
  | "departmentId"
  | "standardHours"
  | "otHours"
  | "allowedGradeIds"
  | "needsConfirmation"
  | "active"
  | "startTime"
  | "endTime"
>;

/** rule OT_LIMIT params */
export type OtLimitParams = {
  readonly maxOtHoursPerStaffPerCycle?: number;
  readonly maxOtHoursPerOrgPerCycle?: number;
};

/** อ่าน OT_LIMIT จาก rule instances */
export function resolveOtLimitParams(
  ruleInstances: readonly RuleInstanceSnapshot[],
): OtLimitParams {
  const rule = ruleInstances.find(
    (instance) => instance.enabled && instance.ruleTemplateId === "OT_LIMIT",
  );
  if (!rule) {
    return {};
  }

  return rule.params as OtLimitParams;
}

/** penalty ต้นทุน integer เมื่อข้าม fill slot ผ่าน relief arc */
export const FILL_SKIP_PENALTY = 50_000;

/** penalty ต้นทุน integer บน arc ที่เลือกรหัสมี OT */
export const OT_SLOT_BASE_PENALTY = 5_000;

/** คีย์ work area ของรหัสเวร — ใช้ departmentId หรือ fallback เป็น id */
export function areaKeyForShiftCode(
  code: Pick<BalanceShiftCodeRef, "id" | "departmentId">,
): string {
  return code.departmentId ?? code.id;
}
