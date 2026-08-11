import { describe, expect, it } from "vitest";

import type { BalancePlanInput } from "@/domain/optimize/balance";
import {
    buildBalanceSlots,
    buildFillPools,
    solveBalance,
} from "@/domain/optimize/balance";
import { runLagrangianBalance } from "@/domain/optimize/lagrangian";
import { solveSchedule } from "@/domain/schedule";
import type {
    RuleInstanceSnapshot,
    ScheduleSlot,
    ShiftCodeSnapshot,
} from "@/domain/schedule/types";
import { loadStarterPack } from "@/domain/starter-pack/load-pack";

const TIMEZONE = "Asia/Bangkok";
const OFF_KIND = "kind-off";

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

/** สร้าง shift code สำหรับทดสอบ */
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

/** rule instance สำหรับทดสอบ */
function ruleInstance(
  templateId: string,
  params: Record<string, unknown>,
  severity: "HARD" | "SOFT" = "HARD",
): RuleInstanceSnapshot {
  return {
    id: `rule-${templateId}`,
    ruleTemplateId: templateId,
    params,
    severity,
    weight: severity === "SOFT" ? 1 : null,
    overrideClass: "NEVER",
    enabled: true,
  };
}

/** baseline input Stage B */
function baseBalanceInput(
  slots: ScheduleSlot[],
  overrides: Partial<BalancePlanInput> = {},
): BalancePlanInput {
  return {
    organizationId: "org-a",
    timezone: TIMEZONE,
    cycleStartDate: "2026-03-01",
    cycleEndDate: "2026-03-03",
    assignments: [],
    staff: [
      {
        id: "staff-1",
        gradeId: "grade-a",
        staffGroupId: "group-a",
        fte: 1,
        shiftAuthorizations: [...coversAllShiftAuth()],
      },
      {
        id: "staff-2",
        gradeId: "grade-a",
        staffGroupId: "group-a",
        fte: 1,
        shiftAuthorizations: [...coversAllShiftAuth()],
      },
    ],
    shiftCodes: [
      makeShiftCode({ id: "code-day", code: "DAY" }),
      makeShiftCode({ id: "code-ot", code: "OT-DAY", otHours: 2, standardHours: 10 }),
      makeShiftCode({ id: "code-open", code: "OPEN" }),
    ],
    shiftDemands: [],
    ruleInstances: [
      ruleInstance(
        "FAIR_DISTRIBUTION",
        {
          dimension: "TOTAL_HOURS",
          scope: "GROUP",
          toleranceHours: 4,
          lookbackMonths: 6,
        },
        "SOFT",
      ),
    ],
    plannedNonWorkingDays: [],
    holidayDates: [],
    slots,
    fillEveryAvailableCell: true,
    ...overrides,
  };
}

describe("buildBalanceSlots — slot kinds", () => {
  it("demand slot ของรหัสที่มี otHours ยังเป็น MANDATORY", () => {
    const slots: ScheduleSlot[] = [
      { id: "slot-ot-demand", scheduleDate: "2026-03-01", shiftCodeId: "code-ot" },
    ];
    const built = buildBalanceSlots(baseBalanceInput(slots));

    expect(built.some((slot) => slot.id === "slot-ot-demand" && slot.kind === "MANDATORY")).toBe(
      true,
    );
    expect(built.every((slot) => slot.kind === "MANDATORY")).toBe(true);
  });

  it("สร้าง fill pool ต่อวันสำหรับคนที่ยังไม่มีเวร", () => {
    const input = baseBalanceInput([
      { id: "slot-1", scheduleDate: "2026-03-01", shiftCodeId: "code-day" },
    ]);
    const mandatory = buildBalanceSlots(input);
    const fillPools = buildFillPools(input, mandatory);
    const fillOnDayOne = fillPools.filter((pool) => pool.scheduleDate === "2026-03-01");

    expect(fillOnDayOne).toHaveLength(1);
    expect(fillOnDayOne[0]?.count).toBe(1);
  });
});

describe("ShiftCodeDemand — โหมด FILL", () => {
  it("starter pack มี demand แต่ unit test ว่าง shiftDemands → Stage B เป็น FILL ทั้งรอบ", () => {
    const pack = loadStarterPack("pilot-lab-example");
    expect(pack.shiftDemands.length).toBeGreaterThan(0);

    const fillOnlyInput = baseBalanceInput([]);
    expect(fillOnlyInput.shiftDemands).toHaveLength(0);
    expect(buildBalanceSlots(fillOnlyInput)).toHaveLength(0);

    const fillPools = buildFillPools(fillOnlyInput);
    expect(fillPools.reduce((sum, pool) => sum + pool.count, 0)).toBeGreaterThan(0);
  });
});

describe("solveBalance — Stage B", () => {
  it("เติม slot บังคับครบและ deterministic", () => {
    const slots: ScheduleSlot[] = [
      { id: "slot-1", scheduleDate: "2026-03-01", shiftCodeId: "code-day" },
      { id: "slot-2", scheduleDate: "2026-03-02", shiftCodeId: "code-day" },
    ];
    const input = baseBalanceInput(slots);

    const first = solveBalance(input);
    const second = solveBalance(input);

    expect(first.feasible).toBe(true);
    expect(first.solverVersion).toBe("stage-b-min-cost-flow@1");
    expect(first.unfilledMandatorySlotIds).toHaveLength(0);
    expect(first.assignments.map((item) => `${item.staffId}:${item.scheduleDate}`)).toEqual(
      second.assignments.map((item) => `${item.staffId}:${item.scheduleDate}`),
    );
  });

  it("เติมเวรให้ทุกคนที่ไม่ได้หยุดเมื่อเปิด fillEveryAvailableCell", () => {
    const input = baseBalanceInput([]);
    const result = solveBalance(input);

    expect(result.feasible).toBe(true);
    const workingDays = 3;
    expect(result.assignments).toHaveLength(2 * workingDays);
    expect(result.filledCellCount).toBe(2 * workingDays);
  });

  it("ไม่มีใครได้สองเวรในวันเดียว", () => {
    const input = baseBalanceInput([
      { id: "slot-1", scheduleDate: "2026-03-01", shiftCodeId: "code-day" },
    ]);
    const result = solveBalance(input);

    const byStaffDay = new Map<string, number>();
    for (const assignment of result.assignments) {
      const key = `${assignment.staffId}:${assignment.scheduleDate}`;
      byStaffDay.set(key, (byStaffDay.get(key) ?? 0) + 1);
    }

    expect([...byStaffDay.values()].every((count) => count === 1)).toBe(true);
  });

  it("รหัสที่บังคับสิทธิ — staff ที่มี auth ได้ mandatory, staff อื่นได้ fill", () => {
    const input = baseBalanceInput(
      [{ id: "slot-mi", scheduleDate: "2026-03-01", shiftCodeId: "code-mi" }],
      {
        shiftCodes: [
          makeShiftCode({ id: "code-mi", code: "MI" }),
          makeShiftCode({ id: "code-open", code: "OPEN" }),
        ],
        staff: [
          {
            id: "staff-auth",
            gradeId: "grade-a",
            fte: 1,
            shiftAuthorizations: [
              {
                shiftCodeId: "code-mi",
                validFrom: "2026-01-01",
                validTo: "2026-12-31",
              },
            ],
          },
          {
            id: "staff-no-auth",
            gradeId: "grade-a",
            fte: 1,
            shiftAuthorizations: [
              {
                shiftCodeId: "code-open",
                validFrom: "2026-01-01",
                validTo: null,
              },
            ],
          },
        ],
        fillEveryAvailableCell: true,
      },
    );

    const result = solveBalance(input);
    const mandatoryAssignment = result.assignments.find(
      (item) => item.scheduleDate === "2026-03-01" && item.shiftCodeId === "code-mi",
    );
    const fillAssignment = result.assignments.find(
      (item) => item.scheduleDate === "2026-03-01" && item.shiftCodeId === "code-open",
    );

    expect(mandatoryAssignment?.staffId).toBe("staff-auth");
    expect(fillAssignment?.staffId).toBe("staff-no-auth");
  });

  it("ไม่ throw เมื่อไม่มีคน eligible สำหรับ mandatory และยังเติม fill ได้", () => {
    const input = baseBalanceInput(
      [
        {
          id: "slot-mi",
          scheduleDate: "2026-03-01",
          shiftCodeId: "code-mi",
        },
      ],
      {
        shiftCodes: [
          makeShiftCode({ id: "code-mi", code: "MI" }),
          makeShiftCode({ id: "code-open", code: "OPEN" }),
        ],
        staff: [
          {
            id: "staff-1",
            gradeId: "grade-a",
            fte: 1,
            shiftAuthorizations: [
              {
                shiftCodeId: "code-open",
                validFrom: "2026-01-01",
                validTo: null,
              },
            ],
          },
        ],
        fillEveryAvailableCell: true,
      },
    );

    const result = solveBalance(input);
    expect(result.unfilledMandatorySlotIds).toEqual(["slot-mi"]);
    expect(result.filledCellCount).toBeGreaterThan(0);
    expect(result.messageTh).toMatch(/slot บังคับไม่ครบ 1 ช่อง/);
  });

  it("ไม่ throw เมื่อ mandatory ไม่มีคน eligible และปิด fill", () => {
    const input = baseBalanceInput(
      [{ id: "slot-1", scheduleDate: "2026-03-01", shiftCodeId: "code-day" }],
      {
        staff: [
          {
            id: "staff-off",
            gradeId: "grade-a",
            fte: 1,
            shiftAuthorizations: [],
          },
        ],
        plannedNonWorkingDays: [
          {
            staffId: "staff-off",
            localDate: "2026-03-01",
            nonWorkingDayKindId: OFF_KIND,
            blocksScheduling: true,
            locked: false,
          },
          {
            staffId: "staff-off",
            localDate: "2026-03-02",
            nonWorkingDayKindId: OFF_KIND,
            blocksScheduling: true,
            locked: false,
          },
          {
            staffId: "staff-off",
            localDate: "2026-03-03",
            nonWorkingDayKindId: OFF_KIND,
            blocksScheduling: true,
            locked: false,
          },
        ],
        fillEveryAvailableCell: false,
      },
    );

    expect(() => solveBalance(input)).not.toThrow();
    const result = solveBalance(input);
    expect(result.unfilledMandatorySlotIds).toContain("slot-1");
  });

  it("ไม่แตะ assignment ที่ pin", () => {
    const slots: ScheduleSlot[] = [
      { id: "slot-1", scheduleDate: "2026-03-02", shiftCodeId: "code-day" },
    ];
    const day = makeShiftCode({ id: "code-day", code: "DAY" });
    const input = baseBalanceInput(slots, {
      shiftCodes: [day, makeShiftCode({ id: "code-open", code: "OPEN" })],
      assignments: [
        {
          id: "pinned-1",
          staffId: "staff-1",
          shiftCodeId: "code-day",
          scheduleDate: "2026-03-01",
          startAt: "2026-02-28T01:00:00.000Z",
          endAt: "2026-02-28T09:00:00.000Z",
          isPinned: true,
        },
      ],
    });

    const result = solveBalance(input);
    expect(result.assignments.some((item) => item.id === "pinned-1")).toBe(true);
  });

  it("กระจายรหัสเวร fill ไม่ผูกกับ staff id ต่ำสุดเสมอ", () => {
    const input = baseBalanceInput([], {
      staff: [
        {
          id: "staff-a",
          gradeId: "grade-a",
          staffGroupId: "group-a",
          fte: 1,
          shiftAuthorizations: [...coversAllShiftAuth()],
        },
        {
          id: "staff-z",
          gradeId: "grade-a",
          staffGroupId: "group-a",
          fte: 1,
          shiftAuthorizations: [...coversAllShiftAuth()],
        },
      ],
      shiftCodes: [
        makeShiftCode({ id: "code-alpha", code: "ALPHA" }),
        makeShiftCode({ id: "code-beta", code: "BETA" }),
      ],
      cycleStartDate: "2026-03-01",
      cycleEndDate: "2026-03-02",
    });

    const result = solveBalance(input);
    const distinctCodes = new Set(result.assignments.map((item) => item.shiftCodeId));

    expect(distinctCodes.size).toBeGreaterThan(1);
    expect(result.assignments.some((item) => item.staffId === "staff-z")).toBe(true);
  });

  it("จำนวนเวรต่อคนแตกต่างกันไม่เกิน tolerance (หน่วยเวร)", () => {
    const input = baseBalanceInput([], {
      cycleStartDate: "2026-03-01",
      cycleEndDate: "2026-03-07",
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
          staffGroupId: "group-a",
          fte: 1,
          shiftAuthorizations: [],
        },
      ],
      shiftCodes: [makeShiftCode({ id: "code-day", code: "DAY" })],
      ruleInstances: [
        ruleInstance(
          "FAIR_DISTRIBUTION",
          {
            dimension: "TOTAL_HOURS",
            scope: "GROUP",
            toleranceHours: 8,
            lookbackMonths: 6,
          },
          "SOFT",
        ),
      ],
    });

    const result = solveBalance(input);
    const shiftCounts = input.staff.map(
      (member) => result.assignments.filter((item) => item.staffId === member.id).length,
    );
    const spread = Math.max(...shiftCounts) - Math.min(...shiftCounts);

    expect(spread).toBeLessThanOrEqual(1);
  });

  it("เคารพ plannedNonWorkingDay ที่ locked", () => {
    const slots: ScheduleSlot[] = [
      { id: "slot-1", scheduleDate: "2026-03-01", shiftCodeId: "code-day" },
    ];
    const input = baseBalanceInput(slots, {
      plannedNonWorkingDays: [
        {
          staffId: "staff-1",
          localDate: "2026-03-01",
          nonWorkingDayKindId: OFF_KIND,
          blocksScheduling: true,
          locked: true,
        },
      ],
    });

    const result = solveBalance(input);
    expect(
      result.assignments.some(
        (item) => item.staffId === "staff-1" && item.scheduleDate === "2026-03-01",
      ),
    ).toBe(false);
  });
});

describe("buildFillPools", () => {
  it("ไม่สร้าง fill pool เมื่อปิด fillEveryAvailableCell", () => {
    const mandatory = buildBalanceSlots(baseBalanceInput([]));
    const fill = buildFillPools(baseBalanceInput([], { fillEveryAvailableCell: false }), mandatory);
    expect(fill).toHaveLength(0);
  });
});

describe("runLagrangianBalance", () => {
  it("คืนผลพร้อม local search iterations", () => {
    const slots: ScheduleSlot[] = [
      { id: "slot-1", scheduleDate: "2026-03-01", shiftCodeId: "code-day" },
    ];
    const result = runLagrangianBalance(baseBalanceInput(slots));

    expect(result.assignments.length).toBeGreaterThanOrEqual(1);
    expect(result.localSearchIterations).toBeGreaterThanOrEqual(0);
  });
});

describe("solveSchedule — pipeline ใหม่", () => {
  it("seed เดิมให้ผล assignment เดิม (deterministic ไม่พึ่ง seed)", () => {
    const slots: ScheduleSlot[] = [
      { id: "slot-1", scheduleDate: "2026-03-01", shiftCodeId: "code-day" },
      { id: "slot-2", scheduleDate: "2026-03-02", shiftCodeId: "code-day" },
    ];
    const input = baseBalanceInput(slots, {
      ruleInstances: [
        ruleInstance("MIN_REST_BETWEEN_SHIFTS", { minRestHours: 8 }),
        ruleInstance("GRADE_CODE_WHITELIST", { enforceFromShiftCodes: true }),
      ],
    });

    const first = solveSchedule({ ...input, randomSeed: "seed-alpha" });
    const second = solveSchedule({ ...input, randomSeed: "seed-beta" });

    expect(first.solverVersion).toBe("stage-b-min-cost-flow@1");
    expect(first.assignments.map((item) => `${item.staffId}:${item.scheduleDate}`)).toEqual(
      second.assignments.map((item) => `${item.staffId}:${item.scheduleDate}`),
    );
  });
});
