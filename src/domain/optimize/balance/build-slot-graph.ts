import { hasApprovedLeaveOnDate, isStaffOffOnDate } from "@/domain/rules/helpers/schedule-metrics";
import { staffHasShiftAuthForInterval } from "@/domain/schedule/shift-auth";
import { buildAssignmentInterval, eachDateInRange, intervalsOverlap } from "@/domain/schedule/time";
import type { ScheduleSlot, ShiftCodeSnapshot, StaffSnapshot } from "@/domain/schedule/types";
import { buildValidationContext } from "@/domain/schedule/validate";

import type {
  BalancePlanInput,
  BalanceShiftCodeRef,
  BalanceSlot,
  FillPool,
  StaffSlotBlockReason,
} from "./types";
import { OT_SLOT_BASE_PENALTY } from "./types";

/** context สำหรับตรวจ eligibility — สร้างครั้งเดียวต่อ solve */
export type SlotValidationContext = {
  readonly input: BalancePlanInput;
  readonly validationContext: ReturnType<typeof buildValidationContext>;
};

/** สร้าง mandatory slots จาก demand ที่ส่งเข้ามา */
export function buildBalanceSlots(input: BalancePlanInput): readonly BalanceSlot[] {
  const shiftCodeById = new Map(input.shiftCodes.map((code) => [code.id, code]));
  return input.slots
    .map((slot) => toBalanceSlot(slot, shiftCodeById))
    .filter((slot): slot is BalanceSlot => slot !== undefined)
    .sort((left, right) => {
      const dateCompare = left.scheduleDate.localeCompare(right.scheduleDate);
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return left.id.localeCompare(right.id);
    });
}

/** id pool fill ต่อวัน */
export function fillPoolId(scheduleDate: string): string {
  return `fill::${scheduleDate}`;
}

/** สร้าง context ตรวจ slot ครั้งเดียว */
export function createSlotValidationContext(input: BalancePlanInput): SlotValidationContext {
  return {
    input,
    validationContext: buildValidationContext(input),
  };
}

/** แปลง ScheduleSlot เป็น BalanceSlot บังคับ */
function toBalanceSlot(
  slot: ScheduleSlot,
  shiftCodeById: ReadonlyMap<string, ShiftCodeSnapshot>,
): BalanceSlot | undefined {
  const shiftCode = shiftCodeById.get(slot.shiftCodeId);
  if (!shiftCode || shiftCode.needsConfirmation || !shiftCode.active) {
    return undefined;
  }

  return {
    id: slot.id,
    scheduleDate: slot.scheduleDate,
    shiftCodeId: slot.shiftCodeId,
    kind: "MANDATORY",
    origin: "DEMAND",
    standardHours: shiftCode.standardHours,
    otHours: shiftCode.otHours ?? 0,
  };
}

/** สร้าง fill pool ต่อวันสำหรับคนที่ยังไม่มีเวร */
export function buildFillPools(
  input: BalancePlanInput,
  mandatorySlots: readonly BalanceSlot[] = buildBalanceSlots(input),
): readonly FillPool[] {
  if (input.fillEveryAvailableCell === false) {
    return [];
  }

  const validationCtx = createSlotValidationContext(input);
  const mandatoryByDate = new Map<string, number>();
  for (const slot of mandatorySlots) {
    mandatoryByDate.set(slot.scheduleDate, (mandatoryByDate.get(slot.scheduleDate) ?? 0) + 1);
  }

  const dates = eachDateInRange(input.cycleStartDate, input.cycleEndDate);
  const fillPools: FillPool[] = [];

  for (const date of dates) {
    const mandatoryCount = mandatoryByDate.get(date) ?? 0;
    const fillCount = countFillSlotsForDate(validationCtx, date, mandatoryCount);
    if (fillCount <= 0) {
      continue;
    }

    fillPools.push({
      id: fillPoolId(date),
      scheduleDate: date,
      count: fillCount,
    });
  }

  return fillPools;
}

/** @deprecated ใช้ buildFillPools แทน */
export function buildFillSlots(
  input: BalancePlanInput,
  mandatorySlots: readonly BalanceSlot[] = buildBalanceSlots(input),
): readonly BalanceSlot[] {
  return buildFillPools(input, mandatorySlots).flatMap((pool) =>
    Array.from({ length: pool.count }, (_, index) => ({
      id: `${pool.id}::${index}`,
      scheduleDate: pool.scheduleDate,
      kind: "FILL" as const,
      origin: "FILL" as const,
    })),
  );
}

/** นับ fill slot ที่ต้องสร้างต่อวัน */
function countFillSlotsForDate(
  ctx: SlotValidationContext,
  date: string,
  mandatoryCount: number,
): number {
  let availableStaff = 0;

  for (const member of ctx.input.staff) {
    if (isStaffUnavailableOnDate(ctx, member.id, date)) {
      continue;
    }
    if (hasWorkingAssignmentOnDate(ctx.input, member.id, date)) {
      continue;
    }
    availableStaff += 1;
  }

  return Math.max(0, availableStaff - mandatoryCount);
}

/** ตรวจว่า staff ไม่พร้อมในวันนั้น (หยุด/ลา) */
function isStaffUnavailableOnDate(
  ctx: SlotValidationContext,
  staffId: string,
  date: string,
): boolean {
  if (isStaffOffOnDate(ctx.validationContext, staffId, date)) {
    return true;
  }
  return hasApprovedLeaveOnDate(ctx.validationContext, staffId, date);
}

/** ตรวจว่า staff มีเวรในวันนั้นแล้ว */
function hasWorkingAssignmentOnDate(
  input: BalancePlanInput,
  staffId: string,
  date: string,
): boolean {
  return [...input.assignments, ...(input.boundaryAssignments ?? [])].some(
    (assignment) => assignment.staffId === staffId && assignment.scheduleDate === date,
  );
}

/** รายการ (รหัสเวร, penalty) ที่ staff รับได้สำหรับ fill slot ในวันนั้น */
export function listFillArcOptions(
  input: BalancePlanInput,
  date: string,
  staff: StaffSnapshot,
  validationCtx: SlotValidationContext = createSlotValidationContext(input),
): readonly { readonly shiftCodeId: string; readonly additionalCost: number }[] {
  const options: { shiftCodeId: string; additionalCost: number }[] = [];
  const sortedCodes = [...input.shiftCodes]
    .filter((code) => code.active && !code.needsConfirmation && code.standardHours > 0)
    .sort((left, right) => left.id.localeCompare(right.id));

  for (const shiftCode of sortedCodes) {
    const blockReason = getShiftArcBlockReason(validationCtx, staff, date, shiftCode);
    if (blockReason) {
      continue;
    }

    options.push({
      shiftCodeId: shiftCode.id,
      additionalCost: otArcPenaltyCost(shiftCode),
    });
  }

  return options;
}

/** ตรวจว่า staff สามารถรับ slot บังคับได้หรือไม่ */
export function getStaffSlotBlockReason(
  input: BalancePlanInput,
  staff: StaffSnapshot,
  slot: BalanceSlot,
  shiftCode: BalanceShiftCodeRef,
  validationCtx: SlotValidationContext = createSlotValidationContext(input),
): StaffSlotBlockReason | undefined {
  if (slot.kind !== "MANDATORY" || !slot.shiftCodeId) {
    return "GRADE";
  }

  return getShiftArcBlockReason(validationCtx, staff, slot.scheduleDate, shiftCode);
}

/** ตรวจ block reason สำหรับ arc ที่มอบรหัสเวรให้ staff ในวัน */
function getShiftArcBlockReason(
  ctx: SlotValidationContext,
  staff: StaffSnapshot,
  scheduleDate: string,
  shiftCode: BalanceShiftCodeRef,
): StaffSlotBlockReason | undefined {
  if (!shiftCode.allowedGradeIds.includes(staff.gradeId)) {
    return "GRADE";
  }

  const interval = buildAssignmentInterval(shiftCode, scheduleDate, ctx.input.timezone);
  if (
    !staffHasShiftAuthForInterval(
      staff.shiftAuthorizations,
      shiftCode.id,
      Date.parse(interval.startAt),
      Date.parse(interval.endAt),
    )
  ) {
    return "SHIFT_AUTH";
  }

  if (isStaffOffOnDate(ctx.validationContext, staff.id, scheduleDate)) {
    return "PLANNED_OFF";
  }

  if (hasApprovedLeaveOnDate(ctx.validationContext, staff.id, scheduleDate)) {
    return "APPROVED_LEAVE";
  }

  const pinnedOverlap = ctx.input.assignments.some(
    (assignment) =>
      assignment.isPinned === true &&
      assignment.staffId === staff.id &&
      intervalsOverlap(assignment.startAt, assignment.endAt, interval.startAt, interval.endAt),
  );
  if (pinnedOverlap) {
    return "PINNED";
  }

  const overlap = [...ctx.input.assignments, ...(ctx.input.boundaryAssignments ?? [])].some(
    (assignment) =>
      assignment.staffId === staff.id &&
      intervalsOverlap(assignment.startAt, assignment.endAt, interval.startAt, interval.endAt),
  );
  if (overlap) {
    return "OVERLAP";
  }

  return undefined;
}

/** สรุปสาเหตุที่ slot บังคับไม่มีคน eligible — ใช้ใน error message Stage B */
export type MandatorySlotBlockSummary = {
  readonly total: number;
  readonly byReason: Readonly<Partial<Record<StaffSlotBlockReason, number>>>;
};

/** จำแนกสาเหตุหลักเมื่อ slot บังคับไม่มี staff ผ่าน eligibility */
export function classifyMandatorySlotBlockReason(
  input: BalancePlanInput,
  slot: BalanceSlot,
  shiftCode: BalanceShiftCodeRef,
  validationCtx: SlotValidationContext,
): StaffSlotBlockReason | undefined {
  const withGrade = input.staff.filter((member) =>
    shiftCode.allowedGradeIds.includes(member.gradeId),
  );
  if (withGrade.length === 0) {
    return "GRADE";
  }

  const interval = buildAssignmentInterval(
    shiftCode,
    slot.scheduleDate,
    validationCtx.input.timezone,
  );
  const startMs = Date.parse(interval.startAt);
  const endMs = Date.parse(interval.endAt);
  const withAuth = withGrade.filter((member) =>
    staffHasShiftAuthForInterval(member.shiftAuthorizations, shiftCode.id, startMs, endMs),
  );
  if (withAuth.length === 0) {
    return "SHIFT_AUTH";
  }

  const withoutPlannedOff = withAuth.filter(
    (member) => !isStaffOffOnDate(validationCtx.validationContext, member.id, slot.scheduleDate),
  );
  if (withoutPlannedOff.length === 0) {
    return "PLANNED_OFF";
  }

  const withoutLeave = withoutPlannedOff.filter(
    (member) =>
      !hasApprovedLeaveOnDate(validationCtx.validationContext, member.id, slot.scheduleDate),
  );
  if (withoutLeave.length === 0) {
    return "APPROVED_LEAVE";
  }

  const withoutPinned = withoutLeave.filter((member) => {
    const pinnedOverlap = input.assignments.some(
      (assignment) =>
        assignment.isPinned === true &&
        assignment.staffId === member.id &&
        intervalsOverlap(assignment.startAt, assignment.endAt, interval.startAt, interval.endAt),
    );
    return !pinnedOverlap;
  });
  if (withoutPinned.length === 0) {
    return "PINNED";
  }

  const withoutOverlap = withoutPinned.filter((member) => {
    const overlap = [...input.assignments, ...(input.boundaryAssignments ?? [])].some(
      (assignment) =>
        assignment.staffId === member.id &&
        intervalsOverlap(assignment.startAt, assignment.endAt, interval.startAt, interval.endAt),
    );
    return !overlap;
  });
  if (withoutOverlap.length === 0) {
    return "OVERLAP";
  }

  return undefined;
}

/** สรุป block reason ของ mandatory slot ที่ไม่มีคน eligible */
export function summarizeMandatorySlotBlockReasons(
  input: BalancePlanInput,
  slots: readonly BalanceSlot[],
  validationCtx: SlotValidationContext = createSlotValidationContext(input),
): MandatorySlotBlockSummary {
  const shiftCodeById = new Map(input.shiftCodes.map((code) => [code.id, code]));
  const byReason: Partial<Record<StaffSlotBlockReason, number>> = {};

  for (const slot of slots) {
    if (slot.kind !== "MANDATORY" || !slot.shiftCodeId) {
      continue;
    }

    const shiftCode = shiftCodeById.get(slot.shiftCodeId);
    if (!shiftCode) {
      continue;
    }

    if (listEligibleStaffForSlot(input, slot, shiftCodeById, validationCtx).length > 0) {
      continue;
    }

    const reason = classifyMandatorySlotBlockReason(input, slot, shiftCode, validationCtx);
    if (!reason) {
      continue;
    }

    byReason[reason] = (byReason[reason] ?? 0) + 1;
  }

  const total = Object.values(byReason).reduce((sum, count) => sum + (count ?? 0), 0);
  return { total, byReason };
}

/** รายการ staff ที่ eligible สำหรับ slot บังคับ */
export function listEligibleStaffForSlot(
  input: BalancePlanInput,
  slot: BalanceSlot,
  shiftCodeById: ReadonlyMap<string, BalanceShiftCodeRef>,
  validationCtx: SlotValidationContext = createSlotValidationContext(input),
): readonly StaffSnapshot[] {
  const shiftCode = slot.shiftCodeId ? shiftCodeById.get(slot.shiftCodeId) : undefined;
  if (!shiftCode) {
    return [];
  }

  return input.staff.filter(
    (member) =>
      getStaffSlotBlockReason(input, member, slot, shiftCode, validationCtx) === undefined,
  );
}

/** ต้นทุนเพิ่มบน arc fill ที่เลือกรหัสมี OT */
export function otArcPenaltyCost(shiftCode: Pick<BalanceShiftCodeRef, "otHours">): number {
  const otHours = shiftCode.otHours ?? 0;
  if (otHours <= 0) {
    return 0;
  }
  return OT_SLOT_BASE_PENALTY + Math.round(otHours * 100);
}

/** @deprecated ใช้ otArcPenaltyCost แทน */
export function otSlotPenaltyCost(slot: BalanceSlot): number {
  return otArcPenaltyCost({ otHours: slot.otHours ?? 0 });
}
