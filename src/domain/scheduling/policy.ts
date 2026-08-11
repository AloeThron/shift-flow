import type { OtDerivationMode } from "@/generated/client/client";

/** ค่า default ของ starter pack — ไม่ hardcode ใน business logic อื่น */
export const DEFAULT_SCHEDULING_POLICY = {
  historyWindowMonths: 6,
  fairnessLookbackMonths: 6,
  planningHorizonMonths: 1,
  publishLeadDays: 7,
  otDerivationMode: "SHIFT_CODE_ONLY" as OtDerivationMode,
} as const;

/** snapshot นโยบายจัดตารางที่ engine/loader ใช้ */
export type SchedulingPolicySnapshot = {
  readonly id: string;
  readonly organizationId: string;
  readonly historyWindowMonths: number;
  readonly fairnessLookbackMonths: number;
  readonly planningHorizonMonths: number;
  readonly publishLeadDays: number;
  readonly otDerivationMode: OtDerivationMode;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly version: number;
};

/** ขอบเขตที่ validate ค่านโยบาย */
export type SchedulingPolicyBounds = {
  readonly minHistoryWindowMonths?: number;
  readonly maxHistoryWindowMonths?: number;
  readonly minPlanningHorizonMonths?: number;
  readonly maxPlanningHorizonMonths?: number;
};

const DEFAULT_BOUNDS: Required<SchedulingPolicyBounds> = {
  minHistoryWindowMonths: 1,
  maxHistoryWindowMonths: 24,
  minPlanningHorizonMonths: 1,
  maxPlanningHorizonMonths: 3,
};

/** ตรวจว่า lookback ไม่เกินหน้าต่างปฏิบัติการ */
export function validateSchedulingPolicyValues(
  values: Pick<
    SchedulingPolicySnapshot,
    "historyWindowMonths" | "fairnessLookbackMonths" | "planningHorizonMonths" | "publishLeadDays"
  >,
  bounds: SchedulingPolicyBounds = {},
): readonly string[] {
  const limits = { ...DEFAULT_BOUNDS, ...bounds };
  const errors: string[] = [];

  if (
    values.historyWindowMonths < limits.minHistoryWindowMonths ||
    values.historyWindowMonths > limits.maxHistoryWindowMonths
  ) {
    errors.push(
      `historyWindowMonths ต้องอยู่ระหว่าง ${limits.minHistoryWindowMonths}–${limits.maxHistoryWindowMonths}`,
    );
  }

  if (
    values.fairnessLookbackMonths < 1 ||
    values.fairnessLookbackMonths > values.historyWindowMonths
  ) {
    errors.push("fairnessLookbackMonths ต้องอยู่ระหว่าง 1 ถึง historyWindowMonths");
  }

  if (
    values.planningHorizonMonths < limits.minPlanningHorizonMonths ||
    values.planningHorizonMonths > limits.maxPlanningHorizonMonths
  ) {
    errors.push(
      `planningHorizonMonths ต้องอยู่ระหว่าง ${limits.minPlanningHorizonMonths}–${limits.maxPlanningHorizonMonths}`,
    );
  }

  if (values.publishLeadDays < 0 || values.publishLeadDays > 90) {
    errors.push("publishLeadDays ต้องอยู่ระหว่าง 0–90");
  }

  return errors;
}

/** เลือก policy ที่มีผล ณ วันที่กำหนด */
export function resolveEffectiveSchedulingPolicy(
  policies: readonly SchedulingPolicySnapshot[],
  asOfDate: string,
): SchedulingPolicySnapshot | undefined {
  const asOf = asOfDate.slice(0, 10);

  const active = policies.filter((policy) => {
    const from = policy.effectiveFrom.slice(0, 10);
    const to = policy.effectiveTo?.slice(0, 10) ?? null;
    return from <= asOf && (to === null || to >= asOf);
  });

  if (active.length === 0) {
    return undefined;
  }

  return active.sort((left, right) => {
    const fromCompare = right.effectiveFrom.localeCompare(left.effectiveFrom);
    if (fromCompare !== 0) {
      return fromCompare;
    }
    return right.version - left.version;
  })[0];
}

/** สร้าง snapshot fallback เมื่อ org ยังไม่มี policy ใน DB */
export function buildDefaultSchedulingPolicySnapshot(
  organizationId: string,
  asOfDate: string,
): SchedulingPolicySnapshot {
  return {
    id: "default",
    organizationId,
    historyWindowMonths: DEFAULT_SCHEDULING_POLICY.historyWindowMonths,
    fairnessLookbackMonths: DEFAULT_SCHEDULING_POLICY.fairnessLookbackMonths,
    planningHorizonMonths: DEFAULT_SCHEDULING_POLICY.planningHorizonMonths,
    publishLeadDays: DEFAULT_SCHEDULING_POLICY.publishLeadDays,
    otDerivationMode: DEFAULT_SCHEDULING_POLICY.otDerivationMode,
    effectiveFrom: asOfDate.slice(0, 10),
    effectiveTo: null,
    version: 1,
  };
}
