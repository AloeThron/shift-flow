import { describe, expect, it } from "vitest";

import { buildAssignmentInterval } from "@/domain/schedule/time";
import type { ScheduleEngineInput } from "@/domain/schedule/types";
import { validateIncremental } from "@/domain/schedule/validate";
import {
  mergePlannedOffChanges,
  resolveBlockingNewHardViolations,
} from "@/lib/scheduling/apply-canvas-changes";

const TIMEZONE = "Asia/Bangkok";

/** baseline engine input สำหรับทดสอบ planned off */
function baseEngineInput(): ScheduleEngineInput {
  const dayInterval = buildAssignmentInterval(
    {
      startTime: "08:00",
      endTime: "16:00",
    },
    "2026-03-02",
    TIMEZONE,
  );

  return {
    organizationId: "org-a",
    timezone: TIMEZONE,
    cycleStartDate: "2026-03-01",
    cycleEndDate: "2026-03-31",
    assignments: [
      {
        id: "a1",
        staffId: "staff-1",
        shiftCodeId: "code-day",
        scheduleDate: "2026-03-02",
        startAt: dayInterval.startAt,
        endAt: dayInterval.endAt,
      },
    ],
    staff: [
      {
        id: "staff-1",
        gradeId: "grade-a",
        fte: 1,
        shiftAuthorizations: [],
      },
    ],
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
    shiftDemands: [],
    ruleInstances: [
      {
        id: "rule-quota",
        ruleTemplateId: "DAY_OFF_QUOTA",
        params: { daysOffPerCycle: 8 },
        severity: "HARD",
        weight: null,
        overrideClass: "NEVER",
        enabled: true,
      },
    ],
    plannedNonWorkingDays: [],
    holidayDates: [],
  };
}

describe("mergePlannedOffChanges", () => {
  it("ลบ assignment ในเซลล์เดียวกันเมื่อ set planned off ที่ blocksScheduling", () => {
    const merged = mergePlannedOffChanges(
      baseEngineInput(),
      [
        {
          staffProfileId: "staff-1",
          localDate: "2026-03-02",
          action: "set",
          nonWorkingDayKindId: "kind-off",
        },
      ],
      () => ({ blocksScheduling: true }),
      "kind-off",
    );

    expect(merged.assignments).toEqual([]);
    expect(merged.plannedNonWorkingDays).toHaveLength(1);
  });

  it("ไม่สร้าง APPROVED_LEAVE_BLOCK เมื่อลงวันหยุดทับเซลล์ที่มีเวร", () => {
    const base = baseEngineInput();
    const scope = {
      changedStaffIds: ["staff-1"],
      changedDates: ["2026-03-02"],
    };
    const before = validateIncremental(base, scope);
    const merged = mergePlannedOffChanges(
      base,
      [
        {
          staffProfileId: "staff-1",
          localDate: "2026-03-02",
          action: "set",
          nonWorkingDayKindId: "kind-off",
        },
      ],
      () => ({ blocksScheduling: true }),
      "kind-off",
    );
    const after = validateIncremental(merged, scope);

    const beforeKeys = new Set(
      before.hardViolations.map((violation) =>
        JSON.stringify({
          code: violation.code,
          staffId: violation.staffId ?? null,
          scheduleDate: violation.scheduleDate ?? null,
        }),
      ),
    );
    const newHard = after.hardViolations.filter(
      (violation) =>
        !beforeKeys.has(
          JSON.stringify({
            code: violation.code,
            staffId: violation.staffId ?? null,
            scheduleDate: violation.scheduleDate ?? null,
          }),
        ),
    );

    expect(newHard.some((violation) => violation.code === "APPROVED_LEAVE_BLOCK")).toBe(false);
  });
});

describe("resolveBlockingNewHardViolations", () => {
  const maxOffViolation = {
    code: "MAX_STAFF_OFF_PER_DAY" as const,
    source: "RULE" as const,
    messageTh: "วันที่ 2026-09-21 มีคนหยุด 4 คน เกินเพดาน 2 คน",
    severity: "HARD" as const,
    scheduleDate: "2026-09-21",
  };
  const leaveBlockViolation = {
    code: "APPROVED_LEAVE_BLOCK" as const,
    source: "INVARIANT" as const,
    messageTh: "จัดเวรทับวันหยุด/ลาที่วางแผนไว้",
    severity: "HARD" as const,
  };

  it("ยอม DAY_OFF_QUOTA และ MAX_STAFF_OFF_PER_DAY เมื่อ commit เฉพาะ planned off", () => {
    const blocked = resolveBlockingNewHardViolations([maxOffViolation, leaveBlockViolation], {
      cellChangeCount: 0,
      plannedOffChangeCount: 1,
      staffRowOrderCount: 0,
    });

    expect(blocked).toEqual([leaveBlockViolation]);
  });

  it("ยังบล็อก MAX_STAFF_OFF_PER_DAY เมื่อ commit ร่วมกับ cellChanges", () => {
    const blocked = resolveBlockingNewHardViolations([maxOffViolation], {
      cellChangeCount: 1,
      plannedOffChangeCount: 1,
      staffRowOrderCount: 0,
    });

    expect(blocked).toEqual([maxOffViolation]);
  });
});
