import { describe, expect, it } from "vitest";

import type { ScheduleCanvasCell } from "@/domain/schedule/canvas-grid";
import {
  computeCanvasCellHours,
  computeCanvasStaffRowTotals,
  hasCellOt,
  type CanvasShiftHoursMeta,
} from "@/domain/schedule/canvas-hours";

const dayShiftMeta: CanvasShiftHoursMeta = { standardHours: 8, otHours: 0 };
const otShiftMeta: CanvasShiftHoursMeta = { standardHours: 8, otHours: 2 };

function makeCell(overrides: Partial<ScheduleCanvasCell> = {}): ScheduleCanvasCell {
  return {
    assignmentId: "a1",
    shiftCodeId: "code-day",
    shiftCode: "DAY",
    isPinned: false,
    plannedOtHours: 0,
    isPlannedOff: false,
    plannedOffLocked: false,
    nonWorkingDayKindCode: null,
    ...overrides,
  };
}

describe("computeCanvasCellHours", () => {
  it("planned off คืน 0/0", () => {
    expect(
      computeCanvasCellHours(makeCell({ isPlannedOff: true, shiftCodeId: null }), dayShiftMeta),
    ).toEqual({ workHours: 0, otHours: 0 });
  });

  it("shift 8h ไม่มี OT", () => {
    expect(computeCanvasCellHours(makeCell(), dayShiftMeta)).toEqual({
      workHours: 8,
      otHours: 0,
    });
    expect(hasCellOt(computeCanvasCellHours(makeCell(), dayShiftMeta))).toBe(false);
  });

  it("shift 8h + otHours=2 จากรหัสเวร", () => {
    const hours = computeCanvasCellHours(makeCell(), otShiftMeta);
    expect(hours).toEqual({ workHours: 8, otHours: 2 });
    expect(hasCellOt(hours)).toBe(true);
  });

  it("รวม plannedOtHours กับ otHours ของรหัสเวร", () => {
    expect(
      computeCanvasCellHours(makeCell({ plannedOtHours: 1 }), otShiftMeta),
    ).toEqual({ workHours: 8, otHours: 3 });
  });

  it("ไม่มี shiftCodeId คืน 0/0", () => {
    expect(computeCanvasCellHours(makeCell({ shiftCodeId: null }), dayShiftMeta)).toEqual({
      workHours: 0,
      otHours: 0,
    });
  });
});

describe("computeCanvasStaffRowTotals", () => {
  it("รวมหลายวันในแถว", () => {
    const shiftMetaById = new Map<string, CanvasShiftHoursMeta>([
      ["code-day", dayShiftMeta],
      ["code-ot", otShiftMeta],
    ]);

    const totals = computeCanvasStaffRowTotals(
      [
        makeCell({ shiftCodeId: "code-day" }),
        makeCell({ shiftCodeId: "code-ot", shiftCode: "OT-DAY" }),
        makeCell({ isPlannedOff: true, shiftCodeId: null, shiftCode: "OFF" }),
      ],
      shiftMetaById,
    );

    expect(totals).toEqual({ workHours: 16, otHours: 2 });
  });
});

describe("hasCellOt", () => {
  it("false เมื่อ otHours = 0", () => {
    expect(hasCellOt({ otHours: 0 })).toBe(false);
  });

  it("true เมื่อ otHours > 0", () => {
    expect(hasCellOt({ otHours: 0.1 })).toBe(true);
  });
});
