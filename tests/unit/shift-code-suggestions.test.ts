import { spawn } from "node:child_process";
import { join } from "node:path";

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { buildValidationScheduleInput } from "@/domain/optimize/fairness/validation-roster";
import {
  buildSuggestionBaseline,
  compareSuggestionRank,
  rankShiftCodeCandidates,
  type NonWorkingDayKindRef,
  type SuggestionRank,
} from "@/domain/schedule/suggest";
import { buildAssignmentInterval } from "@/domain/schedule/time";
import type {
  RuleInstanceSnapshot,
  ScheduleEngineInput,
  ShiftCodeSnapshot,
} from "@/domain/schedule/types";

import { buildShiftCodeSuggestionPerformanceFixture } from "../helpers/shift-code-suggestion-performance-fixture";

const TIMEZONE = "Asia/Bangkok";

const NON_WORKING_DAY_KINDS: readonly NonWorkingDayKindRef[] = [
  { id: "kind-off", code: "off", displayName: "วันหยุด" },
];

/** สร้าง shift code สำหรับ unit test */
function makeShiftCode(
  overrides: Partial<ShiftCodeSnapshot> & Pick<ShiftCodeSnapshot, "id" | "code">,
): ShiftCodeSnapshot {
  return {
    departmentId: "dept-a",
    startTime: "08:00",
    endTime: "16:00",
    standardHours: 8,
    allowedGradeIds: ["grade-a"],
    needsConfirmation: false,
    active: true,
    ...overrides,
  };
}

/** rule instance มาตรฐาน */
function ruleInstance(
  ruleTemplateId: string,
  params: Record<string, unknown>,
  severity: "HARD" | "SOFT" = "HARD",
): RuleInstanceSnapshot {
  return {
    id: `rule-${ruleTemplateId}`,
    ruleTemplateId,
    params,
    severity,
    weight: severity === "SOFT" ? 1 : null,
    overrideClass: "NEVER",
    enabled: true,
  };
}

/** baseline input ว่าง */
function baseInput(): ScheduleEngineInput {
  return {
    organizationId: "org-suggest",
    timezone: TIMEZONE,
    cycleStartDate: "2026-03-01",
    cycleEndDate: "2026-03-07",
    assignments: [],
    staff: [
      {
        id: "staff-1",
        gradeId: "grade-a",
        staffGroupId: "group-a",
        fte: 1,
        shiftAuthorizations: [],
      },
    ],
    shiftCodes: [],
    shiftDemands: [],
    ruleInstances: [],
    plannedNonWorkingDays: [],
    holidayDates: [],
  };
}

/** พารามิเตอร์ rank มาตรฐาน */
function rankParams(
  input: ScheduleEngineInput,
  staffId: string,
  localDate: string,
  overrides: Partial<{
    nonWorkingDayKinds: readonly NonWorkingDayKindRef[];
    defaultOffKindId: string;
  }> = {},
) {
  const baseline = buildSuggestionBaseline(input, staffId, localDate);
  return {
    staffId,
    localDate,
    baseline,
    nonWorkingDayKinds: overrides.nonWorkingDayKinds ?? NON_WORKING_DAY_KINDS,
    defaultOffKindId: overrides.defaultOffKindId ?? "kind-off",
  };
}

/** ดึงรหัส SHIFT_CODE จากรายการแนะนำ */
function shiftCodesFromSuggestions(
  suggestions: ReturnType<typeof rankShiftCodeCandidates>,
): readonly string[] {
  return suggestions
    .filter((entry) => entry.action.kind === "SHIFT_CODE")
    .map((entry) => (entry.action.kind === "SHIFT_CODE" ? entry.action.code : ""));
}

/** รัน subprocess performance gate */
function runSuggestionPerformanceGateSubprocess(): Promise<void> {
  const scriptPath = join(
    process.cwd(),
    "tests/helpers/run-shift-code-suggestion-performance-gate.ts",
  );

  return new Promise((resolve, reject) => {
    const child = spawn("pnpm exec tsx", [`"${scriptPath}"`], {
      shell: true,
      stdio: "pipe",
      env: process.env,
    });

    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(stderr || `shift-code suggestion performance gate exit ${code ?? "unknown"}`),
      );
    });
  });
}

describe("shift code suggestions — eligibility", () => {
  it("ไม่แสดงรหัสที่ระดับพนักงานใช้ไม่ได้", () => {
    const input = baseInput();
    input.shiftCodes = [
      makeShiftCode({ id: "sc-eligible", code: "DAY", allowedGradeIds: ["grade-a"] }),
      makeShiftCode({ id: "sc-blocked-grade", code: "HEAD", allowedGradeIds: ["grade-b"] }),
    ];

    const suggestions = rankShiftCodeCandidates(input, rankParams(input, "staff-1", "2026-03-01"));
    const codes = shiftCodesFromSuggestions(suggestions);

    expect(codes).toContain("DAY");
    expect(codes).not.toContain("HEAD");
  });

  it("ไม่แสดงรหัส needsConfirmation", () => {
    const input = baseInput();
    input.shiftCodes = [
      makeShiftCode({ id: "sc-ready", code: "DAY" }),
      makeShiftCode({ id: "sc-pending", code: "PENDING", needsConfirmation: true }),
    ];

    const suggestions = rankShiftCodeCandidates(input, rankParams(input, "staff-1", "2026-03-01"));
    const codes = shiftCodesFromSuggestions(suggestions);

    expect(codes).toContain("DAY");
    expect(codes).not.toContain("PENDING");
  });

  it("ไม่แสดงรหัส inactive", () => {
    const input = baseInput();
    input.shiftCodes = [
      makeShiftCode({ id: "sc-active", code: "DAY", active: true }),
      makeShiftCode({ id: "sc-inactive", code: "OLD", active: false }),
    ];

    const suggestions = rankShiftCodeCandidates(input, rankParams(input, "staff-1", "2026-03-01"));
    const codes = shiftCodesFromSuggestions(suggestions);

    expect(codes).toContain("DAY");
    expect(codes).not.toContain("OLD");
  });
});

describe("shift code suggestions — HARD blocked", () => {
  it("ทำเครื่องหมาย blocked พร้อม messageTh เมื่อทำให้เกิด HARD ใหม่", () => {
    const night = makeShiftCode({
      id: "sc-night",
      code: "NIGHT",
      startTime: "20:00",
      endTime: "08:00",
      standardHours: 12,
    });
    const day = makeShiftCode({ id: "sc-day", code: "DAY" });

    const input = baseInput();
    input.ruleInstances = [ruleInstance("MIN_REST_BETWEEN_SHIFTS", { minRestHours: 11 })];
    input.shiftCodes = [night, day];

    const nightInterval = buildAssignmentInterval(night, "2026-03-01", TIMEZONE);
    input.assignments = [
      {
        id: "a-night",
        staffId: "staff-1",
        shiftCodeId: night.id,
        scheduleDate: "2026-03-01",
        ...nightInterval,
      },
    ];

    const suggestions = rankShiftCodeCandidates(input, rankParams(input, "staff-1", "2026-03-02"));
    const daySuggestion = suggestions.find(
      (entry) => entry.action.kind === "SHIFT_CODE" && entry.action.code === "DAY",
    );

    expect(daySuggestion?.rank.blocked).toBe(true);
    expect(daySuggestion?.blockingReasonsTh.length).toBeGreaterThan(0);
  });
});

describe("shift code suggestions — ranking", () => {
  it("รหัสที่ปิด coverage gap ขึ้นก่อน", () => {
    const fillCode = makeShiftCode({
      id: "sc-fill",
      code: "FILL",
      departmentId: "dept-a",
      startTime: "08:00",
      endTime: "16:00",
    });
    const otherCode = makeShiftCode({
      id: "sc-other",
      code: "OTHER",
      departmentId: "dept-b",
      startTime: "08:00",
      endTime: "16:00",
    });

    const input = baseInput();
    input.staff = [
      {
        id: "staff-1",
        gradeId: "grade-a",
        staffGroupId: "group-a",
        fte: 1,
        shiftAuthorizations: [],
      },
      {
        id: "staff-2",
        gradeId: "grade-a",
        staffGroupId: "group-a",
        fte: 1,
        shiftAuthorizations: [],
      },
    ];
    input.shiftCodes = [fillCode, otherCode];
    input.shiftDemands = [
      {
        id: "dem-1",
        shiftCodeId: fillCode.id,
        dayType: "ALL",
        minCount: 2,
        requiresLead: false,
      },
    ];

    const fillInterval = buildAssignmentInterval(fillCode, "2026-03-01", TIMEZONE);
    input.assignments = [
      {
        id: "a-peer",
        staffId: "staff-2",
        shiftCodeId: fillCode.id,
        scheduleDate: "2026-03-01",
        ...fillInterval,
      },
    ];

    const suggestions = rankShiftCodeCandidates(input, rankParams(input, "staff-1", "2026-03-01"));
    const shiftSuggestions = suggestions.filter((entry) => entry.action.kind === "SHIFT_CODE");
    const fillIndex = shiftSuggestions.findIndex(
      (entry) => entry.action.kind === "SHIFT_CODE" && entry.action.code === "FILL",
    );
    const otherIndex = shiftSuggestions.findIndex(
      (entry) => entry.action.kind === "SHIFT_CODE" && entry.action.code === "OTHER",
    );

    expect(fillIndex).toBeGreaterThanOrEqual(0);
    expect(otherIndex).toBeGreaterThanOrEqual(0);
    expect(fillIndex).toBeLessThan(otherIndex);
    expect(shiftSuggestions[fillIndex]?.rank.coverageGapFilled).toBeGreaterThan(0);
  });

  it("คนที่ต่ำกว่าค่ากลางกลุ่มได้รหัสชั่วโมงมากขึ้นก่อน", () => {
    const shortCode = makeShiftCode({
      id: "sc-short",
      code: "SHORT",
      standardHours: 4,
      otHours: 0,
    });
    const longCode = makeShiftCode({
      id: "sc-long",
      code: "LONG",
      standardHours: 12,
      otHours: 2,
    });

    const input = baseInput();
    input.staff = [
      {
        id: "staff-low",
        gradeId: "grade-a",
        staffGroupId: "group-a",
        fte: 1,
        shiftAuthorizations: [],
      },
      {
        id: "staff-high",
        gradeId: "grade-a",
        staffGroupId: "group-a",
        fte: 1,
        shiftAuthorizations: [],
      },
    ];
    input.shiftCodes = [shortCode, longCode];
    input.ruleInstances = [
      ruleInstance(
        "FAIR_DISTRIBUTION",
        {
          dimension: "TOTAL_HOURS",
          scope: "GROUP",
          toleranceHours: 24,
          normalizeByFte: true,
          lookbackMonths: 6,
        },
        "SOFT",
      ),
    ];
    input.staffWorkloadMonthly = [
      {
        staffId: "staff-low",
        yearMonth: "2026-02",
        plannedHours: 40,
        otHours: 0,
        nightCount: 0,
        weekendCount: 0,
        holidayCount: 0,
        workedDays: 5,
        daysOff: 2,
        fteAtPeriod: 1,
      },
      {
        staffId: "staff-high",
        yearMonth: "2026-02",
        plannedHours: 200,
        otHours: 0,
        nightCount: 0,
        weekendCount: 0,
        holidayCount: 0,
        workedDays: 20,
        daysOff: 2,
        fteAtPeriod: 1,
      },
    ];

    const suggestions = rankShiftCodeCandidates(
      input,
      rankParams(input, "staff-low", "2026-03-01"),
    );
    const shiftSuggestions = suggestions.filter((entry) => entry.action.kind === "SHIFT_CODE");
    const longIndex = shiftSuggestions.findIndex(
      (entry) => entry.action.kind === "SHIFT_CODE" && entry.action.code === "LONG",
    );
    const shortIndex = shiftSuggestions.findIndex(
      (entry) => entry.action.kind === "SHIFT_CODE" && entry.action.code === "SHORT",
    );

    expect(longIndex).toBeGreaterThanOrEqual(0);
    expect(shortIndex).toBeGreaterThanOrEqual(0);
    expect(longIndex).toBeLessThan(shortIndex);
    expect(shiftSuggestions[longIndex]?.rank.fairnessGain).toBeGreaterThan(
      shiftSuggestions[shortIndex]?.rank.fairnessGain ?? 0,
    );
  });

  it("เรียงซ้ำได้ผลเดิมจาก input เดิม", () => {
    const input = baseInput();
    input.shiftCodes = [
      makeShiftCode({ id: "sc-a", code: "ALPHA" }),
      makeShiftCode({ id: "sc-b", code: "BETA" }),
      makeShiftCode({ id: "sc-c", code: "GAMMA" }),
    ];

    const params = rankParams(input, "staff-1", "2026-03-01");
    const first = rankShiftCodeCandidates(input, params);
    const second = rankShiftCodeCandidates(input, params);

    const actionKey = (suggestions: typeof first) =>
      suggestions.map((entry) => {
        if (entry.action.kind === "SHIFT_CODE") {
          return entry.action.code;
        }
        if (entry.action.kind === "PLANNED_OFF") {
          return `off:${entry.action.code}`;
        }
        return "clear";
      });

    expect(actionKey(first)).toEqual(actionKey(second));
  });

  it("compareSuggestionRank — ไม่บล็อกอยู่ก่อนบล็อก", () => {
    const blocked: SuggestionRank = {
      blocked: true,
      coverageGapFilled: 99,
      fairnessGain: 99,
      softScoreDelta: -99,
      recentUsage: 99,
    };
    const allowed: SuggestionRank = {
      blocked: false,
      coverageGapFilled: 0,
      fairnessGain: 0,
      softScoreDelta: 0,
      recentUsage: 0,
    };

    expect(compareSuggestionRank(allowed, blocked, "A", "B")).toBeLessThan(0);
    expect(compareSuggestionRank(blocked, allowed, "A", "B")).toBeGreaterThan(0);
  });

  it("เติม PLANNED_OFF และ CLEAR ท้ายรายการเสมอ", () => {
    const input = baseInput();
    input.shiftCodes = [makeShiftCode({ id: "sc-day", code: "DAY" })];

    const suggestions = rankShiftCodeCandidates(input, rankParams(input, "staff-1", "2026-03-01"));
    const plannedOff = suggestions.filter((entry) => entry.action.kind === "PLANNED_OFF");
    const clear = suggestions.find((entry) => entry.action.kind === "CLEAR");

    expect(plannedOff.length).toBeGreaterThan(0);
    expect(clear).toBeDefined();
    expect(suggestions[suggestions.length - 1]?.action.kind).toBe("CLEAR");
  });
});

describe("shift code suggestions — properties", () => {
  it("ตัวเลือกที่ไม่บล็อกอยู่ก่อนตัวเลือกที่บล็อกเสมอ", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 0, max: 5 }),
        (coverageGap, fairnessGain, recentUsage) => {
          const ranks: SuggestionRank[] = [
            {
              blocked: false,
              coverageGapFilled: coverageGap,
              fairnessGain,
              softScoreDelta: 0,
              recentUsage,
            },
            {
              blocked: true,
              coverageGapFilled: coverageGap + 10,
              fairnessGain: fairnessGain + 10,
              softScoreDelta: -10,
              recentUsage: recentUsage + 10,
            },
          ];

          const sorted = [...ranks].sort((left, right) =>
            compareSuggestionRank(left, right, "A", "B"),
          );
          expect(sorted[0]?.blocked).toBe(false);
          expect(sorted[1]?.blocked).toBe(true);
        },
      ),
    );
  });

  it("ไม่มีรหัส SHIFT_CODE ซ้ำในรายการ", () => {
    const input = baseInput();
    input.shiftCodes = [
      makeShiftCode({ id: "sc-1", code: "A" }),
      makeShiftCode({ id: "sc-2", code: "B" }),
      makeShiftCode({ id: "sc-3", code: "C" }),
      makeShiftCode({ id: "sc-4", code: "D", allowedGradeIds: ["grade-b"] }),
      makeShiftCode({ id: "sc-5", code: "E", needsConfirmation: true }),
    ];
    input.ruleInstances = [ruleInstance("MIN_REST_BETWEEN_SHIFTS", { minRestHours: 11 })];

    const night = makeShiftCode({
      id: "sc-night",
      code: "NIGHT",
      startTime: "20:00",
      endTime: "08:00",
      standardHours: 12,
    });
    input.shiftCodes = [...input.shiftCodes, night];

    const nightInterval = buildAssignmentInterval(night, "2026-03-01", TIMEZONE);
    input.assignments = [
      {
        id: "a-night",
        staffId: "staff-1",
        shiftCodeId: night.id,
        scheduleDate: "2026-03-01",
        ...nightInterval,
      },
    ];

    const suggestions = rankShiftCodeCandidates(input, rankParams(input, "staff-1", "2026-03-02"));
    const codes = shiftCodesFromSuggestions(suggestions);
    const unique = new Set(codes);

    expect(unique.size).toBe(codes.length);
  });

  it("rankShiftCodeCandidates — ไม่บล็อกอยู่ก่อนบล็อกบน validation dataset", () => {
    const { input } = buildValidationScheduleInput({
      cycleStartDate: "2026-06-01",
      cycleEndDate: "2026-06-07",
      includeHistoricalAssignments: true,
    });
    const cycleDates = ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05"];

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: input.staff.length - 1 }),
        fc.integer({ min: 0, max: cycleDates.length - 1 }),
        (staffIndex, dateIndex) => {
          const staffId = input.staff[staffIndex]?.id;
          const localDate = cycleDates[dateIndex];
          if (!staffId || !localDate) {
            return;
          }

          const suggestions = rankShiftCodeCandidates(input, rankParams(input, staffId, localDate));
          const shiftSuggestions = suggestions.filter(
            (entry) => entry.action.kind === "SHIFT_CODE",
          );

          let seenBlocked = false;
          for (const entry of shiftSuggestions) {
            if (entry.rank.blocked) {
              seenBlocked = true;
            } else {
              expect(seenBlocked).toBe(false);
            }
          }
        },
      ),
      { numRuns: 12 },
    );
  }, 60_000);
});

describe("shift code suggestions — planned off, swap, override", () => {
  it("สร้าง PLANNED_OFF ครบทุกชนิดจาก nonWorkingDayKinds", () => {
    const kinds = [
      { id: "kind-off", code: "off", displayName: "วันหยุด" },
      { id: "kind-vac", code: "VAC", displayName: "ลาพักร้อน" },
      { id: "kind-sick", code: "SICK", displayName: "ลาป่วย" },
    ];

    const input = baseInput();
    input.shiftCodes = [makeShiftCode({ id: "sc-day", code: "DAY" })];

    const suggestions = rankShiftCodeCandidates(
      input,
      rankParams(input, "staff-1", "2026-03-01", {
        nonWorkingDayKinds: kinds,
        defaultOffKindId: "kind-off",
      }),
    );

    const planned = suggestions.filter((entry) => entry.action.kind === "PLANNED_OFF");
    expect(planned).toHaveLength(3);
    expect(
      planned.map((entry) => (entry.action.kind === "PLANNED_OFF" ? entry.action.code : "")),
    ).toEqual(expect.arrayContaining(["off", "VAC", "SICK"]));
  });

  it("มีตัวเลือก SWAP_WITH เมื่อมีคนอื่นในวันเดียวกัน", () => {
    const day = makeShiftCode({ id: "sc-day", code: "DAY" });
    const input = baseInput();
    input.staff = [
      {
        id: "staff-1",
        gradeId: "grade-a",
        staffGroupId: "group-a",
        fte: 1,
        shiftAuthorizations: [],
      },
      {
        id: "staff-2",
        gradeId: "grade-a",
        staffGroupId: "group-a",
        fte: 1,
        shiftAuthorizations: [],
      },
    ];
    input.shiftCodes = [day];
    input.assignments = [
      {
        id: "peer",
        staffId: "staff-2",
        shiftCodeId: day.id,
        scheduleDate: "2026-03-02",
        ...buildAssignmentInterval(day, "2026-03-02", TIMEZONE),
      },
    ];

    const baseline = buildSuggestionBaseline(input, "staff-1", "2026-03-02");
    const suggestions = rankShiftCodeCandidates(input, {
      staffId: "staff-1",
      localDate: "2026-03-02",
      baseline,
      nonWorkingDayKinds: NON_WORKING_DAY_KINDS,
      defaultOffKindId: "kind-off",
      staffGroupId: "group-a",
      sameDayAssignments: [
        {
          staffId: "staff-2",
          staffDisplayName: "เพื่อนร่วมกลุ่ม",
          shiftCodeId: day.id,
          code: day.code,
        },
      ],
    });

    const swap = suggestions.find((entry) => entry.action.kind === "SWAP_WITH");
    expect(swap).toBeDefined();
    expect(swap?.action.kind === "SWAP_WITH" ? swap.action.counterpartStaffId : "").toBe("staff-2");
  });

  it("สร้าง OVERRIDE สำหรับรหัสที่ blocked และไม่ blocked ใน rank", () => {
    const night = makeShiftCode({
      id: "sc-night",
      code: "NIGHT",
      startTime: "20:00",
      endTime: "08:00",
      standardHours: 12,
    });
    const day = makeShiftCode({ id: "sc-day", code: "DAY" });

    const input = baseInput();
    input.ruleInstances = [ruleInstance("MIN_REST_BETWEEN_SHIFTS", { minRestHours: 11 })];
    input.shiftCodes = [night, day];

    const nightInterval = buildAssignmentInterval(night, "2026-03-01", TIMEZONE);
    input.assignments = [
      {
        id: "a-night",
        staffId: "staff-1",
        shiftCodeId: night.id,
        scheduleDate: "2026-03-01",
        ...nightInterval,
      },
    ];

    const suggestions = rankShiftCodeCandidates(input, rankParams(input, "staff-1", "2026-03-02"));
    const override = suggestions.find(
      (entry) => entry.action.kind === "OVERRIDE" && entry.action.code === "DAY",
    );

    expect(override).toBeDefined();
    expect(override?.rank.blocked).toBe(false);
    expect(override?.blockingReasonsTh.length).toBeGreaterThan(0);
  });
});

describe("shift code suggestion performance gate", () => {
  it("p95 จัดอันดับหนึ่งเซลล์ ≤ 150ms บนข้อมูล validation +25%", async () => {
    const fixture = buildShiftCodeSuggestionPerformanceFixture(1.25);
    expect(fixture.staffCount).toBeGreaterThanOrEqual(20);
    expect(fixture.shiftCodeCount).toBeGreaterThanOrEqual(10);

    await expect(runSuggestionPerformanceGateSubprocess()).resolves.toBeUndefined();
  }, 120_000);
});
