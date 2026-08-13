import { describe, expect, it } from "vitest";

import { buildScheduleCanvasGrid } from "@/domain/schedule/canvas-grid";
import type { ScheduleEngineInput } from "@/domain/schedule/types";
import {
  type IncrementalValidationScope,
  validateIncremental,
  validateSchedule,
} from "@/domain/schedule/validate";

const TIMEZONE = "Asia/Bangkok";

/** baseline input ว่าง */
function baseInput(): ScheduleEngineInput {
  return {
    organizationId: "org-1",
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
        shiftAuthorizations: [],
      },
    ],
    shiftCodes: [
      {
        id: "shift-a",
        code: "D8",
        startTime: "08:00",
        endTime: "16:00",
        standardHours: 8,
        allowedGradeIds: ["grade-a"],
        needsConfirmation: false,
        active: true,
      },
    ],
    shiftDemands: [],
    ruleInstances: [],
    plannedNonWorkingDays: [],
    holidayDates: [],
  };
}

describe("validateIncremental", () => {
  it("คืน isValid เท่ากับ validateSchedule เต็ม", () => {
    const input = baseInput();
    const full = validateSchedule(input);
    const incremental = validateIncremental(input, {
      changedStaffIds: ["staff-1"],
      changedDates: ["2026-03-01"],
    });

    expect(incremental.isValid).toBe(full.isValid);
    expect(incremental.softScore).toBe(full.softScore);
  });

  it("กรอง violation ให้เหลือเฉพาะ staff/วันที่ใน scope", () => {
    const input: ScheduleEngineInput = {
      ...baseInput(),
      assignments: [
        {
          id: "a1",
          staffId: "staff-1",
          shiftCodeId: "shift-a",
          scheduleDate: "2026-03-01",
          startAt: "2026-03-01T01:00:00.000Z",
          endAt: "2026-03-01T09:00:00.000Z",
        },
        {
          id: "a2",
          staffId: "staff-1",
          shiftCodeId: "shift-a",
          scheduleDate: "2026-03-01",
          startAt: "2026-03-01T02:00:00.000Z",
          endAt: "2026-03-01T10:00:00.000Z",
        },
      ],
    };

    const scope: IncrementalValidationScope = {
      changedStaffIds: ["staff-1"],
      changedDates: ["2026-03-01"],
    };

    const incremental = validateIncremental(input, scope);
    expect(incremental.hardViolations.length).toBeGreaterThan(0);
    expect(
      incremental.hardViolations.every(
        (item) =>
          !item.staffId ||
          item.staffId === "staff-1" ||
          !item.scheduleDate ||
          item.scheduleDate === "2026-03-01",
      ),
    ).toBe(true);
  });

  it("เก็บ global violation ที่ไม่มี staffId/scheduleDate", () => {
    const input = baseInput();
    const incremental = validateIncremental(input, {
      changedStaffIds: [],
      changedDates: [],
    });

    expect(incremental.hardViolations).toEqual([]);
  });
});

describe("buildScheduleCanvasGrid", () => {
  it("จัดกลุ่ม staff ตาม StaffGroup, section และ rowOrder", () => {
    const grid = buildScheduleCanvasGrid({
      periodStart: "2026-03-01",
      periodEnd: "2026-03-02",
      holidayDates: [],
      staffGroups: [{ id: "group-a", code: "A", displayName: "กลุ่ม A", sortOrder: 0 }],
      staff: [
        {
          id: "s2",
          staffCode: "B002",
          displayName: "คนสอง",
          staffGroupId: "group-a",
          staffGroupSection: "RESULT_CAPABLE",
          rowOrder: 1,
        },
        {
          id: "s3",
          staffCode: "C001",
          displayName: "พาร์ตไทม์",
          staffGroupId: "group-a",
          staffGroupSection: "PART_TIME",
          rowOrder: 0,
        },
        {
          id: "s1",
          staffCode: "B001",
          displayName: "คนหนึ่ง",
          staffGroupId: "group-a",
          staffGroupSection: "RESULT_CAPABLE",
          rowOrder: 0,
        },
      ],
      assignments: [],
      plannedOff: [],
    });

    const staffRows = grid.rows.filter((row) => row.kind === "staff");
    expect(staffRows).toHaveLength(3);
    expect(staffRows[0]?.kind === "staff" ? staffRows[0].row.staffCode : "").toBe("B001");
    expect(staffRows[1]?.kind === "staff" ? staffRows[1].row.staffCode : "").toBe("B002");
    expect(staffRows[2]?.kind === "staff" ? staffRows[2].row.staffCode : "").toBe("C001");
    expect(grid.rows.some((row) => row.kind === "group" && row.displayName === "กลุ่ม A")).toBe(true);
  });

  it("แสดงหัว section ครบ 3 แม้ไม่มีสมาชิกในกลุ่ม", () => {
    const grid = buildScheduleCanvasGrid({
      periodStart: "2026-03-01",
      periodEnd: "2026-03-01",
      holidayDates: [],
      staffGroups: [{ id: "group-a", code: "A", displayName: "กลุ่ม A", sortOrder: 0 }],
      staff: [],
      assignments: [],
      plannedOff: [],
    });

    const sections = grid.rows.filter((row) => row.kind === "section");
    expect(sections).toHaveLength(3);
    expect(sections.map((row) => (row.kind === "section" ? row.section : ""))).toEqual([
      "RESULT_CAPABLE",
      "RESULT_NOT_CAPABLE",
      "PART_TIME",
    ]);
    expect(sections.every((row) => row.kind === "section" && row.isEmpty)).toBe(true);
  });

  it("ตั้ง isEmpty=false เมื่อหมวดมีสมาชิก", () => {
    const grid = buildScheduleCanvasGrid({
      periodStart: "2026-03-01",
      periodEnd: "2026-03-01",
      holidayDates: [],
      staffGroups: [{ id: "group-a", code: "A", displayName: "กลุ่ม A", sortOrder: 0 }],
      staff: [
        {
          id: "s1",
          staffCode: "B001",
          displayName: "คนหนึ่ง",
          staffGroupId: "group-a",
          staffGroupSection: "RESULT_CAPABLE",
          rowOrder: 0,
        },
      ],
      assignments: [],
      plannedOff: [],
    });

    const sections = grid.rows.filter((row) => row.kind === "section");
    expect(
      sections.find((row) => row.kind === "section" && row.section === "RESULT_CAPABLE")?.isEmpty,
    ).toBe(false);
    expect(
      sections.find((row) => row.kind === "section" && row.section === "RESULT_NOT_CAPABLE")
        ?.isEmpty,
    ).toBe(true);
  });

  it("แสดง planned off และ assignment ในเซลล์เดียวกัน", () => {
    const grid = buildScheduleCanvasGrid({
      periodStart: "2026-03-01",
      periodEnd: "2026-03-01",
      holidayDates: ["2026-03-01"],
      staffGroups: [],
      staff: [
        {
          id: "s1",
          staffCode: "B001",
          displayName: "คนหนึ่ง",
          staffGroupId: null,
          staffGroupSection: "RESULT_CAPABLE",
          rowOrder: 0,
        },
      ],
      assignments: [
        {
          id: "a1",
          staffProfileId: "s1",
          localDate: "2026-03-01",
          shiftCodeId: "shift-1",
          shiftCode: "D8",
          isPinned: true,
          plannedOtHours: 0,
        },
      ],
      plannedOff: [
        {
          staffProfileId: "s1",
          localDate: "2026-03-01",
          locked: true,
          kindCode: "OFF",
        },
      ],
    });

    const staffRow = grid.rows.find((row) => row.kind === "staff");
    expect(staffRow?.kind).toBe("staff");
    if (staffRow?.kind === "staff") {
      const cell = staffRow.row.cells[0];
      expect(cell?.isPlannedOff).toBe(true);
      expect(cell?.plannedOffLocked).toBe(true);
      expect(cell?.isPinned).toBe(true);
      expect(cell?.shiftCode).toBe("D8");
    }
  });
});
