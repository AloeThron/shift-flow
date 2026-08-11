import { describe, expect, it } from "vitest";

import type { DayOffPlanInput } from "@/domain/optimize/day-off";
import { planDayOff } from "@/domain/optimize/day-off";
import { resolveDayType } from "@/domain/schedule/time";
import type { RuleInstanceSnapshot } from "@/domain/schedule/types";

const OFF_KIND = "kind-off";

/** snapshot วันหยุดที่วางแผนสำหรับทดสอบ Stage A */
function plannedOffSnapshot(
  staffId: string,
  localDate: string,
  options: {
    locked?: boolean;
    blocksScheduling?: boolean;
    source?: "REQUEST" | "QUOTA" | "MANUAL";
  } = {},
) {
  return {
    staffId,
    localDate,
    nonWorkingDayKindId: OFF_KIND,
    blocksScheduling: options.blocksScheduling ?? true,
    ...(options.locked !== undefined ? { locked: options.locked } : {}),
    ...(options.source !== undefined ? { source: options.source } : {}),
  };
}

/** สร้าง rule instance สำหรับทดสอบ */
function ruleInstance(
  templateId: string,
  params: Record<string, unknown>,
  overrides: Partial<RuleInstanceSnapshot> = {},
): RuleInstanceSnapshot {
  return {
    id: `${templateId}-instance`,
    ruleTemplateId: templateId,
    params,
    severity: "HARD",
    weight: null,
    overrideClass: "APPROVER_REQUIRED",
    enabled: true,
    ...overrides,
  };
}

/** baseline input Stage A */
function baseInput(overrides: Partial<DayOffPlanInput> = {}): DayOffPlanInput {
  return {
    organizationId: "org-a",
    scheduleDraftId: "draft-a",
    cycleStartDate: "2026-03-01",
    cycleEndDate: "2026-03-07",
    holidayDates: ["2026-03-03"],
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
    ruleInstances: [
      ruleInstance("DAY_OFF_QUOTA", { daysOffPerCycle: 2 }),
      ruleInstance("MAX_STAFF_OFF_PER_DAY", { maxOffWeekday: 1, maxOffWeekend: 2, scope: "GROUP" }),
    ],
    nonWorkingDayKindId: OFF_KIND,
    plannedNonWorkingDays: [],
    dayOffRequests: [],
    historicalOffDates: [],
    ...overrides,
  };
}

/** นับวันหยุดต่อ staff จากผลลัพธ์ */
function offCountByStaff(
  rows: readonly { staffId: string; localDate: string }[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.staffId, (counts.get(row.staffId) ?? 0) + 1);
  }
  return counts;
}

/** จำนวนวันระหว่าง local date สองวัน */
function daysBetweenLocal(startDate: string, endDate: string): number {
  const startMs = Date.parse(`${startDate}T12:00:00Z`);
  const endMs = Date.parse(`${endDate}T12:00:00Z`);
  return Math.round((endMs - startMs) / 86_400_000);
}

/** วันหยุดติดกันสูงสุดของ staff หนึ่งคน */
function maxConsecutiveOffDays(
  staffId: string,
  rows: readonly { staffId: string; localDate: string }[],
): number {
  const dates = rows
    .filter((row) => row.staffId === staffId)
    .map((row) => row.localDate)
    .sort((left, right) => left.localeCompare(right));

  let maxRun = 0;
  let run = 0;
  let previous: string | null = null;

  for (const date of dates) {
    if (previous !== null && daysBetweenLocal(previous, date) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    maxRun = Math.max(maxRun, run);
    previous = date;
  }

  return maxRun;
}

/** สัดส่วนวันหยุดที่อยู่ในช่วงท้ายรอบ */
function tailOffRatio(rows: readonly { localDate: string }[], tailStartDate: string): number {
  if (rows.length === 0) {
    return 0;
  }
  const tailCount = rows.filter((row) => row.localDate >= tailStartDate).length;
  return tailCount / rows.length;
}

/** fixture รอบ 31 วัน — ใช้ regression clustering ก่อน/หลัง sequential spacing */
function spreadInput(overrides: Partial<DayOffPlanInput> = {}): DayOffPlanInput {
  const staff = Array.from({ length: 12 }, (_, index) => ({
    id: `staff-${String(index + 1).padStart(2, "0")}`,
    gradeId: "grade-a",
    staffGroupId: `group-${String(Math.floor(index / 4) + 1)}`,
    fte: 1,
    shiftAuthorizations: [],
  }));

  return baseInput({
    cycleStartDate: "2026-03-01",
    cycleEndDate: "2026-03-31",
    holidayDates: [],
    staff,
    ruleInstances: [
      ruleInstance("DAY_OFF_QUOTA", { daysOffPerCycle: 8 }),
      ruleInstance("MAX_STAFF_OFF_PER_DAY", { maxOffWeekday: 2, scope: "GROUP" }),
    ],
    ...overrides,
  });
}

describe("planDayOff — Stage A", () => {
  it("infeasible เมื่อไม่มี rule DAY_OFF_QUOTA", () => {
    const result = planDayOff(
      baseInput({
        ruleInstances: [ruleInstance("MAX_STAFF_OFF_PER_DAY", { maxOffWeekday: 1 })],
      }),
    );

    expect(result.feasible).toBe(false);
    expect(result.messageTh).toContain("DAY_OFF_QUOTA");
  });

  it("จัดวันหยุดครบโควตาและไม่เกินเพดานต่อวัน", () => {
    const result = planDayOff(baseInput());

    expect(result.feasible).toBe(true);
    expect(result.solverVersion).toBe("stage-a-sequential-spacing@1");

    const counts = offCountByStaff(result.plannedNonWorkingDays);
    expect(counts.get("staff-1")).toBe(2);
    expect(counts.get("staff-2")).toBe(2);
    expect(counts.get("staff-3")).toBe(2);

    const offByDate = new Map<string, number>();
    for (const row of result.plannedNonWorkingDays) {
      if (row.staffId === "staff-1" || row.staffId === "staff-2") {
        offByDate.set(row.localDate, (offByDate.get(row.localDate) ?? 0) + 1);
      }
    }

    for (const [date, count] of offByDate) {
      const dayType = resolveDayType(date, ["2026-03-03"]);
      if (dayType === "WEEKDAY" && date !== "2026-03-03") {
        expect(count).toBeLessThanOrEqual(1);
      }
    }
  });

  it("ให้วันที่ staff ขอ (REQUEST) เมื่อ feasible", () => {
    const result = planDayOff(
      baseInput({
        dayOffRequests: [{ staffId: "staff-1", localDate: "2026-03-02" }],
      }),
    );

    expect(result.feasible).toBe(true);
    expect(
      result.plannedNonWorkingDays.some(
        (row) =>
          row.staffId === "staff-1" && row.localDate === "2026-03-02" && row.source === "REQUEST",
      ),
    ).toBe(true);
  });

  it("คง locked planned และแทนที่ QUOTA unlocked ที่ไม่ล็อก", () => {
    const result = planDayOff(
      baseInput({
        plannedNonWorkingDays: [
          plannedOffSnapshot("staff-1", "2026-03-01", { source: "QUOTA" }),
          plannedOffSnapshot("staff-1", "2026-03-04", { locked: true }),
        ],
        ruleInstances: [
          ruleInstance("DAY_OFF_QUOTA", { daysOffPerCycle: 2 }),
          ruleInstance("MAX_STAFF_OFF_PER_DAY", { maxOffWeekday: 2, scope: "GROUP" }),
        ],
      }),
    );

    expect(result.feasible).toBe(true);
    expect(
      result.plannedNonWorkingDays.some(
        (row) => row.staffId === "staff-1" && row.localDate === "2026-03-04" && row.locked,
      ),
    ).toBe(true);
    expect(offCountByStaff(result.plannedNonWorkingDays).get("staff-1")).toBe(2);
    expect(
      result.plannedNonWorkingDays.filter(
        (row) => row.staffId === "staff-1" && row.source === "QUOTA",
      ),
    ).toHaveLength(1);
  });

  it("infeasible เมื่อวันหยุดคงที่เกินเพดานต่อวัน", () => {
    const result = planDayOff(
      baseInput({
        plannedNonWorkingDays: [
          plannedOffSnapshot("staff-1", "2026-03-02", { locked: true }),
          plannedOffSnapshot("staff-2", "2026-03-02", { locked: true }),
        ],
        ruleInstances: [
          ruleInstance("DAY_OFF_QUOTA", { daysOffPerCycle: 1 }),
          ruleInstance("MAX_STAFF_OFF_PER_DAY", { maxOffWeekday: 1, scope: "GROUP" }),
        ],
      }),
    );

    expect(result.feasible).toBe(false);
    expect(result.messageTh).toContain("2026-03-02");
  });

  it("deterministic — input เดิมได้ผลเดิม", () => {
    const input = baseInput({
      dayOffRequests: [{ staffId: "staff-2", localDate: "2026-03-05" }],
    });

    const first = planDayOff(input);
    const second = planDayOff(input);

    expect(first).toEqual(second);
  });

  it("กระจายวันหยุดในรอบ 31 วัน — ไม่ cluster ติดกันหรือท้ายเดือน", () => {
    const input = spreadInput();
    const result = planDayOff(input);

    const cycleDays = 31;
    const quota = 8;
    const idealGap = Math.max(1, Math.floor(cycleDays / quota));
    const maxAllowedConsecutive = idealGap + 1;

    expect(result.feasible).toBe(true);
    expect(result.solverVersion).toBe("stage-a-sequential-spacing@1");

    for (const member of input.staff) {
      expect(maxConsecutiveOffDays(member.id, result.plannedNonWorkingDays)).toBeLessThanOrEqual(
        maxAllowedConsecutive,
      );
    }

    expect(tailOffRatio(result.plannedNonWorkingDays, "2026-03-25")).toBeLessThanOrEqual(0.5);
  });

  it("แยกเพดานตามกลุ่ม — group-b ไม่โดนจำกัดของ group-a", () => {
    const result = planDayOff(
      baseInput({
        ruleInstances: [
          ruleInstance("DAY_OFF_QUOTA", { daysOffPerCycle: 1 }),
          ruleInstance("MAX_STAFF_OFF_PER_DAY", { maxOffWeekday: 1, scope: "GROUP" }),
        ],
        dayOffRequests: [
          { staffId: "staff-1", localDate: "2026-03-02" },
          { staffId: "staff-2", localDate: "2026-03-02" },
          { staffId: "staff-3", localDate: "2026-03-02" },
        ],
      }),
    );

    expect(result.feasible).toBe(true);
    expect(
      result.plannedNonWorkingDays.filter(
        (row) => row.localDate === "2026-03-02" && row.staffId !== "staff-3",
      ).length,
    ).toBeLessThanOrEqual(1);
    expect(
      result.plannedNonWorkingDays.some(
        (row) => row.staffId === "staff-3" && row.localDate === "2026-03-02",
      ),
    ).toBe(true);
  });

  it("คงวันหยุด MANUAL unlocked ที่ลงไว้ก่อน + เติม QUOTA ที่เหลือ", () => {
    const manualDates = ["2026-03-02", "2026-03-05", "2026-03-07"];
    const result = planDayOff(
      spreadInput({
        plannedNonWorkingDays: manualDates.map((localDate) =>
          plannedOffSnapshot("staff-01", localDate, { source: "MANUAL" }),
        ),
      }),
    );

    expect(result.feasible).toBe(true);
    expect(offCountByStaff(result.plannedNonWorkingDays).get("staff-01")).toBe(8);

    for (const localDate of manualDates) {
      expect(
        result.plannedNonWorkingDays.some(
          (row) =>
            row.staffId === "staff-01" &&
            row.localDate === localDate &&
            row.source === "MANUAL" &&
            !row.locked,
        ),
      ).toBe(true);
    }

    const quotaDays = result.plannedNonWorkingDays.filter(
      (row) => row.staffId === "staff-01" && row.source === "QUOTA",
    );
    expect(quotaDays).toHaveLength(5);
  });

  it("คงวันหยุด REQUEST unlocked ที่ลงไว้ก่อน", () => {
    const result = planDayOff(
      baseInput({
        plannedNonWorkingDays: [
          plannedOffSnapshot("staff-1", "2026-03-02", { source: "REQUEST" }),
        ],
        dayOffRequests: [{ staffId: "staff-1", localDate: "2026-03-02" }],
      }),
    );

    expect(result.feasible).toBe(true);
    expect(
      result.plannedNonWorkingDays.some(
        (row) =>
          row.staffId === "staff-1" &&
          row.localDate === "2026-03-02" &&
          row.source === "REQUEST" &&
          !row.locked,
      ),
    ).toBe(true);
    expect(offCountByStaff(result.plannedNonWorkingDays).get("staff-1")).toBe(2);
  });

  it("ใช้โควตาต่อคนจาก staffDayOffQuotas", () => {
    const result = planDayOff(
      baseInput({
        staffDayOffQuotas: {
          "staff-1": 1,
          "staff-2": 3,
          "staff-3": 0,
        },
      }),
    );

    expect(result.feasible).toBe(true);
    expect(offCountByStaff(result.plannedNonWorkingDays).get("staff-1")).toBe(1);
    expect(offCountByStaff(result.plannedNonWorkingDays).get("staff-2")).toBe(3);
    expect(
      result.plannedNonWorkingDays.filter((row) => row.staffId === "staff-3"),
    ).toHaveLength(0);
  });

  it("แทนที่ QUOTA unlocked จากรอบก่อนเมื่อ re-run เกลีย", () => {
    const clusteredQuota = ["2026-03-25", "2026-03-26", "2026-03-27", "2026-03-28"].map(
      (localDate) => plannedOffSnapshot("staff-01", localDate, { source: "QUOTA" }),
    );

    const result = planDayOff(
      spreadInput({
        staff: [
          {
            id: "staff-01",
            gradeId: "grade-a",
            staffGroupId: "group-1",
            fte: 1,
            shiftAuthorizations: [],
          },
        ],
        plannedNonWorkingDays: clusteredQuota,
      }),
    );

    expect(result.feasible).toBe(true);
    expect(offCountByStaff(result.plannedNonWorkingDays).get("staff-01")).toBe(8);
    expect(tailOffRatio(result.plannedNonWorkingDays, "2026-03-25")).toBeLessThanOrEqual(0.5);
    expect(
      result.plannedNonWorkingDays.every((row) => row.source === "QUOTA" && !row.locked),
    ).toBe(true);
  });
});
