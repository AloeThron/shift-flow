import type { ScheduleVersionStatus } from "@/generated/client/client";

/** transition ที่อนุญาตของ schedule version — ตรง state diagram ในแผน */
const ALLOWED_TRANSITIONS: Readonly<
  Record<ScheduleVersionStatus, readonly ScheduleVersionStatus[]>
> = {
  DRAFT: ["VALIDATED"],
  VALIDATED: ["PUBLISHED"],
  PUBLISHED: ["LOCKED", "SUPERSEDED"],
  LOCKED: ["SUPERSEDED"],
  SUPERSEDED: [],
};

/** ตรวจว่า transition ถูกต้องตาม lifecycle */
export function canTransitionScheduleVersion(
  from: ScheduleVersionStatus,
  to: ScheduleVersionStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** สถานะที่ published version แก้ in-place ไม่ได้ */
export function isImmutableScheduleVersion(status: ScheduleVersionStatus): boolean {
  return status === "PUBLISHED" || status === "LOCKED" || status === "SUPERSEDED";
}

/** สถานะที่ยังแก้ draft ได้ */
export function isEditableScheduleVersion(status: ScheduleVersionStatus): boolean {
  return status === "DRAFT" || status === "VALIDATED";
}
