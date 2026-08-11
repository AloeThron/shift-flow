import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  getRuleTemplate,
  validateDayOffQuota,
  validateFairDistribution,
  validateMaxConsecutiveDays,
  validateMaxStaffOffPerDay,
  validateOtLimit,
  validateRuleParams,
} from "@/domain/rules";
import { assignmentOtHours, collectStaffOffDates } from "@/domain/rules/helpers/schedule-metrics";
import {
  buildAssignmentInterval,
  eachDateInRange,
  validateSchedule,
  type RuleInstanceSnapshot,
  type ScheduleEngineInput,
  type ShiftCodeSnapshot,
} from "@/domain/schedule";
import { buildValidationContext } from "@/domain/schedule/validate";

const TIMEZONE = "Asia/Bangkok";
const OFF_KIND = "kind-off";

/** snapshot วันหยุดที่วางแผนสำหรับทดสอบ */
function plannedOff(
  staffId: string,
  localDate: string,
  options: { locked?: boolean; blocksScheduling?: boolean } = {},
): ScheduleEngineInput["plannedNonWorkingDays"][number] {
  return {
    staffId,
    localDate,
    nonWorkingDayKindId: OFF_KIND,
    blocksScheduling: options.blocksScheduling ?? true,
    ...(options.locked !== undefined ? { locked: options.locked } : {}),
  };
}

/** สร้าง shift code สังเคราะห์ */
function makeShiftCode(
  overrides: Partial<ShiftCodeSnapshot> & Pick<ShiftCodeSnapshot, "id" | "code">,
): ShiftCodeSnapshot {
  return {
    departmentId: "dept-a",
    startTime: "08:00",
    endTime: "16:00",
    standardHours: 8,
    otHours: 0,
    isNightShift: false,
    allowedGradeIds: ["grade-a"],
    needsConfirmation: false,
    active: true,
    ...overrides,
  };
}

/** baseline input สำหรับทดสอบ rule ใหม่ */
function baseInput(organizationId: string): ScheduleEngineInput {
  return {
    organizationId,
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
      {
        id: "staff-2",
        gradeId: "grade-a",
        staffGroupId: "group-a",
        fte: 1,
        shiftAuthorizations: [],
      },
      {
        id: "staff-3",
        gradeId: "grade-a",
        staffGroupId: "group-b",
        fte: 0.5,
        shiftAuthorizations: [],
      },
    ],
    shiftCodes: [
      makeShiftCode({ id: "code-day", code: "DAY" }),
      makeShiftCode({ id: "code-off", code: "off", standardHours: 0, startTime: "", endTime: "" }),
      makeShiftCode({
        id: "code-night",
        code: "NIGHT",
        startTime: "20:00",
        endTime: "08:00",
        standardHours: 12,
        isNightShift: true,
        otHours: 2,
      }),
    ],
    shiftDemands: [],
    ruleInstances: [],
    plannedNonWorkingDays: [],
    holidayDates: ["2026-03-03"],
    staffWorkloadMonthly: [],
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
    overrideClass: severity === "SOFT" ? "SCHEDULER_ALLOWED" : "NEVER",
    enabled: true,
  };
}

function dayAssignment(
  input: ScheduleEngineInput,
  staffId: string,
  scheduleDate: string,
  shiftCodeId = "code-day",
) {
  const shiftCode = input.shiftCodes.find((code) => code.id === shiftCodeId)!;
  return {
    id: `${staffId}-${scheduleDate}-${shiftCodeId}`,
    staffId,
    shiftCodeId,
    scheduleDate,
    ...buildAssignmentInterval(shiftCode, scheduleDate, TIMEZONE),
  };
}

describe("rule template registry — templates ใหม่", () => {
  it("มี template ครบ 5 รายการใน registry", () => {
    const ids = [
      "MAX_CONSECUTIVE_DAYS",
      "FAIR_DISTRIBUTION",
      "DAY_OFF_QUOTA",
      "MAX_STAFF_OFF_PER_DAY",
      "OT_LIMIT",
    ] as const;

    for (const id of ids) {
      expect(getRuleTemplate(id)?.validatorKey).toBeTruthy();
    }
  });

  it("DAY_OFF_QUOTA ต้องมี daysOffPerCycle หรือ daysOffPerWeek", () => {
    const invalid = validateRuleParams("DAY_OFF_QUOTA", { minWeekendDaysOff: 1 });
    expect(invalid.ok).toBe(false);

    const valid = validateRuleParams("DAY_OFF_QUOTA", { daysOffPerCycle: 8 });
    expect(valid.ok).toBe(true);
  });

  it("OT_LIMIT ต้องมีเพดานอย่างน้อยหนึ่งค่า", () => {
    const invalid = validateRuleParams("OT_LIMIT", {});
    expect(invalid.ok).toBe(false);

    const valid = validateRuleParams("OT_LIMIT", { maxOtHoursPerStaffPerCycle: 20 });
    expect(valid.ok).toBe(true);
  });
});

describe("MAX_CONSECUTIVE_DAYS", () => {
  it("จับวันทำงานติดกันเกินเพดานเมื่อ countOffAsBreak=true", () => {
    const input = baseInput("org-a");
    const instance = ruleInstance("MAX_CONSECUTIVE_DAYS", {
      maxConsecutiveDays: 3,
      countOffAsBreak: true,
    });
    input.assignments = eachDateInRange("2026-03-01", "2026-03-05").map((date) =>
      dayAssignment(input, "staff-1", date),
    );

    const context = buildValidationContext(input);
    const violations = validateMaxConsecutiveDays(context, instance);

    expect(violations.some((item) => item.code === "MAX_CONSECUTIVE_DAYS")).toBe(true);
    expect(violations.some((item) => item.staffId === "staff-1")).toBe(true);
  });

  it("วันหยุดตัด streak เมื่อ countOffAsBreak=true", () => {
    const input = baseInput("org-a");
    const instance = ruleInstance("MAX_CONSECUTIVE_DAYS", {
      maxConsecutiveDays: 3,
      countOffAsBreak: true,
    });
    input.plannedNonWorkingDays = [plannedOff("staff-1", "2026-03-03")];
    input.assignments = ["2026-03-01", "2026-03-02", "2026-03-04", "2026-03-05"].map((date) =>
      dayAssignment(input, "staff-1", date),
    );

    const context = buildValidationContext(input);
    const violations = validateMaxConsecutiveDays(context, instance);

    expect(violations).toHaveLength(0);
  });

  it("countOffAsBreak=false นับเฉพาะวันที่มี assignment ติดกัน", () => {
    const input = baseInput("org-a");
    const instance = ruleInstance("MAX_CONSECUTIVE_DAYS", {
      maxConsecutiveDays: 2,
      countOffAsBreak: false,
    });
    input.assignments = ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-06", "2026-03-07"].map(
      (date) => dayAssignment(input, "staff-1", date),
    );

    const context = buildValidationContext(input);
    const violations = validateMaxConsecutiveDays(context, instance);

    expect(violations.some((item) => item.details?.streak === 3)).toBe(true);
    expect(violations.some((item) => item.details?.countOffAsBreak === false)).toBe(true);
  });
});

describe("DAY_OFF_QUOTA", () => {
  it("จับเมื่อได้วันหยุดน้อยกว่าโควตา", () => {
    const input = baseInput("org-a");
    const instance = ruleInstance("DAY_OFF_QUOTA", { daysOffPerCycle: 3 });
    input.plannedNonWorkingDays = [plannedOff("staff-1", "2026-03-02")];

    const context = buildValidationContext(input);
    const violations = validateDayOffQuota(context, instance);

    expect(violations.some((item) => item.code === "DAY_OFF_QUOTA")).toBe(true);
    expect(violations[0]?.details?.deficit).toBe(2);
  });

  it("planned off นับรวมในโควตา", () => {
    const input = baseInput("org-a");
    const instance = ruleInstance("DAY_OFF_QUOTA", { daysOffPerCycle: 2 });
    input.plannedNonWorkingDays = input.staff.flatMap((member) => [
      plannedOff(member.id, "2026-03-01"),
      plannedOff(member.id, "2026-03-02"),
    ]);

    const context = buildValidationContext(input);
    const violations = validateDayOffQuota(context, instance);

    expect(violations).toHaveLength(0);
  });

  it("minWeekendDaysOff จับวันหยุดสุดสัปดาห์ไม่ครบ", () => {
    const input = baseInput("org-a");
    const instance = ruleInstance("DAY_OFF_QUOTA", {
      daysOffPerCycle: 1,
      minWeekendDaysOff: 2,
    });
    input.plannedNonWorkingDays = [plannedOff("staff-1", "2026-03-07")];

    const context = buildValidationContext(input);
    const violations = validateDayOffQuota(context, instance);

    expect(violations.some((item) => item.messageTh.includes("สุดสัปดาห์"))).toBe(true);
  });
});

describe("MAX_STAFF_OFF_PER_DAY", () => {
  it("จับเมื่อคนหยุดพร้อมกันเกินเพดานต่อกลุ่ม", () => {
    const input = baseInput("org-a");
    const instance = ruleInstance("MAX_STAFF_OFF_PER_DAY", {
      maxOffWeekday: 1,
      scope: "GROUP",
    });
    input.plannedNonWorkingDays = [
      plannedOff("staff-1", "2026-03-02"),
      plannedOff("staff-2", "2026-03-02"),
    ];

    const context = buildValidationContext(input);
    const violations = validateMaxStaffOffPerDay(context, instance);

    expect(violations.some((item) => item.code === "MAX_STAFF_OFF_PER_DAY")).toBe(true);
    expect(violations[0]?.details?.scopeKey).toBe("group-a");
  });

  it("แยกนับตามกลุ่ม — group-b ไม่โดน violation ของ group-a", () => {
    const input = baseInput("org-a");
    const instance = ruleInstance("MAX_STAFF_OFF_PER_DAY", {
      maxOffWeekday: 0,
      scope: "GROUP",
    });
    input.plannedNonWorkingDays = [plannedOff("staff-3", "2026-03-02")];

    const context = buildValidationContext(input);
    const violations = validateMaxStaffOffPerDay(context, instance);

    expect(violations.some((item) => item.details?.scopeKey === "group-b")).toBe(true);
    expect(violations.some((item) => item.details?.scopeKey === "group-a")).toBe(false);
  });
});

describe("OT_LIMIT", () => {
  it("จับ OT ต่อคนเกินเพดาน", () => {
    const input = baseInput("org-a");
    const instance = ruleInstance("OT_LIMIT", { maxOtHoursPerStaffPerCycle: 3 });
    input.assignments = [
      {
        ...dayAssignment(input, "staff-1", "2026-03-01", "code-night"),
        plannedOtHours: 2,
      },
    ];

    const context = buildValidationContext(input);
    const violations = validateOtLimit(context, instance);

    expect(violations.some((item) => item.code === "OT_LIMIT" && item.staffId === "staff-1")).toBe(
      true,
    );
  });

  it("จับ OT ทั้งองค์กรเกินเพดาน", () => {
    const input = baseInput("org-a");
    const instance = ruleInstance("OT_LIMIT", { maxOtHoursPerOrgPerCycle: 3 });
    input.assignments = [
      dayAssignment(input, "staff-1", "2026-03-01", "code-night"),
      dayAssignment(input, "staff-2", "2026-03-01", "code-night"),
    ];

    const context = buildValidationContext(input);
    const violations = validateOtLimit(context, instance);

    expect(violations.some((item) => item.details?.orgOtHours === 4)).toBe(true);
  });
});

describe("FAIR_DISTRIBUTION", () => {
  it("จับ spread ชั่วโมงเกิน tolerance ในกลุ่ม", () => {
    const input = baseInput("org-a");
    const instance = ruleInstance(
      "FAIR_DISTRIBUTION",
      {
        dimension: "TOTAL_HOURS",
        scope: "GROUP",
        toleranceHours: 4,
        normalizeByFte: false,
        lookbackMonths: 1,
      },
      "SOFT",
    );

    input.assignments = [
      dayAssignment(input, "staff-1", "2026-03-01"),
      dayAssignment(input, "staff-1", "2026-03-02"),
      dayAssignment(input, "staff-2", "2026-03-01"),
    ];
    input.staffWorkloadMonthly = [
      {
        staffId: "staff-1",
        yearMonth: "2026-02",
        staffGroupId: "group-a",
        plannedHours: 40,
        otHours: 0,
        nightCount: 0,
        weekendCount: 0,
        holidayCount: 0,
        workedDays: 0,
        daysOff: 0,
        fteAtPeriod: 1,
      },
    ];

    const context = buildValidationContext(input);
    const violations = validateFairDistribution(context, instance);

    expect(violations.some((item) => item.code === "FAIR_DISTRIBUTION")).toBe(true);
  });

  it("normalizeByFte ลด spread เมื่อ part-time รับภาระสัดส่วนเท่ากัน", () => {
    const input = baseInput("org-a");
    input.staff = input.staff.filter((member) => member.id !== "staff-2");
    const instance = ruleInstance(
      "FAIR_DISTRIBUTION",
      {
        dimension: "TOTAL_HOURS",
        scope: "ORG",
        toleranceHours: 4,
        normalizeByFte: true,
        lookbackMonths: 1,
      },
      "SOFT",
    );

    input.assignments = [
      dayAssignment(input, "staff-1", "2026-03-01"),
      dayAssignment(input, "staff-1", "2026-03-02"),
      dayAssignment(input, "staff-3", "2026-03-01"),
    ];

    const context = buildValidationContext(input);
    const violations = validateFairDistribution(context, instance);

    expect(violations).toHaveLength(0);
  });
});

describe("rule templates — configurability", () => {
  it("org สองแห่งใช้ MAX_CONSECUTIVE_DAYS คนละเพดาน", () => {
    const orgA = baseInput("org-a");
    orgA.assignments = eachDateInRange("2026-03-01", "2026-03-05").map((date) =>
      dayAssignment(orgA, "staff-1", date),
    );

    const orgB = baseInput("org-b");
    orgB.assignments = orgA.assignments;

    orgA.ruleInstances = [
      ruleInstance("MAX_CONSECUTIVE_DAYS", { maxConsecutiveDays: 6, countOffAsBreak: true }),
    ];
    orgB.ruleInstances = [
      ruleInstance("MAX_CONSECUTIVE_DAYS", { maxConsecutiveDays: 3, countOffAsBreak: true }),
    ];

    const resultA = validateSchedule(orgA);
    const resultB = validateSchedule(orgB);

    expect(resultA.hardViolations.some((item) => item.code === "MAX_CONSECUTIVE_DAYS")).toBe(false);
    expect(resultB.hardViolations.some((item) => item.code === "MAX_CONSECUTIVE_DAYS")).toBe(true);
  });

  it("org สองแห่งใช้ OT_LIMIT คนละเพดาน", () => {
    const orgA = baseInput("org-a");
    const orgB = baseInput("org-b");
    const assignment = dayAssignment(orgA, "staff-1", "2026-03-01", "code-night");
    orgA.assignments = [assignment];
    orgB.assignments = [assignment];

    orgA.ruleInstances = [ruleInstance("OT_LIMIT", { maxOtHoursPerStaffPerCycle: 10 })];
    orgB.ruleInstances = [ruleInstance("OT_LIMIT", { maxOtHoursPerStaffPerCycle: 1 })];

    const resultA = validateSchedule(orgA);
    const resultB = validateSchedule(orgB);

    expect(resultA.hardViolations.some((item) => item.code === "OT_LIMIT")).toBe(false);
    expect(resultB.hardViolations.some((item) => item.code === "OT_LIMIT")).toBe(true);
  });
});

describe("rule templates — property", () => {
  it("collectStaffOffDates ไม่นับวันที่มี assignment ทำงาน", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), (workDays) => {
        const input = baseInput("org-prop");
        input.assignments = eachDateInRange("2026-03-01", "2026-03-07")
          .slice(0, workDays)
          .map((date) => dayAssignment(input, "staff-1", date));

        const context = buildValidationContext(input);
        const offDates = collectStaffOffDates(context, "staff-1");

        expect(offDates.size + workDays).toBeLessThanOrEqual(7);
      }),
    );
  });

  it("assignmentOtHours เป็นผลรวม planned + code OT", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 0, max: 10 }),
        (planned, codeOt) => {
          const input = baseInput("org-prop");
          input.shiftCodes = [makeShiftCode({ id: "code-ot", code: "OT_SHIFT", otHours: codeOt })];
          const assignment = {
            ...dayAssignment(input, "staff-1", "2026-03-01", "code-ot"),
            plannedOtHours: planned,
          };

          expect(
            assignmentOtHours(new Map(input.shiftCodes.map((code) => [code.id, code])), assignment),
          ).toBe(planned + codeOt);
        },
      ),
    );
  });
});
