import type { OverrideClass, RuleSeverity } from "@/generated/client/client";

/** ผลลัพธ์มาตรฐานจาก server action */
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

/** สถานะ effective ของ config */
export type ConfigEffectiveStatus = "active" | "pending" | "expired";

/** คำนวณสถานะ effective จากวันที่ */
export function getEffectiveStatus(
  effectiveFrom: Date,
  effectiveTo: Date | null,
  now = new Date(),
): ConfigEffectiveStatus {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const from = new Date(
    effectiveFrom.getFullYear(),
    effectiveFrom.getMonth(),
    effectiveFrom.getDate(),
  );
  const to = effectiveTo
    ? new Date(effectiveTo.getFullYear(), effectiveTo.getMonth(), effectiveTo.getDate())
    : null;

  if (from > today) {
    return "pending";
  }
  if (to && to < today) {
    return "expired";
  }
  return "active";
}

/** ข้อมูล pay rule config ใน PayRuleVersion.config */
export type PayRuleConfig = {
  otMultiplier: number;
  nightAllowancePerShift: number;
  holidayAllowancePerShift: number;
  roundingMinutes: number;
  notes?: string;
};

/** DTO สำหรับ rule instance ใน admin UI */
export type RuleInstanceView = {
  id: string;
  ruleTemplateId: string;
  params: Record<string, unknown>;
  severity: RuleSeverity;
  weight: number | null;
  overrideClass: OverrideClass;
  enabled: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
};

/** แปลง weekday mask (bit 0=จ, … 6=อา) เป็น label */
export function weekdayMaskToLabels(mask: number): string[] {
  const labels = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
  return labels.filter((_, index) => (mask & (1 << index)) !== 0);
}

/** แปลง array วันเป็น weekday mask */
export function labelsToWeekdayMask(selected: readonly number[]): number {
  return selected.reduce((acc, day) => acc | (1 << day), 0);
}
