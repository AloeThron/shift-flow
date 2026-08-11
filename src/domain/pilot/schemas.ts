import { z } from "zod";

/** schema fairness metric */
const fairnessMetricSchema = z.object({
  id: z.string().min(1),
  nameTh: z.string().min(1),
  baselineValue: z.number(),
  pilotValue: z.number(),
  higherIsBetter: z.boolean(),
});

/** schema รอบ shadow เดียว */
export const pilotCycleMetricsSchema = z.object({
  cycleId: z.string().min(1),
  cycleStartDate: z.string().min(1),
  cycleEndDate: z.string().min(1),
  mode: z.literal("shadow"),
  hardSafetyViolations: z.number().int().min(0),
  competencyRequiredCount: z.number().int().min(0),
  competencyCorrectCount: z.number().int().min(0),
  unapprovedCoverageGaps: z.number().int().min(0),
  schedulingHoursTotal: z.number().min(0),
  schedulingHoursActive: z.number().min(0),
  baselineSchedulingHoursTotal: z.number().min(0),
  acknowledgementRate: z.number().min(0).max(1),
  fairnessMetrics: z.array(fairnessMetricSchema),
  deterministicReplayPassed: z.boolean(),
  duplicateAssignmentCount: z.number().int().min(0),
});

/** schema gate ระดับโครงการ */
export const operationalGatesSchema = z.object({
  restoreDrillPassed: z.boolean(),
  fallbackRosterVerified: z.boolean(),
  shareLinkRevokeTestsPassed: z.boolean(),
  schedulerSelfConfigPassed: z.boolean(),
  syntheticOrgSetupWithinOneHour: z.boolean(),
  taskSuccessRate: z.number().min(0).max(1),
  stakeholderSignOff: z.object({
    hrLegal: z.boolean(),
    labHead: z.boolean(),
    quality: z.boolean(),
    dpoIt: z.boolean(),
  }),
});

/** schema รายงาน parallel pilot */
export const parallelPilotReportSchema = z.object({
  pilotId: z.string().min(1),
  organizationId: z.string().min(1),
  startedAt: z.string().min(1),
  completedAt: z.string().optional(),
  cycles: z.array(pilotCycleMetricsSchema).min(2),
  operational: operationalGatesSchema,
  notes: z.string().optional(),
});
