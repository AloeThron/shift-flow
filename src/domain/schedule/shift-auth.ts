import { parseDateInput } from "@/domain/config/schemas";

/** ช่วงสิทธิปฏิบัติงานที่ engine ใช้ตรวจรหัสเวร */
export type ShiftAuthInterval = {
  readonly shiftCodeId: string | null;
  readonly coversAllShiftCodes?: boolean;
  readonly validFrom: string;
  readonly validTo: string | null;
};

/** แปลงวันอนุมัติ → ms ต้นวัน (local) */
function authValidFromMs(validFrom: string): number {
  return parseDateInput(validFrom).getTime();
}

/** แปลงวันหมดอายุ → ms สิ้นวัน (local) — inclusive ถึงเวรที่จบในวันนั้น */
function authValidToMs(validTo: string): number {
  const end = parseDateInput(validTo);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

/** ตรวจว่า authorization ครอบคลุมรหัสเวรในช่วงเวลาที่กำหนด */
export function authCoversShiftCode(
  auth: ShiftAuthInterval,
  shiftCodeId: string,
  startMs: number,
  endMs: number,
): boolean {
  const coversAll = auth.coversAllShiftCodes === true || auth.shiftCodeId === null;
  if (!coversAll && auth.shiftCodeId !== shiftCodeId) {
    return false;
  }

  const validFrom = authValidFromMs(auth.validFrom);
  const validTo = auth.validTo ? authValidToMs(auth.validTo) : Number.POSITIVE_INFINITY;
  return validFrom <= startMs && validTo >= endMs;
}

/** ตรวจว่า staff มีสิทธิครอบคลุมรหัสเวรตลอดช่วงเวร */
export function staffHasShiftAuthForInterval(
  authorizations: readonly ShiftAuthInterval[],
  shiftCodeId: string,
  startMs: number,
  endMs: number,
  options?: { enforceExpiry?: boolean },
): boolean {
  const enforceExpiry = options?.enforceExpiry ?? true;
  return authorizations.some((auth) => {
    const coversAll = auth.coversAllShiftCodes === true || auth.shiftCodeId === null;
    if (!coversAll && auth.shiftCodeId !== shiftCodeId) {
      return false;
    }
    if (!enforceExpiry) {
      return true;
    }
    return authCoversShiftCode(auth, shiftCodeId, startMs, endMs);
  });
}
