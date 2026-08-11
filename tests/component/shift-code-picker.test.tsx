import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShiftCodePicker } from "@/components/schedule/canvas/shift-code-picker";
import type { ShiftCodeSuggestion } from "@/domain/schedule/suggest";

/** สร้าง suggestion จำลองสำหรับเทสต์ */
function mockSuggestion(overrides?: Partial<ShiftCodeSuggestion>): ShiftCodeSuggestion {
  return {
    action: { kind: "SHIFT_CODE", shiftCodeId: "sc-d", code: "D" },
    labelTh: "เวร D",
    standardHours: 8,
    otHours: 0,
    isNightShift: false,
    blockingReasonsTh: [],
    warningsTh: [],
    rank: {
      blocked: false,
      coverageGapFilled: 0,
      fairnessGain: 0,
      softScoreDelta: 0,
      recentUsage: 0,
    },
    ...overrides,
  };
}

const noop = vi.fn();

/** props พื้นฐานของ ShiftCodePicker */
function renderPicker(overrides: Partial<ComponentProps<typeof ShiftCodePicker>> = {}) {
  return render(
    <ShiftCodePicker
      open
      onOpenChange={noop}
      anchor={<button type="button">เซลล์</button>}
      staffName="พนักงานทดสอบ"
      localDate="2026-09-01"
      suggestions={[]}
      suggestionsLoading={false}
      isPinned={false}
      isPlannedOff={false}
      plannedOffLocked={false}
      canPin={false}
      onSelect={noop}
      onClearDayOff={noop}
      onLockPin={noop}
      onLockPlannedOff={noop}
      onUnlockPin={noop}
      onUnlockPlannedOff={noop}
      {...overrides}
    />,
  );
}

describe("ShiftCodePicker", () => {
  afterEach(() => {
    cleanup();
  });

  it("แสดง status loading และช่องค้นหาเมื่อ suggestionsLoading=true", () => {
    renderPicker({ suggestionsLoading: true });
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByRole("status").textContent).toContain("กำลังจัดอันดับรหัสเวร");
    expect(within(dialog).getByLabelText("ค้นหารหัสเวร")).toBeTruthy();
    expect(
      within(dialog).getByRole("listbox", { name: "ตัวเลือกรหัสเวร" }).getAttribute("aria-busy"),
    ).toBe("true");
  });

  it("แสดง listbox เมื่อ suggestionsLoading=false และมี suggestions", () => {
    renderPicker({
      suggestionsLoading: false,
      suggestions: [mockSuggestion()],
    });
    const dialog = screen.getByRole("dialog");

    expect(
      within(dialog).getByRole("listbox", { name: "ตัวเลือกรหัสเวร" }).getAttribute("aria-busy"),
    ).toBe("false");
    expect(within(dialog).getByRole("option", { name: /เวร D/ })).toBeTruthy();
  });

  it("แสดงวันหยุด/ลาทุกชนิดจาก config ใน section วันหยุด/ลา", () => {
    renderPicker({
      suggestions: [
        mockSuggestion({
          action: { kind: "PLANNED_OFF", nonWorkingDayKindId: "kind-off", code: "off" },
          labelTh: "วันหยุด",
        }),
        mockSuggestion({
          action: { kind: "PLANNED_OFF", nonWorkingDayKindId: "kind-vac", code: "VAC" },
          labelTh: "ลาพักร้อน",
        }),
      ],
    });

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("วันหยุด/ลา")).toBeTruthy();
    expect(within(dialog).getByRole("option", { name: /วันหยุด/ })).toBeTruthy();
    expect(within(dialog).getByRole("option", { name: /ลาพักร้อน/ })).toBeTruthy();
  });

  it("แสดงตัวเลือกสลับใน section สลับ", () => {
    renderPicker({
      suggestions: [
        mockSuggestion({
          action: {
            kind: "SWAP_WITH",
            counterpartStaffId: "staff-2",
            counterpartCode: "D8",
          },
          labelTh: "สลับกับ เพื่อน (D8)",
        }),
      ],
    });

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("สลับ")).toBeTruthy();
    expect(within(dialog).getByRole("option", { name: /สลับกับ/ })).toBeTruthy();
  });

  it("แสดงปุ่มล็อกเซลล์ใน footer เมื่อ canPin=true", () => {
    const onLockPin = vi.fn();
    renderPicker({ canPin: true, onLockPin });

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "ล็อกเซลล์" }));
    expect(onLockPin).toHaveBeenCalledTimes(1);
  });

  it("แสดงปุ่มลบและล็อกวันหยุดใน footer เมื่อ isPlannedOff=true", () => {
    const onClearDayOff = vi.fn();
    const onLockPlannedOff = vi.fn();
    renderPicker({ isPlannedOff: true, onClearDayOff, onLockPlannedOff });

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "ลบวันหยุด" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "ล็อกวันหยุด" }));
    expect(onClearDayOff).toHaveBeenCalledTimes(1);
    expect(onLockPlannedOff).toHaveBeenCalledTimes(1);
  });

  it("แสดงตัวเลือกล้างเซลล์เพียงครั้งเดียวท้ายรายการ", () => {
    renderPicker({
      suggestions: [
        mockSuggestion(),
        mockSuggestion({
          action: { kind: "CLEAR" },
          labelTh: "ล้างเซลล์",
        }),
      ],
    });

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("option", { name: /ล้างเซลล์/ })).toHaveLength(1);
  });

  it("override ต้องกรอกเหตุผลก่อนยืนยัน", () => {
    const onSelect = vi.fn();
    renderPicker({
      onSelect,
      suggestions: [
        mockSuggestion({
          action: { kind: "OVERRIDE", shiftCodeId: "sc-x", code: "X" },
          labelTh: "Override: X",
          blockingReasonsTh: ["พักไม่พอ"],
          rank: {
            blocked: false,
            coverageGapFilled: 0,
            fairnessGain: 0,
            softScoreDelta: 0,
            recentUsage: 0,
          },
        }),
      ],
    });

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("option", { name: /Override: X/ }));

    const confirm = within(dialog).getByRole("button", { name: "ยืนยัน override" });
    expect(confirm.hasAttribute("disabled")).toBe(true);

    fireEvent.change(within(dialog).getByLabelText("เหตุผล override"), {
      target: { value: "ฉุกเฉินเตียงเต็ม" },
    });
    expect(confirm.hasAttribute("disabled")).toBe(false);

    fireEvent.click(confirm);
    expect(onSelect).toHaveBeenCalledWith(
      { kind: "OVERRIDE", shiftCodeId: "sc-x", code: "X" },
      { overrideReason: "ฉุกเฉินเตียงเต็ม" },
    );
  });
});
