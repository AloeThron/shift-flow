/** metric ความเป็นธรรมเปรียบเทียบ manual vs shadow */
export type FairnessMetric = {
  id: string;
  nameTh: string;
  baselineValue: number;
  pilotValue: number;
  /** true = ค่าสูงดีกว่า; false = ค่าต่ำดีกว่า */
  higherIsBetter: boolean;
};

/** ตัวชี้วัดหนึ่งรอบ shadow (คู่ขนานกับ Excel/กระดาษ) */
export type PilotCycleMetrics = {
  cycleId: string;
  cycleStartDate: string;
  cycleEndDate: string;
  /** shadow = ไม่ publish เป็น official จนกว่าผู้อนุมัติลงนาม */
  mode: "shadow";
  hardSafetyViolations: number;
  competencyRequiredCount: number;
  competencyCorrectCount: number;
  unapprovedCoverageGaps: number;
  schedulingHoursTotal: number;
  schedulingHoursActive: number;
  /** เวลาจัด manual รอบเดียวกัน — จาก baseline */
  baselineSchedulingHoursTotal: number;
  /** 0–1 */
  acknowledgementRate: number;
  fairnessMetrics: readonly FairnessMetric[];
  deterministicReplayPassed: boolean;
  duplicateAssignmentCount: number;
};

/** gate ระดับโครงการ (ครั้งเดียวต่อ pilot) */
export type OperationalGates = {
  restoreDrillPassed: boolean;
  fallbackRosterVerified: boolean;
  shareLinkRevokeTestsPassed: boolean;
  schedulerSelfConfigPassed: boolean;
  syntheticOrgSetupWithinOneHour: boolean;
  /** 0–1 — ผู้ใช้ทำ task หลักสำเร็จโดยไม่ต้องมีผู้ช่วย */
  taskSuccessRate: number;
  stakeholderSignOff: {
    hrLegal: boolean;
    labHead: boolean;
    quality: boolean;
    dpoIt: boolean;
  };
};

/** รายงาน parallel pilot รวม ≥ 2 รอบ */
export type ParallelPilotReport = {
  pilotId: string;
  organizationId: string;
  startedAt: string;
  completedAt?: string;
  cycles: readonly PilotCycleMetrics[];
  operational: OperationalGates;
  notes?: string;
};

/** ผลประเมินเกณฑ์เดียว */
export type GateCriterionResult = {
  criterionId: string;
  nameTh: string;
  passed: boolean;
  actual: string;
  threshold: string;
  /** true = ไม่ผ่านแล้วแนะนำ rollback ทันที */
  blockingOnFailure: boolean;
};

/** การตัดสิน go-live / rollback */
export type GoLiveDecision = {
  passed: boolean;
  recommendRollback: boolean;
  criteria: readonly GateCriterionResult[];
  summaryTh: string;
};
