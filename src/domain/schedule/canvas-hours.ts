import type { ScheduleCanvasCell } from "@/domain/schedule/canvas-grid";

/** meta รหัสเวรที่ canvas ใช้คำนวณชั่วโมง */
export type CanvasShiftHoursMeta = {
  readonly standardHours: number;
  readonly otHours: number;
};

/** ชั่วโมงต่อเซลล์ canvas */
export type CanvasCellHours = {
  readonly workHours: number;
  readonly otHours: number;
};

/** สรุปชั่วโมงทั้งแถวพนักงาน */
export type CanvasStaffRowTotals = {
  readonly workHours: number;
  readonly otHours: number;
};

/** คำนวณชั่วโมงทำงานและ OT ของเซลล์เดียว */
export function computeCanvasCellHours(
  cell: ScheduleCanvasCell,
  shiftMeta: CanvasShiftHoursMeta | null,
): CanvasCellHours {
  if (cell.isPlannedOff || !cell.shiftCodeId || !shiftMeta) {
    return { workHours: 0, otHours: 0 };
  }

  const workHours = shiftMeta.standardHours > 0 ? shiftMeta.standardHours : 0;
  if (workHours <= 0) {
    return { workHours: 0, otHours: 0 };
  }

  return {
    workHours,
    otHours: cell.plannedOtHours + shiftMeta.otHours,
  };
}

/** รวมชั่วโมงทั้งแถวพนักงานในรอบที่แสดง */
export function computeCanvasStaffRowTotals(
  cells: readonly ScheduleCanvasCell[],
  shiftMetaById: ReadonlyMap<string, CanvasShiftHoursMeta>,
): CanvasStaffRowTotals {
  return cells.reduce(
    (totals, cell) => {
      const shiftMeta = cell.shiftCodeId ? (shiftMetaById.get(cell.shiftCodeId) ?? null) : null;
      const cellHours = computeCanvasCellHours(cell, shiftMeta);
      return {
        workHours: totals.workHours + cellHours.workHours,
        otHours: totals.otHours + cellHours.otHours,
      };
    },
    { workHours: 0, otHours: 0 },
  );
}

/** เซลล์มี OT ในวันนั้นหรือไม่ */
export function hasCellOt(hours: Pick<CanvasCellHours, "otHours">): boolean {
  return hours.otHours > 0;
}
