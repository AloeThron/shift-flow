import { describe, expect, it } from "vitest";

import { computeScheduleAchievementStatus } from "@/components/schedule/canvas/schedule-achievement";
import {
    deriveScheduleStepStates,
    resolveCanvasInteractionMode,
    resolveInitialStep,
    SCHEDULE_STEPS,
} from "@/components/schedule/canvas/schedule-steps";
import type { ScheduleCanvasGrid, ScheduleCanvasRow } from "@/domain/schedule/canvas-grid";
import type { ValidationResult } from "@/domain/schedule/types";

const emptyValidation: ValidationResult = {
  hardViolations: [],
  softViolations: [],
  isValid: true,
  softScore: 0,
};

const passingAchievement = computeScheduleAchievementStatus(emptyValidation, [], null);

function makeGrid(options?: {
  readonly hasPlannedOff?: boolean;
  readonly emptySectionCount?: number;
}): ScheduleCanvasGrid {
  const emptySectionCount = options?.emptySectionCount ?? 0;
  const rows: ScheduleCanvasRow[] = [];

  for (let index = 0; index < emptySectionCount; index += 1) {
    rows.push({
      kind: "section",
      groupId: "g1",
      groupKey: "g1",
      section: "RESULT_CAPABLE",
      displayName: `หมวดว่าง ${index + 1}`,
      isEmpty: true,
    });
  }

  rows.push({
    kind: "staff",
    row: {
      staffProfileId: "staff-1",
      staffCode: "S001",
      staffName: "Staff One",
      staffGroupId: "g1",
      staffGroupSection: "RESULT_CAPABLE",
      rowOrder: 0,
      cells: [
        {
          assignmentId: null,
          shiftCodeId: null,
          shiftCode: null,
          isPinned: false,
          plannedOtHours: 0,
          isPlannedOff: options?.hasPlannedOff ?? false,
          plannedOffLocked: false,
          nonWorkingDayKindCode: options?.hasPlannedOff ? "OFF" : null,
        },
      ],
    },
  });

  return {
    dates: ["2026-03-01"],
    holidayDates: [],
    rows,
  };
}

function baseInput(overrides?: Partial<Parameters<typeof deriveScheduleStepStates>[0]>) {
  return {
    grid: makeGrid(),
    validation: emptyValidation,
    achievement: passingAchievement,
    showEmptySections: true,
    publishedVersionNumber: null,
    ...overrides,
  };
}

describe("deriveScheduleStepStates", () => {
  it("TIDY done เมื่อซ่อนหมวดว่างหรือไม่มีหมวดว่าง", () => {
    const hidden = deriveScheduleStepStates(
      baseInput({ grid: makeGrid({ emptySectionCount: 2 }), showEmptySections: false }),
    );
    const noEmpty = deriveScheduleStepStates(
      baseInput({ grid: makeGrid({ emptySectionCount: 0 }), showEmptySections: true }),
    );
    const stillVisible = deriveScheduleStepStates(
      baseInput({ grid: makeGrid({ emptySectionCount: 2 }), showEmptySections: true }),
    );

    expect(hidden.find((state) => state.id === "TIDY")?.isDone).toBe(true);
    expect(noEmpty.find((state) => state.id === "TIDY")?.isDone).toBe(true);
    expect(stillVisible.find((state) => state.id === "TIDY")?.isDone).toBe(false);
  });

  it("MANUAL_OFF done เมื่อมี planned off อย่างน้อยหนึ่งเซลล์", () => {
    const withoutOff = deriveScheduleStepStates(baseInput({ grid: makeGrid({ hasPlannedOff: false }) }));
    const withOff = deriveScheduleStepStates(baseInput({ grid: makeGrid({ hasPlannedOff: true }) }));

    expect(withoutOff.find((state) => state.id === "MANUAL_OFF")?.isDone).toBe(false);
    expect(withOff.find((state) => state.id === "MANUAL_OFF")?.isDone).toBe(true);
  });

  it("AUTO_OFF done เมื่อไม่มี DAY_OFF_QUOTA ทั้ง hard และ soft", () => {
    const withQuota: ValidationResult = {
      ...emptyValidation,
      hardViolations: [
        {
          code: "DAY_OFF_QUOTA",
          source: "RULE",
          messageTh: "โควตาไม่ครบ",
          severity: "HARD",
        },
      ],
    };
    const withSoftQuota: ValidationResult = {
      ...emptyValidation,
      softViolations: [
        {
          code: "DAY_OFF_QUOTA",
          source: "RULE",
          messageTh: "โควตา soft",
          severity: "SOFT",
        },
      ],
    };

    expect(
      deriveScheduleStepStates(baseInput({ validation: withQuota })).find(
        (state) => state.id === "AUTO_OFF",
      )?.isDone,
    ).toBe(false);
    expect(
      deriveScheduleStepStates(baseInput({ validation: withSoftQuota })).find(
        (state) => state.id === "AUTO_OFF",
      )?.isDone,
    ).toBe(false);
    expect(
      deriveScheduleStepStates(baseInput()).find((state) => state.id === "AUTO_OFF")?.isDone,
    ).toBe(true);
  });

  it("AUTO_BALANCE done เมื่อ passesCoverage และ passesFairness", () => {
    const failingAchievement = {
      ...passingAchievement,
      passesCoverage: false,
      isAchieved: false,
    };

    expect(
      deriveScheduleStepStates(baseInput()).find((state) => state.id === "AUTO_BALANCE")?.isDone,
    ).toBe(true);
    expect(
      deriveScheduleStepStates(baseInput({ achievement: failingAchievement })).find(
        (state) => state.id === "AUTO_BALANCE",
      )?.isDone,
    ).toBe(false);
  });

  it("FREE_EDIT done เมื่อ passesHard", () => {
    const failingHard = computeScheduleAchievementStatus(
      {
        ...emptyValidation,
        hardViolations: [
          {
            code: "OTHER",
            source: "RULE",
            messageTh: "hard",
            severity: "HARD",
          },
        ],
      },
      [],
      null,
    );

    expect(
      deriveScheduleStepStates(baseInput()).find((state) => state.id === "FREE_EDIT")?.isDone,
    ).toBe(true);
    expect(
      deriveScheduleStepStates(baseInput({ achievement: failingHard })).find(
        (state) => state.id === "FREE_EDIT",
      )?.isDone,
    ).toBe(false);
  });

  it("PUBLISH done เมื่อ publishedVersionNumber ไม่เป็น null", () => {
    expect(
      deriveScheduleStepStates(baseInput({ publishedVersionNumber: null })).find(
        (state) => state.id === "PUBLISH",
      )?.isDone,
    ).toBe(false);
    expect(
      deriveScheduleStepStates(baseInput({ publishedVersionNumber: 3 })).find(
        (state) => state.id === "PUBLISH",
      )?.isDone,
    ).toBe(true);
  });

  it("คืนครบทุก step ตาม SCHEDULE_STEPS", () => {
    const states = deriveScheduleStepStates(baseInput());
    expect(states.map((state) => state.id)).toEqual(SCHEDULE_STEPS.map((step) => step.id));
  });
});

describe("resolveCanvasInteractionMode", () => {
  it("เปิด PAINT_OFF ที่ MANUAL_OFF และ AUTO_OFF เมื่อโควตาหรือเพดานต่อวันยังไม่ผ่าน", () => {
    const withQuota: ValidationResult = {
      ...emptyValidation,
      hardViolations: [
        {
          code: "DAY_OFF_QUOTA",
          source: "RULE",
          messageTh: "โควตาไม่ครบ",
          severity: "HARD",
        },
      ],
    };
    const withDailyCap: ValidationResult = {
      ...emptyValidation,
      hardViolations: [
        {
          code: "MAX_STAFF_OFF_PER_DAY",
          source: "RULE",
          messageTh: "วันที่ 2026-09-21 มีคนหยุด 3 คน เกินเพดาน 2 คน",
          severity: "HARD",
          scheduleDate: "2026-09-21",
        },
      ],
    };

    expect(resolveCanvasInteractionMode(true, "MANUAL_OFF", emptyValidation)).toBe("PAINT_OFF");
    expect(resolveCanvasInteractionMode(true, "AUTO_OFF", withQuota)).toBe("PAINT_OFF");
    expect(resolveCanvasInteractionMode(true, "AUTO_OFF", withDailyCap)).toBe("PAINT_OFF");
    expect(resolveCanvasInteractionMode(true, "AUTO_OFF", emptyValidation)).toBe("PICKER");
    expect(resolveCanvasInteractionMode(true, "FREE_EDIT", withQuota)).toBe("PICKER");
    expect(resolveCanvasInteractionMode(false, "MANUAL_OFF", withQuota)).toBe("PICKER");
  });
});

describe("resolveInitialStep", () => {
  it("เลือกขั้นแรกที่ยังไม่ done", () => {
    const states = deriveScheduleStepStates(
      baseInput({ grid: makeGrid({ emptySectionCount: 1 }), showEmptySections: true }),
    );

    expect(resolveInitialStep(states)).toBe("TIDY");
  });

  it("คืน PUBLISH เมื่อทุก step done", () => {
    const states = deriveScheduleStepStates(
      baseInput({
        grid: makeGrid({ hasPlannedOff: true, emptySectionCount: 0 }),
        showEmptySections: false,
        publishedVersionNumber: 2,
      }),
    );

    expect(states.every((state) => state.isDone)).toBe(true);
    expect(resolveInitialStep(states)).toBe("PUBLISH");
  });
});
