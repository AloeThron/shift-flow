import type { ScheduleAchievementStatus } from "@/components/schedule/canvas/schedule-achievement";
import type { ScheduleCanvasGrid } from "@/domain/schedule/canvas-grid";
import type { ValidationResult } from "@/domain/schedule/types";

/** ขั้นตอนจัดตารางบน canvas */
export type ScheduleStepId =
  | "TIDY"
  | "MANUAL_OFF"
  | "AUTO_OFF"
  | "AUTO_BALANCE"
  | "FREE_EDIT"
  | "PUBLISH";

/** โหมดโต้ตอบของตาราง */
export type CanvasInteractionMode = "PICKER" | "PAINT_OFF";

/** metadata คงที่ต่อขั้นตอน */
export type ScheduleStepDefinition = {
  readonly id: ScheduleStepId;
  readonly order: number;
  readonly labelTh: string;
  readonly hintTh: string;
  readonly mode: CanvasInteractionMode;
};

/** สถานะ done ต่อขั้นตอน */
export type ScheduleStepState = {
  readonly id: ScheduleStepId;
  readonly isDone: boolean;
};

/** ลำดับขั้นตอนจัดตาราง — pure metadata */
export const SCHEDULE_STEPS: readonly ScheduleStepDefinition[] = [
  {
    id: "TIDY",
    order: 1,
    labelTh: "จัดตารางให้สะอาด",
    hintTh: "ซ่อนหมวดว่างเพื่อให้เห็นเฉพาะพนักงานที่มีในรอบนี้",
    mode: "PICKER",
  },
  {
    id: "MANUAL_OFF",
    order: 2,
    labelTh: "ลงวันหยุด manual",
    hintTh:
      "เลือกชนิดวันหยุดแล้วคลิกหรือลากบนเซลล์เพื่อลง/ลบวันหยุด — หมายเหตุ: เกลี่ยวันหยุดเองได้โดยเพิ่มเกินโควตาหรือเพดานต่อวันก่อน แล้วค่อยลบวันที่ไม่ต้องการออก",
    mode: "PAINT_OFF",
  },
  {
    id: "AUTO_OFF",
    order: 3,
    labelTh: "เกลี่ยวันหยุดที่เหลือ",
    hintTh:
      "กรอกโควตาวัน OFF ในคอลัมน์ OFF ให้ครบทุกคน แล้วเรียก solver Stage A — หรือลง manual ด้านล่างเมื่อโควตา/เพดานต่อวันยังไม่ผ่าน",
    mode: "PICKER",
  },
  {
    id: "AUTO_BALANCE",
    order: 4,
    labelTh: "เกลี่ยงาน auto",
    hintTh: "เรียก solver Stage B จัดเวรให้ครบ coverage และความเป็นธรรม",
    mode: "PICKER",
  },
  {
    id: "FREE_EDIT",
    order: 5,
    labelTh: "ปรับแก้อิสระ",
    hintTh: "แก้เซลล์ได้อิสระ — ตรวจ hard rule ในแผงสถานะด้านล่าง",
    mode: "PICKER",
  },
  {
    id: "PUBLISH",
    order: 6,
    labelTh: "เผยแพร่",
    hintTh: "เผยแพร่ตารางและสร้างลิงก์แชร์เมื่อพร้อม",
    mode: "PICKER",
  },
] as const;

/** นับหมวดย่อยว่างใน grid */
function countEmptySections(grid: ScheduleCanvasGrid): number {
  return grid.rows.filter((row) => row.kind === "section" && row.isEmpty).length;
}

/** มีเซลล์ planned off อย่างน้อยหนึ่งเซลล์ */
function hasPlannedOffCell(grid: ScheduleCanvasGrid): boolean {
  return grid.rows.some(
    (row) => row.kind === "staff" && row.row.cells.some((cell) => cell.isPlannedOff),
  );
}

/** มี violation รหัสที่กำหนดใน hard หรือ soft */
function hasViolationCode(validation: ValidationResult, code: string): boolean {
  return [...validation.hardViolations, ...validation.softViolations].some(
    (violation) => violation.code === code,
  );
}

/** มี violation โควตาวันหยุดใน hard หรือ soft */
export function hasDayOffQuotaViolations(validation: ValidationResult): boolean {
  return hasViolationCode(validation, "DAY_OFF_QUOTA");
}

/** มี violation เพดานคนหยุดต่อวันใน hard หรือ soft */
export function hasMaxStaffOffPerDayViolations(validation: ValidationResult): boolean {
  return hasViolationCode(validation, "MAX_STAFF_OFF_PER_DAY");
}

/** มี violation โควตาหรือเพดานต่อวันที่แก้ manual ได้ */
export function hasManualDayOffViolations(validation: ValidationResult): boolean {
  return hasDayOffQuotaViolations(validation) || hasMaxStaffOffPerDayViolations(validation);
}

/** เปิดโหมด PAINT_OFF เมื่อลง/แก้วันหยุด manual ได้ */
export function resolveCanvasInteractionMode(
  canWrite: boolean,
  activeStep: ScheduleStepId,
  validation: ValidationResult,
): CanvasInteractionMode {
  if (!canWrite) {
    return "PICKER";
  }
  if (activeStep === "MANUAL_OFF") {
    return "PAINT_OFF";
  }
  if (activeStep === "AUTO_OFF" && hasManualDayOffViolations(validation)) {
    return "PAINT_OFF";
  }
  return "PICKER";
}

/** อินพุตคำนวณสถานะขั้นตอน */
export type DeriveScheduleStepStatesInput = {
  readonly grid: ScheduleCanvasGrid;
  readonly validation: ValidationResult;
  readonly achievement: ScheduleAchievementStatus;
  readonly showEmptySections: boolean;
  readonly publishedVersionNumber: number | null;
};

/** คำนวณ isDone ต่อขั้นตอนจาก draft ปัจจุบัน */
export function deriveScheduleStepStates(
  input: DeriveScheduleStepStatesInput,
): readonly ScheduleStepState[] {
  const emptySectionCount = countEmptySections(input.grid);

  const doneById: Record<ScheduleStepId, boolean> = {
    TIDY: !input.showEmptySections || emptySectionCount === 0,
    MANUAL_OFF: hasPlannedOffCell(input.grid),
    AUTO_OFF: !hasDayOffQuotaViolations(input.validation),
    AUTO_BALANCE: input.achievement.passesCoverage && input.achievement.passesFairness,
    FREE_EDIT: input.achievement.passesHard,
    PUBLISH: input.publishedVersionNumber !== null,
  };

  return SCHEDULE_STEPS.map((step) => ({
    id: step.id,
    isDone: doneById[step.id],
  }));
}

/** เลือกขั้นตอนเริ่มต้น — ขั้นแรกที่ยังไม่ done */
export function resolveInitialStep(states: readonly ScheduleStepState[]): ScheduleStepId {
  const pending = states.find((state) => !state.isDone);
  return pending?.id ?? "PUBLISH";
}
