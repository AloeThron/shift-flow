import { describe, expect, it } from "vitest";

import { buildShiftCodeToneLookup, rosterGridCellClassName } from "@/domain/share";

describe("rosterGridCellClassName", () => {
  const shiftCodes = [
    { code: "off", isNightShift: false },
    { code: "ช", isNightShift: false },
    { code: "NIGHT-A", isNightShift: true },
  ];
  const lookup = buildShiftCodeToneLookup(shiftCodes);

  it("เซลล์ว่างใช้สี muted", () => {
    expect(
      rosterGridCellClassName({
        displayCode: null,
        isNonWorkingDay: false,
        shiftMeta: undefined,
      }),
    ).toContain("text-muted-foreground");
  });

  it("off ใช้พื้นหลัง muted", () => {
    expect(
      rosterGridCellClassName({
        displayCode: "off",
        isNonWorkingDay: false,
        shiftMeta: lookup.get("off"),
      }),
    ).toContain("bg-muted/50");
  });

  it("วันหยุดจาก non-working kind ใช้พื้นหลัง muted", () => {
    expect(
      rosterGridCellClassName({
        displayCode: "OFF",
        isNonWorkingDay: true,
        shiftMeta: undefined,
      }),
    ).toContain("bg-muted/50");
  });

  it("เวรดึกจาก isNightShift ใน config", () => {
    expect(
      rosterGridCellClassName({
        displayCode: "NIGHT-A",
        isNonWorkingDay: false,
        shiftMeta: lookup.get("NIGHT-A"),
      }),
    ).toContain("bg-slate-900/90");
  });

  it("เวรกลางวันไม่ใช้พื้นหลังดึก", () => {
    expect(
      rosterGridCellClassName({
        displayCode: "ช",
        isNonWorkingDay: false,
        shiftMeta: lookup.get("ช"),
      }),
    ).toBe("font-medium text-foreground");
  });
});
