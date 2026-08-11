import { describe, expect, it } from "vitest";

import {
    buildStaffLabelMap,
    buildWorkAreaLabelMap,
    countUniqueCoverageGapDates,
    coverageGapSectionBadge,
    formatCoverageGapDisplay,
    formatScheduleDateLabel,
    formatViolationDetails,
    formatViolationMeta,
} from "@/components/schedule/canvas/status-issue-format";
import type { ScheduleCanvasGrid } from "@/domain/schedule/canvas-grid";
import type { ConstraintViolation, FeasibilityIssue } from "@/domain/schedule/types";

const sampleGrid: ScheduleCanvasGrid = {
  dates: ["2026-08-05"],
  holidayDates: [],
  rows: [
    {
      kind: "staff",
      row: {
        staffProfileId: "staff-1",
        staffCode: "001",
        staffName: "สมใจ ใจดี",
        staffGroupId: null,
        staffGroupSection: "RESULT_CAPABLE",
        rowOrder: 0,
        cells: [],
      },
    },
  ],
};

describe("status-issue-format", () => {
  it("buildStaffLabelMap สร้าง label จาก staffCode และชื่อ", () => {
    const map = buildStaffLabelMap(sampleGrid);
    expect(map.get("staff-1")).toBe("001 · สมใจ ใจดี");
  });

  it("buildWorkAreaLabelMap สร้าง label จาก code และ displayName", () => {
    const map = buildWorkAreaLabelMap([{ id: "wa-1", code: "LAB", displayName: "ห้องแล็บ" }]);
    expect(map.get("wa-1")).toBe("LAB · ห้องแล็บ");
  });

  it("formatScheduleDateLabel จัดรูปวันที่", () => {
    const label = formatScheduleDateLabel("2026-08-05");
    expect(label).toContain("ส.ค.");
  });

  it("formatViolationDetails สรุป MIN_REST_BETWEEN_SHIFTS", () => {
    const details = formatViolationDetails("MIN_REST_BETWEEN_SHIFTS", {
      restHours: 8,
      minRestHours: 11,
    });
    expect(details).toContain("8.0/11");
  });

  it("formatViolationMeta รวม staff label และวันที่", () => {
    const violation: ConstraintViolation = {
      code: "MAX_CONSECUTIVE_DAYS",
      source: "RULE",
      severity: "HARD",
      messageTh: "ทำงานติดกันเกิน",
      staffId: "staff-1",
      scheduleDate: "2026-08-05",
    };

    const meta = formatViolationMeta(violation, buildStaffLabelMap(sampleGrid), new Map());

    expect(meta).toContain("001 · สมใจ ใจดี");
    expect(meta).toContain("ส.ค.");
  });

  it("formatCoverageGapDisplay สำหรับ MISSING_SHIFT_AUTH แนะนำไปตั้งสิทธิที่หน้าบุคลากร", () => {
    const issue: FeasibilityIssue = {
      kind: "MISSING_SHIFT_AUTH",
      messageTh: "ไม่มี staff ที่มีสิทธิรหัสเวรนี้และว่างในช่วงนี้",
      scheduleDate: "2026-08-05",
      shiftCodeId: "code-mi",
      departmentId: "wa-1",
    };

    const display = formatCoverageGapDisplay(
      issue,
      buildWorkAreaLabelMap([{ id: "wa-1", code: "LAB", displayName: "ห้องแล็บ" }]),
      new Map([["code-mi", "MI20"]]),
    );

    expect(display.meta).toContain("การตั้งค่า → บุคลากร");
    expect(display.meta).toContain("เว้นวันหมดอายุ");
  });

  it("formatCoverageGapDisplay แยก work area และช่วงเวลา", () => {
    const issue: FeasibilityIssue = {
      kind: "COVERAGE_GAP",
      messageTh: "coverage ขาด 1 คน",
      scheduleDate: "2026-08-05",
      departmentId: "wa-1",
      startTime: "08:00",
      endTime: "16:00",
      requiredCount: 2,
      matchedCount: 1,
      shortfallCount: 1,
      staffIds: ["s1", "s2"],
    };

    const display = formatCoverageGapDisplay(
      issue,
      buildWorkAreaLabelMap([{ id: "wa-1", code: "LAB", displayName: "ห้องแล็บ" }]),
    );

    expect(display.headline).toContain("LAB · ห้องแล็บ");
    expect(display.headline).toContain("08:00–16:00");
    expect(display.meta).toContain("ต้องการ 2");
    expect(display.meta).toContain("จัดแล้ว 1");
    expect(display.meta).toContain("ว่างที่อาจเติม 2");
  });

  it("countUniqueCoverageGapDates นับวันไม่ซ้ำ", () => {
    const issues: FeasibilityIssue[] = [
      { kind: "COVERAGE_GAP", messageTh: "a", scheduleDate: "2026-08-05" },
      { kind: "COVERAGE_GAP", messageTh: "b", scheduleDate: "2026-08-05" },
      { kind: "COVERAGE_GAP", messageTh: "c", scheduleDate: "2026-08-06" },
    ];

    expect(countUniqueCoverageGapDates(issues)).toBe(2);
    expect(coverageGapSectionBadge(issues)).toEqual({
      gapCount: 3,
      uniqueDateCount: 2,
    });
  });
});
