export {
    buildScheduleCanvasGrid,
    canvasStaffRows,
    STAFF_GROUP_SECTION_LABELS,
    STAFF_GROUP_SECTION_ORDER
} from "@/domain/schedule/canvas-grid";
export type {
    CanvasAssignmentInput,
    CanvasPlannedOffInput,
    CanvasStaffGroupInput,
    CanvasStaffInput,
    ScheduleCanvasCell,
    ScheduleCanvasGrid,
    ScheduleCanvasGroupHeader,
    ScheduleCanvasRow,
    ScheduleCanvasSectionHeader,
    ScheduleCanvasStaffEntry,
    ScheduleCanvasStaffRow,
    StaffGroupSection
} from "@/domain/schedule/canvas-grid";
export {
    computeCanvasCellHours,
    computeCanvasStaffRowTotals,
    hasCellOt
} from "@/domain/schedule/canvas-hours";
export type {
    CanvasCellHours,
    CanvasShiftHoursMeta,
    CanvasStaffRowTotals
} from "@/domain/schedule/canvas-hours";
export {
    isValidDayOffQuotaValue,
    mergeStaffDayOffQuotas,
    resolveDefaultDayOffQuota,
    serializeStaffDayOffQuotas,
    staffDayOffQuotaMapFromRecord,
    staffDayOffQuotasForSolver,
    validateStaffDayOffQuotasComplete
} from "@/domain/schedule/day-off-quota-draft";
export type { SavedStaffDayOffQuotaRow, StaffDayOffQuotaByStaffId, StaffDayOffQuotaValidation } from "@/domain/schedule/day-off-quota-draft";
export { analyzeFeasibility } from "@/domain/schedule/feasibility";
export {
    canTransitionScheduleVersion,
    isEditableScheduleVersion,
    isImmutableScheduleVersion
} from "@/domain/schedule/lifecycle";
export {
    constructSchedule,
    createDeterministicRng,
    localSearchImprove,
    repairHardViolations,
    SOLVER_VERSION,
    solveSchedule
} from "@/domain/schedule/solver";
export {
    buildSuggestionBaseline,
    buildSuggestionScope,
    compareSuggestionRank,
    rankShiftCodeCandidates,
    violationKey
} from "@/domain/schedule/suggest";
export type {
    CoverageGapSnapshot,
    NonWorkingDayKindRef,
    RankShiftCodeCandidatesParams,
    ShiftCodeSuggestion,
    SuggestionAction,
    SuggestionBaseline,
    SuggestionRank
} from "@/domain/schedule/suggest";
export {
    addDaysToDate,
    buildAssignmentInterval,
    demandAppliesToDate,
    eachDateInRange,
    hoursBetween,
    intervalsOverlap,
    isHolidayDate,
    localDateTimeToIso,
    localDateTimeToUtcMs,
    resolveDayType,
    timeToMinutes
} from "@/domain/schedule/time";
export type {
    ConstraintViolation,
    FeasibilityIssue,
    FeasibilityIssueKind,
    FeasibilityResult,
    PlannedNonWorkingDaySnapshot,
    RuleInstanceSnapshot,
    ScheduleAssignment,
    ScheduleEngineInput,
    ScheduleSlot,
    ShiftCodeSnapshot,
    ShiftDemandSnapshot,
    SolverInput,
    SolverResult,
    StaffShiftAuthorizationSnapshot,
    StaffSnapshot,
    ValidationResult
} from "@/domain/schedule/types";
export {
    buildValidationContext,
    computeSoftScore,
    validateIncremental,
    validateSchedule,
    wouldAssignmentViolateHard
} from "@/domain/schedule/validate";
export type { IncrementalValidationScope } from "@/domain/schedule/validate";

