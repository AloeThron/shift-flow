import type { WorkloadStatsSnapshot } from "@/domain/optimize/fairness/workload-stats";
import type { FeasibilityIssue, ValidationResult } from "@/domain/schedule/types";

import { filterCoverageGapIssues } from "./coverage-gap-panel";
import { countOutOfToleranceStaff } from "./workload-summary-panel";

/** สถานะบรรลุเกณฑ์พร้อมเผยแพร่ */
export type ScheduleAchievementStatus = {
  readonly isAchieved: boolean;
  readonly hardViolationCount: number;
  readonly coverageGapCount: number;
  readonly outOfToleranceCount: number;
  readonly remainingIssueCount: number;
  readonly passesHard: boolean;
  readonly passesCoverage: boolean;
  readonly passesFairness: boolean;
};

/** คำนวณเกณฑ์บรรลุจาก validation, coverage และ fairness */
export function computeScheduleAchievementStatus(
  validation: ValidationResult,
  coverageIssues: readonly FeasibilityIssue[],
  workloadSnapshot: WorkloadStatsSnapshot | null,
): ScheduleAchievementStatus {
  const hardViolationCount = validation.hardViolations.length;
  const coverageGapCount = filterCoverageGapIssues(coverageIssues).length;
  const outOfToleranceCount =
    workloadSnapshot?.fairParams && workloadSnapshot.groupStats.length > 0
      ? countOutOfToleranceStaff(workloadSnapshot)
      : 0;

  const passesHard = hardViolationCount === 0;
  const passesCoverage = coverageGapCount === 0;
  const passesFairness =
    !workloadSnapshot?.fairParams || workloadSnapshot.groupStats.length === 0
      ? true
      : outOfToleranceCount === 0;

  const remainingIssueCount =
    hardViolationCount +
    coverageGapCount +
    (workloadSnapshot?.fairParams && workloadSnapshot.groupStats.length > 0
      ? outOfToleranceCount
      : 0);

  return {
    isAchieved: passesHard && passesCoverage && passesFairness,
    hardViolationCount,
    coverageGapCount,
    outOfToleranceCount,
    remainingIssueCount,
    passesHard,
    passesCoverage,
    passesFairness,
  };
}
