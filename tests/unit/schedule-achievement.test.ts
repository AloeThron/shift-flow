import { describe, expect, it } from "vitest";

import { computeScheduleAchievementStatus } from "@/components/schedule/canvas/schedule-achievement";
import type { WorkloadStatsSnapshot } from "@/domain/optimize/fairness/workload-stats";
import type { FeasibilityIssue, ValidationResult } from "@/domain/schedule/types";

const emptyValidation: ValidationResult = {
  hardViolations: [],
  softViolations: [],
  isValid: true,
  softScore: 0,
};

const baseSnapshot: WorkloadStatsSnapshot = {
  asOfDate: "2026-08-01",
  fairnessLookbackMonths: ["2026-02", "2026-03"],
  fairParams: {
    dimension: "TOTAL_HOURS",
    toleranceHours: 4,
    lookbackMonths: 6,
    scope: "GROUP",
    normalizeByFte: true,
  },
  fairDimension: "TOTAL_HOURS",
  toleranceHours: 4,
  staffTrends: [],
  groupStats: [
    {
      groupKey: "g1",
      groupName: "กลุ่ม A",
      staffCount: 3,
      lookbackSpreads: {
        plannedHours: { min: 0, max: 0, mean: 0, spread: 0 },
        otHours: { min: 0, max: 0, mean: 0, spread: 0 },
        nightCount: { min: 0, max: 0, mean: 0, spread: 0 },
        weekendCount: { min: 0, max: 0, mean: 0, spread: 0 },
        holidayCount: { min: 0, max: 0, mean: 0, spread: 0 },
        workedDays: { min: 0, max: 0, mean: 0, spread: 0 },
        daysOff: { min: 0, max: 0, mean: 0, spread: 0 },
      },
      outOfTolerance: [],
    },
  ],
  carryOverOffsets: {},
};

describe("computeScheduleAchievementStatus", () => {
  it("ผ่านครบเมื่อไม่มี hard, coverage gap และ out-of-tolerance", () => {
    const status = computeScheduleAchievementStatus(emptyValidation, [], baseSnapshot);

    expect(status.isAchieved).toBe(true);
    expect(status.remainingIssueCount).toBe(0);
    expect(status.passesHard).toBe(true);
    expect(status.passesCoverage).toBe(true);
    expect(status.passesFairness).toBe(true);
  });

  it("ไม่บล็อกจาก soft violation", () => {
    const validation: ValidationResult = {
      hardViolations: [],
      softViolations: [
        {
          code: "SOFT_PREF",
          source: "RULE",
          messageTh: "soft",
          severity: "SOFT",
        },
      ],
      isValid: true,
      softScore: 1,
    };

    const status = computeScheduleAchievementStatus(validation, [], baseSnapshot);

    expect(status.isAchieved).toBe(true);
  });

  it("นับ hard violation และ coverage gap ใน remainingIssueCount", () => {
    const validation: ValidationResult = {
      hardViolations: [
        {
          code: "MAX_CONSEC",
          source: "RULE",
          messageTh: "hard",
          severity: "HARD",
        },
      ],
      softViolations: [],
      isValid: false,
      softScore: 0,
    };

    const coverageIssues: FeasibilityIssue[] = [
      {
        kind: "COVERAGE_GAP",
        messageTh: "gap",
        scheduleDate: "2026-08-05",
      },
    ];

    const status = computeScheduleAchievementStatus(validation, coverageIssues, baseSnapshot);

    expect(status.isAchieved).toBe(false);
    expect(status.remainingIssueCount).toBe(2);
    expect(status.hardViolationCount).toBe(1);
    expect(status.coverageGapCount).toBe(1);
  });

  it("บล็อกเมื่อมี out-of-tolerance ในกลุ่ม", () => {
    const snapshot: WorkloadStatsSnapshot = {
      ...baseSnapshot,
      groupStats: [
        {
          ...baseSnapshot.groupStats[0]!,
          outOfTolerance: [
            {
              staffId: "s1",
              staffCode: "001",
              displayName: "Staff 1",
              value: 10,
              groupMean: 4,
              deviation: 6,
            },
          ],
        },
      ],
    };

    const status = computeScheduleAchievementStatus(emptyValidation, [], snapshot);

    expect(status.isAchieved).toBe(false);
    expect(status.outOfToleranceCount).toBe(1);
    expect(status.remainingIssueCount).toBe(1);
  });
});
