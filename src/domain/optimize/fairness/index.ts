export {
  buildStaffConvexLadder,
  buildStaffShiftLadder,
  computeStaffHourOffset,
  type FairDistributionParams,
  resolveFairDistributionParams,
} from "@/domain/optimize/fairness/carry-over";
export {
  buildFairnessSnapshot,
  computeGini,
  computeGroupFairnessReports,
  computeGroupFairnessSpread,
  computeSpread,
  type FairnessSnapshot,
  type GroupFairnessReport,
  type GroupFairnessSnapshotEntry,
  roundFairnessMetric,
  type SpreadSummary,
} from "@/domain/optimize/fairness/metrics";
export {
  buildValidationScheduleInput,
  loadValidationRosterRows,
  loadValidationStaffRows,
} from "@/domain/optimize/fairness/validation-roster";
export {
  aggregateStaffWorkloadMonthly,
  collectYearMonthsFromInput,
  computeStaffWorkloadMonthlyForMonth,
  resolveOffShiftCode,
  type WorkloadMonthlyInput,
} from "@/domain/optimize/fairness/workload-monthly";
export {
  backfillWorkloadMonthlyFromAssignments,
  buildWorkloadStatsSnapshot,
  type CurrentCycleContext,
  formatWorkloadStatsCsv,
  type GroupMetricSpread,
  type GroupWorkloadStats,
  type OutOfToleranceStaff,
  recomputeWorkloadStatsFromDraft,
  type StaffDisplayMeta,
  type StaffGroupLabel,
  type StaffWorkloadMonthRow,
  type StaffWorkloadTrend,
  type WorkloadMetrics,
  type WorkloadStatsInput,
  type WorkloadStatsSnapshot,
  workloadLookbackMonthsFromCycle,
} from "@/domain/optimize/fairness/workload-stats";
