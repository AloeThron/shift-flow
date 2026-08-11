import type { ContractType, OverrideClass, RuleSeverity, StaffGroupSection } from "@/generated/client/client";

/** ป้ายระดับความเข้มของกติกา */
export const SEVERITY_LABELS: Record<RuleSeverity, string> = {
  HARD: "บังคับ",
  SOFT: "ยืดหยุ่น",
};

/** ป้ายระดับการยกเว้นกติกา */
export const OVERRIDE_CLASS_LABELS: Record<OverrideClass, string> = {
  NEVER: "ห้ามยกเว้น",
  APPROVER_REQUIRED: "ต้องมีผู้อนุมัติ",
  SCHEDULER_ALLOWED: "ผู้จัดเวรยกเว้นได้",
};

/** ป้ายความซับซ้อนของชุดตัวอย่าง */
export const COMPLEXITY_LABELS: Record<"low" | "medium" | "high", string> = {
  low: "ง่าย",
  medium: "ปานกลาง",
  high: "ซับซ้อน",
};

/** ป้ายหมวดย่อยภายใน StaffGroup */
export const STAFF_GROUP_SECTION_LABELS: Record<StaffGroupSection, string> = {
  RESULT_CAPABLE: "ออกผลได้",
  RESULT_NOT_CAPABLE: "ออกผลไม่ได้",
  PART_TIME: "Part time",
};

/** ป้ายประเภทสัญญา */
export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  FULL_TIME: "เต็มเวลา",
  PART_TIME: "Part time (สัญญา)",
  NO_GUARANTEED_HOURS: "ไม่รับประกันชั่วโมง",
};

/** แปลงความซับซ้อนเป็นข้อความไทย — ค่าอื่นแสดงตามเดิม */
export function formatComplexityLabel(complexity: string): string {
  if (complexity === "low" || complexity === "medium" || complexity === "high") {
    return COMPLEXITY_LABELS[complexity];
  }
  return complexity;
}
