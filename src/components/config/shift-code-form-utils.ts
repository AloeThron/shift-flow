import type { ShiftCodeFormInput } from "@/domain/config/schemas";
import { shiftCrossesMidnight } from "@/domain/schedule/time";

/** draft สำหรับ inline edit และฟอร์ม shift code */
export type ShiftCodeDraft = {
  canonicalCode: string;
  departmentId: string;
  startTime: string;
  endTime: string;
  standardHours: string;
  allowedGradeCodes: string[];
  needsConfirmation: boolean;
  deprecated: boolean;
};

type ShiftCodeDraftSource = {
  canonicalCode: string;
  departmentId: string | null;
  startTime: string | null;
  endTime: string | null;
  standardHours: number | null;
  allowedGradeCodes: string[];
  needsConfirmation: boolean;
  deprecated: boolean;
};

/** แปลงแถว shift code เป็น draft */
export function shiftCodeRowToDraft(row: ShiftCodeDraftSource): ShiftCodeDraft {
  return {
    canonicalCode: row.canonicalCode,
    departmentId: row.departmentId ?? "",
    startTime: row.startTime ?? "",
    endTime: row.endTime ?? "",
    standardHours: row.standardHours != null ? String(row.standardHours) : "",
    allowedGradeCodes: [...row.allowedGradeCodes],
    needsConfirmation: row.needsConfirmation,
    deprecated: row.deprecated,
  };
}

/** draft ว่างสำหรับสร้างรหัสเวรใหม่ */
export function emptyShiftCodeDraft(gradeCodes: readonly string[] = []): ShiftCodeDraft {
  return {
    canonicalCode: "",
    departmentId: "",
    startTime: "",
    endTime: "",
    standardHours: "",
    allowedGradeCodes: [...gradeCodes],
    needsConfirmation: false,
    deprecated: false,
  };
}

/** แปลง draft เป็น input สำหรับ server action */
export function buildShiftCodeFormInput(draft: ShiftCodeDraft): ShiftCodeFormInput {
  return {
    canonicalCode: draft.canonicalCode,
    departmentId: draft.departmentId || undefined,
    startTime: draft.startTime,
    endTime: draft.endTime,
    standardHours: draft.standardHours ? Number(draft.standardHours) : undefined,
    allowedGradeCodes: draft.allowedGradeCodes,
    needsConfirmation: draft.needsConfirmation,
    deprecated: draft.deprecated,
  };
}

/** แปลง FormData จากฟอร์มเดิมเป็น input สำหรับ server action */
export function buildShiftCodeFormInputFromFormData(formData: FormData): ShiftCodeFormInput {
  const standardHoursRaw = String(formData.get("standardHours") ?? "");
  return {
    canonicalCode: String(formData.get("canonicalCode") ?? ""),
    departmentId: String(formData.get("departmentId") ?? "") || undefined,
    startTime: String(formData.get("startTime") ?? ""),
    endTime: String(formData.get("endTime") ?? ""),
    standardHours: standardHoursRaw ? Number(standardHoursRaw) : undefined,
    allowedGradeCodes: parseGradeCodesFromFormData(formData),
    needsConfirmation: formData.get("needsConfirmation") === "on",
    deprecated: formData.get("deprecated") === "on",
  };
}

/** สลับการเลือก grade code ใน draft */
export function toggleGradeSelection(
  selected: readonly string[],
  code: string,
): string[] {
  return selected.includes(code)
    ? selected.filter((item) => item !== code)
    : [...selected, code];
}

/** หา grade codes ที่ไม่อยู่ใน master active */
export function findOrphanGradeCodes(
  selected: readonly string[],
  activeGradeCodes: readonly string[],
): string[] {
  const activeSet = new Set(activeGradeCodes);
  return selected.filter((code) => !activeSet.has(code));
}

/** อ่าน grade codes จาก checkbox ในฟอร์ม legacy */
function parseGradeCodesFromFormData(formData: FormData): string[] {
  return [...formData.entries()]
    .filter(([key, value]) => key.startsWith("grade-") && value === "on")
    .map(([key]) => key.slice("grade-".length))
    .filter((code) => code.length > 0);
}

/** ข้อความแสดงช่วงเวลาเวร */
export function formatShiftTimeRange(
  startTime: string | null,
  endTime: string | null,
): string {
  if (!startTime || !endTime) {
    return "—";
  }
  const crossesMidnight = shiftCrossesMidnight(startTime, endTime);
  return `${startTime}–${endTime}${crossesMidnight ? " (วันถัดไป)" : ""}`;
}
