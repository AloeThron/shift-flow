import type {
    FairnessMetric,
    GateCriterionResult,
    GoLiveDecision,
    ParallelPilotReport,
    PilotCycleMetrics,
} from "@/domain/pilot/types";

const MIN_CYCLES = 2;
const MIN_SCHEDULING_REDUCTION = 0.3;
const MIN_TASK_SUCCESS = 0.9;
const MIN_COMPETENCY_CORRECT = 1;

/** สร้างผล gate หนึ่งรายการ */
function criterion(
  criterionId: string,
  nameTh: string,
  passed: boolean,
  actual: string,
  threshold: string,
  blockingOnFailure: boolean,
): GateCriterionResult {
  return { criterionId, nameTh, passed, actual, threshold, blockingOnFailure };
}

/** คำนวณ % competency ถูกต้อง */
function competencyRate(cycle: PilotCycleMetrics): number {
  if (cycle.competencyRequiredCount === 0) {
    return 1;
  }
  return cycle.competencyCorrectCount / cycle.competencyRequiredCount;
}

/** คำนวณ % ลดเวลาจัดตาราง */
function schedulingReduction(cycle: PilotCycleMetrics): number {
  if (cycle.baselineSchedulingHoursTotal <= 0) {
    return 0;
  }
  return (
    (cycle.baselineSchedulingHoursTotal - cycle.schedulingHoursTotal) /
    cycle.baselineSchedulingHoursTotal
  );
}

/** ตรวจ fairness — ไม่แย่กว่า baseline ทุก metric และดีขึ้น ≥ 1 */
function evaluateFairness(metrics: readonly FairnessMetric[]): {
  notWorse: boolean;
  improvedCount: number;
} {
  let improvedCount = 0;
  const notWorse = metrics.every((metric) => {
    const delta = metric.pilotValue - metric.baselineValue;
    const improved = metric.higherIsBetter ? delta > 0 : delta < 0;
    const same = delta === 0;
    const notWorseThanBaseline = metric.higherIsBetter ? delta >= 0 : delta <= 0;
    if (improved) {
      improvedCount += 1;
    }
    return notWorseThanBaseline || same;
  });
  return { notWorse, improvedCount };
}

/** ประเมิน gate ความปลอดภัยและคุณภาพต่อเดือน */
function evaluateCycleSafetyGates(cycle: PilotCycleMetrics): GateCriterionResult[] {
  const prefix = cycle.cycleId;

  return [
    criterion(
      `${prefix}.hard-safety`,
      `Hard safety violations (${prefix})`,
      cycle.hardSafetyViolations === 0,
      String(cycle.hardSafetyViolations),
      "0",
      true,
    ),
    criterion(
      `${prefix}.competency`,
      `Competency authorization (${prefix})`,
      competencyRate(cycle) >= MIN_COMPETENCY_CORRECT,
      `${(competencyRate(cycle) * 100).toFixed(1)}%`,
      "100%",
      true,
    ),
    criterion(
      `${prefix}.coverage-gap`,
      `Coverage gap ไม่ได้รับอนุมัติ (${prefix})`,
      cycle.unapprovedCoverageGaps === 0,
      String(cycle.unapprovedCoverageGaps),
      "0",
      true,
    ),
    criterion(
      `${prefix}.deterministic`,
      `Deterministic replay (${prefix})`,
      cycle.deterministicReplayPassed,
      cycle.deterministicReplayPassed ? "ผ่าน" : "ไม่ผ่าน",
      "100%",
      true,
    ),
    criterion(
      `${prefix}.duplicate-assignment`,
      `Assignment ซ้ำ (${prefix})`,
      cycle.duplicateAssignmentCount === 0,
      String(cycle.duplicateAssignmentCount),
      "0",
      true,
    ),
    criterion(
      `${prefix}.scheduling-time`,
      `ลดเวลาจัดตาราง (${prefix})`,
      schedulingReduction(cycle) >= MIN_SCHEDULING_REDUCTION,
      `${(schedulingReduction(cycle) * 100).toFixed(1)}%`,
      "≥ 30%",
      false,
    ),
  ];
}

/** ประเมิน fairness ต่อเดือน */
function evaluateCycleFairnessGate(cycle: PilotCycleMetrics): GateCriterionResult {
  const { notWorse, improvedCount } = evaluateFairness(cycle.fairnessMetrics);
  const passed = notWorse && improvedCount >= 1;

  return criterion(
    `${cycle.cycleId}.fairness`,
    `Fairness metrics (${cycle.cycleId})`,
    passed,
    `ดีขึ้น ${improvedCount} metric, ไม่แย่กว่า baseline: ${notWorse ? "ใช่" : "ไม่"}`,
    "ไม่แย่กว่าทุก metric + ดีขึ้น ≥ 1",
    false,
  );
}

/** ประเมิน gate ระดับโครงการ */
function evaluateOperationalGates(report: ParallelPilotReport): GateCriterionResult[] {
  const { operational: op } = report;

  return [
    criterion(
      "ops.restore-drill",
      "Restore drill ผ่าน",
      op.restoreDrillPassed,
      op.restoreDrillPassed ? "ผ่าน" : "ไม่ผ่าน",
      "ผ่าน",
      true,
    ),
    criterion(
      "ops.fallback-roster",
      "Fallback roster พร้อมใช้",
      op.fallbackRosterVerified,
      op.fallbackRosterVerified ? "พร้อม" : "ไม่พร้อม",
      "พร้อม",
      true,
    ),
    criterion(
      "ops.share-link-revoke",
      "Share link revoke tests",
      op.shareLinkRevokeTestsPassed,
      op.shareLinkRevokeTestsPassed ? "ผ่าน" : "ไม่ผ่าน",
      "ผ่าน",
      true,
    ),
    criterion(
      "ops.scheduler-self-config",
      "ผู้จัดเวรตั้งค่ารหัส/coverage เองได้",
      op.schedulerSelfConfigPassed,
      op.schedulerSelfConfigPassed ? "สำเร็จ" : "ไม่สำเร็จ",
      "สำเร็จ",
      false,
    ),
    criterion(
      "ops.synthetic-org-setup",
      "ตั้งค่าองค์กรสมมติภายใน 1 ชม.",
      op.syntheticOrgSetupWithinOneHour,
      op.syntheticOrgSetupWithinOneHour ? "สำเร็จ" : "ไม่สำเร็จ",
      "≤ 1 ชม.",
      false,
    ),
    criterion(
      "ops.task-success",
      "Task success rate (user testing)",
      op.taskSuccessRate >= MIN_TASK_SUCCESS,
      `${(op.taskSuccessRate * 100).toFixed(1)}%`,
      "≥ 90%",
      false,
    ),
    criterion(
      "ops.sign-off",
      "Stakeholder sign-off ครบ",
      op.stakeholderSignOff.hrLegal &&
        op.stakeholderSignOff.labHead &&
        op.stakeholderSignOff.quality &&
        op.stakeholderSignOff.dpoIt,
      [
        op.stakeholderSignOff.hrLegal && "HR/นิติกร",
        op.stakeholderSignOff.labHead && "หัวหน้าแล็บ",
        op.stakeholderSignOff.quality && "คุณภาพ",
        op.stakeholderSignOff.dpoIt && "DPO/IT",
      ]
        .filter(Boolean)
        .join(", ") || "ยังไม่ครบ",
      "ครบทั้ง 4 ฝ่าย",
      false,
    ),
  ];
}

/** ตรวจว่ามีรอบ shadow ครบตามขั้นต่ำ */
function evaluateMinimumCycles(cycleCount: number): GateCriterionResult {
  return criterion(
    "pilot.min-cycles",
    "จำนวนรอบ shadow",
    cycleCount >= MIN_CYCLES,
    String(cycleCount),
    `≥ ${MIN_CYCLES}`,
    true,
  );
}

/** สรุปข้อความการตัดสิน */
function buildSummary(
  passed: boolean,
  recommendRollback: boolean,
  failedBlocking: readonly string[],
): string {
  if (passed) {
    return "ผ่านเกณฑ์ go-live — พร้อมเสนอ stakeholder sign-off และ cutover ตามแผน";
  }
  if (recommendRollback) {
    const blockers = failedBlocking.join(", ");
    return `ไม่ผ่านเกณฑ์ blocking — ใช้ตารางเดิม (Excel/กระดาษ) เป็น source of truth ต่อไป แก้ constraint/UX แล้วเริ่ม shadow cycle ใหม่ (blockers: ${blockers})`;
  }
  return "ยังไม่ผ่านเกณฑ์ go-live บางข้อที่ไม่ blocking — แก้ไขแล้วรัน shadow รอบถัดไปก่อน cutover";
}

/** ประเมิน go-live gate จากรายงาน parallel pilot */
export function evaluateGoLiveGate(report: ParallelPilotReport): GoLiveDecision {
  const cycleSafety = report.cycles.flatMap(evaluateCycleSafetyGates);
  const cycleFairness = report.cycles.map(evaluateCycleFairnessGate);
  const operational = evaluateOperationalGates(report);
  const minCycles = evaluateMinimumCycles(report.cycles.length);

  const criteria: GateCriterionResult[] = [
    minCycles,
    ...cycleSafety,
    ...cycleFairness,
    ...operational,
  ];

  const failedBlocking = criteria
    .filter((item) => !item.passed && item.blockingOnFailure)
    .map((item) => item.criterionId);

  const passed = criteria.every((item) => item.passed);
  const recommendRollback = failedBlocking.length > 0;

  return {
    passed,
    recommendRollback,
    criteria,
    summaryTh: buildSummary(passed, recommendRollback, failedBlocking),
  };
}

/** แนะนำ rollback เมื่อมี gate blocking ล้มเหลว */
export function shouldRollback(decision: GoLiveDecision): boolean {
  return decision.recommendRollback;
}
