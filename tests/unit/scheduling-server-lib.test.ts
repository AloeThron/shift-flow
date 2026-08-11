import { describe, expect, it } from "vitest";

import type { ScheduleEngineInput } from "@/domain/schedule/types";
import { buildDemandSlots } from "@/lib/scheduling/build-demand-slots";
import { buildDeterministicSeed, buildInputChecksum } from "@/lib/scheduling/input-checksum";

/** baseline engine input สำหรับทดสอบ slot */
function baseEngineInput(overrides: Partial<ScheduleEngineInput> = {}): ScheduleEngineInput {
  return {
    organizationId: "org-a",
    timezone: "Asia/Bangkok",
    cycleStartDate: "2026-03-01",
    cycleEndDate: "2026-03-02",
    assignments: [],
    staff: [],
    shiftCodes: [
      {
        id: "code-day",
        code: "DAY",
        departmentId: "dept-a",
        startTime: "08:00",
        endTime: "16:00",
        standardHours: 8,
        otHours: 0,
        isNightShift: false,
        allowedGradeIds: ["grade-a"],
        needsConfirmation: false,
        active: true,
      },
    ],
    shiftDemands: [
      {
        id: "dem-1",
        shiftCodeId: "code-day",
        dayType: "ALL",
        minCount: 2,
        requiresLead: false,
      },
    ],
    ruleInstances: [],
    plannedNonWorkingDays: [],
    holidayDates: [],
    ...overrides,
  };
}

describe("buildInputChecksum", () => {
  it("ให้ checksum เดิมจาก payload เดิม", () => {
    const payload = { stage: "DAY_OFF", draftId: "draft-a", staffIds: ["a", "b"] };
    expect(buildInputChecksum(payload)).toBe(buildInputChecksum(payload));
  });

  it("seed ขึ้นกับ attempt", () => {
    const checksum = buildInputChecksum({ stage: "BALANCE" });
    expect(buildDeterministicSeed(checksum, 1)).not.toBe(buildDeterministicSeed(checksum, 2));
  });
});

describe("buildDemandSlots", () => {
  it("สร้าง slot ตาม minCount ของ demand", () => {
    const slots = buildDemandSlots(baseEngineInput());
    expect(slots).toHaveLength(4);
    expect(slots.every((slot) => slot.shiftCodeId === "code-day")).toBe(true);
  });

  it("แยก slot ตาม dayType เมื่อมี demand หลายแถวต่อ shift code เดียวกัน", () => {
    const input = baseEngineInput({
      cycleStartDate: "2026-03-01",
      cycleEndDate: "2026-03-07",
      shiftCodes: [
        {
          id: "code-bb20",
          code: "BB20",
          departmentId: "dept-bb",
          startTime: "08:00",
          endTime: "20:00",
          standardHours: 12,
          otHours: 0,
          isNightShift: false,
          allowedGradeIds: ["grade-a"],
          needsConfirmation: false,
          active: true,
        },
      ],
      shiftDemands: [
        {
          id: "dem-bb20-weekday",
          shiftCodeId: "code-bb20",
          dayType: "WEEKDAY",
          minCount: 1,
          requiresLead: false,
        },
        {
          id: "dem-bb20-weekend",
          shiftCodeId: "code-bb20",
          dayType: "WEEKEND",
          minCount: 2,
          requiresLead: true,
        },
      ],
    });

    const slots = buildDemandSlots(input);
    const slotsByDate = new Map<string, number>();
    for (const slot of slots) {
      slotsByDate.set(slot.scheduleDate, (slotsByDate.get(slot.scheduleDate) ?? 0) + 1);
    }

    // 2026-03-01 = อาทิตย์, 2026-03-07 = เสาร์ → weekend minCount 2
    expect(slotsByDate.get("2026-03-01")).toBe(2);
    expect(slotsByDate.get("2026-03-07")).toBe(2);
    // 2026-03-02–06 = จ–ศ → weekday minCount 1
    expect(slotsByDate.get("2026-03-02")).toBe(1);
    expect(slotsByDate.get("2026-03-06")).toBe(1);
    expect(slots).toHaveLength(9);
    expect(slots.every((slot) => slot.shiftCodeId === "code-bb20")).toBe(true);
  });
});
