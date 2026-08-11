import { monthCyclePeriod, planningCycleYearMonths } from "@/domain/scheduling/window";

/** รอบที่ควรมี draft เปิดแก้ได้ */
export type PlannedScheduleCycle = {
  readonly yearMonth: string;
  readonly name: string;
  readonly periodStart: string;
  readonly periodEnd: string;
};

/** คำนวณรอบที่ต้องสร้างตาม planningHorizonMonths — pure function */
export function computeRequiredPlanningCycles(
  asOfDate: string,
  planningHorizonMonths: number,
): readonly PlannedScheduleCycle[] {
  return planningCycleYearMonths(asOfDate, planningHorizonMonths).map((yearMonth) => {
    const period = monthCyclePeriod(yearMonth);
    return {
      yearMonth,
      name: period.name,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
    };
  });
}

/** ตรวจว่ารอบที่มีอยู่ครอบคลุมช่วง [periodStart, periodEnd] */
export function cycleCoversPeriod(
  cycle: { readonly periodStart: string; readonly periodEnd: string },
  periodStart: string,
  periodEnd: string,
): boolean {
  return cycle.periodStart === periodStart && cycle.periodEnd === periodEnd;
}

/** รายการรอบที่ยังไม่มีใน DB */
export function missingPlanningCycles(
  required: readonly PlannedScheduleCycle[],
  existing: readonly { readonly periodStart: string; readonly periodEnd: string }[],
): readonly PlannedScheduleCycle[] {
  return required.filter(
    (planned) =>
      !existing.some((cycle) => cycleCoversPeriod(cycle, planned.periodStart, planned.periodEnd)),
  );
}
