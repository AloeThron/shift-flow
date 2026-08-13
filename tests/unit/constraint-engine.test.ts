import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  analyzeFeasibility,
  buildAssignmentInterval,
  intervalsOverlap,
  type RuleInstanceSnapshot,
  type ScheduleEngineInput,
  type ScheduleSlot,
  type ShiftCodeSnapshot,
  solveSchedule,
  validateSchedule,
} from "@/domain/schedule";

const TIMEZONE = "Asia/Bangkok";

/** สิทธิทุกรหัสเวรสำหรับ fixture ทั่วไป */
function coversAllShiftAuth() {
  return [
    {
      shiftCodeId: null,
      coversAllShiftCodes: true,
      validFrom: "2020-01-01",
      validTo: null,
    },
  ] as const;
}

/** สร้าง shift code สังเคราะห์สำหรับทดสอบ */
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

/** baseline input ว่างสำหรับ org ทดสอบ */
function baseInput(organizationId: string): ScheduleEngineInput {
  return {
    organizationId,
    timezone: TIMEZONE,
    cycleStartDate: "2026-03-01",
    cycleEndDate: "2026-03-03",
    assignments: [],
    staff: [
      {
        id: "staff-1",
        gradeId: "grade-a",
        fte: 1,
        shiftAuthorizations: [
          {
            shiftCodeId: "code-day",
            validFrom: "2026-01-01T00:00:00.000Z",
            validTo: "2027-01-01T00:00:00.000Z",
          },
        ],
      },
      {
        id: "staff-2",
        gradeId: "grade-a",
        fte: 1,
        shiftAuthorizations: [...coversAllShiftAuth()],
      },
    ],
    shiftCodes: [
      makeShiftCode({ id: "code-day", code: "DAY" }),
      makeShiftCode({
        id: "code-night",
        code: "NIGHT",
        startTime: "20:00",
        endTime: "08:00",
        standardHours: 12,
      }),
    ],
    shiftDemands: [],
    ruleInstances: [],
    plannedNonWorkingDays: [],
    holidayDates: [],
  };
}

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

describe("constraint engine — invariants", () => {
  it("จับ assignment ทับเวลาของ staff เดียวกัน", () => {
    const day = makeShiftCode({ id: "code-day", code: "DAY" });
    const interval = buildAssignmentInterval(day, "2026-03-01", TIMEZONE);
    const input = baseInput("org-a");
    input.assignments = [
      {
        id: "a1",
        staffId: "staff-1",
        shiftCodeId: "code-day",
        scheduleDate: "2026-03-01",
        ...interval,
      },
      {
        id: "a2",
        staffId: "staff-1",
        shiftCodeId: "code-day",
        scheduleDate: "2026-03-01",
        ...interval,
      },
    ];

    const result = validateSchedule(input);
    expect(result.isValid).toBe(false);
    expect(result.hardViolations.some((item) => item.code === "NO_TIME_OVERLAP")).toBe(true);
  });

  it("APPROVED_LEAVE_BLOCK จับ assignment ทับ planned off ที่ blocksScheduling", () => {
    const day = makeShiftCode({ id: "code-day", code: "DAY" });
    const interval = buildAssignmentInterval(day, "2026-03-01", TIMEZONE);
    const input = baseInput("org-a");
    input.plannedNonWorkingDays = [
      {
        staffId: "staff-1",
        localDate: "2026-03-01",
        nonWorkingDayKindId: "kind-off",
        blocksScheduling: true,
      },
    ];
    input.assignments = [
      {
        id: "a1",
        staffId: "staff-1",
        shiftCodeId: "code-day",
        scheduleDate: "2026-03-01",
        ...interval,
      },
    ];

    const result = validateSchedule(input);
    expect(result.hardViolations.some((item) => item.code === "APPROVED_LEAVE_BLOCK")).toBe(true);
  });

  it("จับรหัสที่ยังไม่ยืนยัน", () => {
    const input = baseInput("org-a");
    input.shiftCodes = [makeShiftCode({ id: "code-x", code: "X", needsConfirmation: true })];
    const interval = buildAssignmentInterval(input.shiftCodes[0], "2026-03-01", TIMEZONE);
    input.assignments = [
      {
        id: "a1",
        staffId: "staff-1",
        shiftCodeId: "code-x",
        scheduleDate: "2026-03-01",
        ...interval,
      },
    ];

    const result = validateSchedule(input);
    expect(result.hardViolations.some((item) => item.code === "UNCONFIRMED_CODE_BLOCKED")).toBe(
      true,
    );
  });
});

describe("constraint engine — rule instances", () => {
  it("MIN_REST_BETWEEN_SHIFTS จับพักไม่พอ", () => {
    const input = baseInput("org-a");
    input.ruleInstances = [ruleInstance("MIN_REST_BETWEEN_SHIFTS", { minRestHours: 11 })];

    const night = input.shiftCodes.find((code) => code.id === "code-night")!;
    const day = input.shiftCodes.find((code) => code.id === "code-day")!;
    const nightInterval = buildAssignmentInterval(night, "2026-03-01", TIMEZONE);
    const dayInterval = buildAssignmentInterval(day, "2026-03-02", TIMEZONE);

    input.assignments = [
      {
        id: "n1",
        staffId: "staff-1",
        shiftCodeId: "code-night",
        scheduleDate: "2026-03-01",
        ...nightInterval,
      },
      {
        id: "d1",
        staffId: "staff-1",
        shiftCodeId: "code-day",
        scheduleDate: "2026-03-02",
        ...dayInterval,
      },
    ];

    const result = validateSchedule(input);
    expect(result.hardViolations.some((item) => item.code === "MIN_REST_BETWEEN_SHIFTS")).toBe(
      true,
    );
  });

  it("FORBIDDEN_CODE_SEQUENCE จับ night → day", () => {
    const input = baseInput("org-a");
    input.ruleInstances = [
      ruleInstance("FORBIDDEN_CODE_SEQUENCE", {
        sequences: [{ from: "NIGHT", to: "DAY" }],
      }),
    ];

    const night = input.shiftCodes.find((code) => code.id === "code-night")!;
    const day = input.shiftCodes.find((code) => code.id === "code-day")!;
    input.assignments = [
      {
        id: "n1",
        staffId: "staff-1",
        shiftCodeId: "code-night",
        scheduleDate: "2026-03-01",
        ...buildAssignmentInterval(night, "2026-03-01", TIMEZONE),
      },
      {
        id: "d1",
        staffId: "staff-1",
        shiftCodeId: "code-day",
        scheduleDate: "2026-03-02",
        ...buildAssignmentInterval(day, "2026-03-02", TIMEZONE),
      },
    ];

    const result = validateSchedule(input);
    expect(result.hardViolations.some((item) => item.code === "FORBIDDEN_CODE_SEQUENCE")).toBe(
      true,
    );
  });

  it("GRADE_CODE_WHITELIST จับ grade ไม่ตรง", () => {
    const input = baseInput("org-a");
    input.ruleInstances = [ruleInstance("GRADE_CODE_WHITELIST", { enforceFromShiftCodes: true })];
    input.shiftCodes = [
      makeShiftCode({ id: "code-day", code: "DAY", allowedGradeIds: ["grade-b"] }),
    ];
    const interval = buildAssignmentInterval(input.shiftCodes[0], "2026-03-01", TIMEZONE);
    input.assignments = [
      {
        id: "a1",
        staffId: "staff-1",
        shiftCodeId: "code-day",
        scheduleDate: "2026-03-01",
        ...interval,
      },
    ];

    const result = validateSchedule(input);
    expect(result.hardViolations.some((item) => item.code === "GRADE_CODE_WHITELIST")).toBe(true);
  });
});

describe("constraint engine — configurability", () => {
  it("org สองแห่งใช้กติกาต่างกันได้โดย engine เดียว", () => {
    const orgA = baseInput("org-a");
    orgA.ruleInstances = [ruleInstance("MIN_REST_BETWEEN_SHIFTS", { minRestHours: 8 })];

    const orgB = baseInput("org-b");
    orgB.ruleInstances = [ruleInstance("MIN_REST_BETWEEN_SHIFTS", { minRestHours: 12 })];

    const early = makeShiftCode({
      id: "code-early",
      code: "EARLY",
      startTime: "02:00",
      endTime: "10:00",
    });
    const late = makeShiftCode({
      id: "code-late",
      code: "LATE",
      startTime: "08:00",
      endTime: "16:00",
    });
    const lateInterval = buildAssignmentInterval(late, "2026-03-01", TIMEZONE);
    const earlyInterval = buildAssignmentInterval(early, "2026-03-02", TIMEZONE);

    const assignments = [
      {
        id: "late-1",
        staffId: "staff-1",
        shiftCodeId: "code-late",
        scheduleDate: "2026-03-01",
        ...lateInterval,
      },
      {
        id: "early-2",
        staffId: "staff-1",
        shiftCodeId: "code-early",
        scheduleDate: "2026-03-02",
        ...earlyInterval,
      },
    ];

    orgA.shiftCodes = [early, late];
    orgB.shiftCodes = [early, late];
    orgA.assignments = assignments;
    orgB.assignments = assignments;

    const resultA = validateSchedule(orgA);
    const resultB = validateSchedule(orgB);

    expect(resultA.isValid).toBe(true);
    expect(resultB.hardViolations.some((item) => item.code === "MIN_REST_BETWEEN_SHIFTS")).toBe(
      true,
    );
  });
});

describe("feasibility diagnostics", () => {
  it("แจ้งรหัสยังไม่ยืนยันใน slot", () => {
    const input = baseInput("org-a");
    input.shiftCodes = [
      makeShiftCode({ id: "code-pending", code: "PENDING", needsConfirmation: true }),
    ];
    const slots: ScheduleSlot[] = [
      {
        id: "slot-1",
        scheduleDate: "2026-03-01",
        shiftCodeId: "code-pending",
      },
    ];

    const result = analyzeFeasibility(input, slots);
    expect(result.feasible).toBe(false);
    expect(result.issues.some((item) => item.kind === "UNCONFIRMED_CODE")).toBe(true);
  });

  it("แจ้ง staff ไม่พอเมื่อทุกคนถูกจัดแล้ว", () => {
    const input = baseInput("org-a");
    const day = input.shiftCodes[0];
    const interval = buildAssignmentInterval(day, "2026-03-01", TIMEZONE);
    input.assignments = [
      {
        id: "a1",
        staffId: "staff-1",
        shiftCodeId: "code-day",
        scheduleDate: "2026-03-01",
        ...interval,
      },
      {
        id: "a2",
        staffId: "staff-2",
        shiftCodeId: "code-day",
        scheduleDate: "2026-03-01",
        ...interval,
      },
    ];

    const slots: ScheduleSlot[] = [
      {
        id: "slot-extra",
        scheduleDate: "2026-03-01",
        shiftCodeId: "code-day",
      },
    ];

    const result = analyzeFeasibility(input, slots);
    expect(result.issues.some((item) => item.kind === "INSUFFICIENT_STAFF")).toBe(true);
  });
});

describe("deterministic solver", () => {
  it("seed เดิมให้ผล assignment เดิม", () => {
    const input = baseInput("org-a");
    input.ruleInstances = [
      ruleInstance("MIN_REST_BETWEEN_SHIFTS", { minRestHours: 8 }),
      ruleInstance("GRADE_CODE_WHITELIST", { enforceFromShiftCodes: true }),
    ];

    const slots: ScheduleSlot[] = [
      { id: "slot-1", scheduleDate: "2026-03-01", shiftCodeId: "code-day" },
      { id: "slot-2", scheduleDate: "2026-03-02", shiftCodeId: "code-day" },
    ];

    const first = solveSchedule({ ...input, slots, randomSeed: "seed-alpha" });
    const second = solveSchedule({ ...input, slots, randomSeed: "seed-alpha" });

    expect(first.assignments.map((item) => `${item.staffId}:${item.scheduleDate}`)).toEqual(
      second.assignments.map((item) => `${item.staffId}:${item.scheduleDate}`),
    );
  });

  it("construct เติม slot ว่างได้", () => {
    const input = baseInput("org-a");
    input.ruleInstances = [
      ruleInstance("MIN_REST_BETWEEN_SHIFTS", { minRestHours: 8 }),
      ruleInstance("GRADE_CODE_WHITELIST", { enforceFromShiftCodes: true }),
    ];

    const slots: ScheduleSlot[] = [
      { id: "slot-1", scheduleDate: "2026-03-01", shiftCodeId: "code-day" },
    ];

    const result = solveSchedule({ ...input, slots, randomSeed: "seed-beta" });
    expect(result.assignments.length).toBeGreaterThanOrEqual(1);
    expect(result.assignments.some((item) => item.scheduleDate === "2026-03-01")).toBe(true);
  });
});

describe("constraint engine — property", () => {
  it("interval ที่ไม่ทับกันไม่ overlap", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        (startHour, gapHours) => {
          const startA = new Date(Date.UTC(2026, 2, 1, startHour, 0)).toISOString();
          const endA = new Date(Date.UTC(2026, 2, 1, startHour + 1, 0)).toISOString();
          const startB = new Date(Date.UTC(2026, 2, 1, startHour + 1 + gapHours, 0)).toISOString();
          const endB = new Date(Date.UTC(2026, 2, 1, startHour + 2 + gapHours, 0)).toISOString();
          expect(intervalsOverlap(startA, endA, startB, endB)).toBe(false);
        },
      ),
    );
  });
});
