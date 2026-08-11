import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { DayOffPlanInput } from "@/domain/optimize/day-off";
import type { BalancePlanInput } from "@/domain/optimize/balance/types";
import { buildValidationScheduleInput } from "@/domain/optimize/fairness/validation-roster";
import { buildDemandSlots } from "@/lib/scheduling/build-demand-slots";
import type {
  RuleInstanceSnapshot,
  ScheduleAssignment,
  ScheduleEngineInput,
  ShiftCodeSnapshot,
  ShiftDemandSnapshot,
  StaffSnapshot,
} from "@/domain/schedule/types";

const PACK = join(process.cwd(), "demo/starter-packs/pilot-lab-example");
const OFF_KIND_ID = "kind-off";

/** อ่าน CSV แบบง่ายจาก starter pack */
function readPackCsv(name: string): string[][] {
  const text = readFileSync(join(PACK, name), "utf8").trim();
  return text
    .split("\n")
    .slice(1)
    .map((line) => line.split(",").map((part) => part.trim()));
}

/** โหลด shift demands จาก starter pack */
function loadShiftDemands(shiftCodes: readonly ShiftCodeSnapshot[]): ShiftDemandSnapshot[] {
  const shiftCodeIdByCanonical = new Map(shiftCodes.map((code) => [code.code, code.id]));

  return readPackCsv("shift_demands.csv").map((parts, index) => ({
    id: `demand-${index}`,
    shiftCodeId: shiftCodeIdByCanonical.get(parts[0] ?? "") ?? `sc-missing-${index}`,
    dayType: (parts[1] ?? "ALL") as ShiftDemandSnapshot["dayType"],
    minCount: Number(parts[2] ?? 1),
    requiresLead: parts[3] === "true",
  }));
}

/** rule instances ขั้นต่ำสำหรับ benchmark solver สองระยะ */
function benchmarkRuleInstances(): RuleInstanceSnapshot[] {
  return [
    {
      id: "rule-day-off-quota",
      ruleTemplateId: "DAY_OFF_QUOTA",
      params: { daysOffPerCycle: 8, minWeekendDaysOff: 2, scope: "GROUP" },
      severity: "HARD",
      weight: null,
      overrideClass: "NEVER",
      enabled: true,
    },
    {
      id: "rule-max-staff-off",
      ruleTemplateId: "MAX_STAFF_OFF_PER_DAY",
      params: { maxOffWeekday: 3, maxOffWeekend: 5, maxOffHoliday: 4, scope: "GROUP" },
      severity: "HARD",
      weight: null,
      overrideClass: "NEVER",
      enabled: true,
    },
    {
      id: "rule-fair-distribution",
      ruleTemplateId: "FAIR_DISTRIBUTION",
      params: {
        dimension: "TOTAL_HOURS",
        scope: "GROUP",
        toleranceHours: 24,
        normalizeByFte: true,
        lookbackMonths: 6,
      },
      severity: "SOFT",
      weight: 1,
      overrideClass: "SCHEDULER_ALLOWED",
      enabled: true,
    },
    {
      id: "rule-ot-limit",
      ruleTemplateId: "OT_LIMIT",
      params: { maxOtHoursPerStaffPerCycle: 40, maxOtHoursPerOrgPerCycle: 400 },
      severity: "HARD",
      weight: null,
      overrideClass: "NEVER",
      enabled: true,
    },
  ];
}

/** ขยาย staff และ assignment ตามสัดส่วน (เช่น 1.25 = +25%) */
function scaleStaffAndAssignments(
  input: ScheduleEngineInput,
  allAssignments: readonly ScheduleAssignment[],
  scaleFactor: number,
): { input: ScheduleEngineInput; allAssignments: readonly ScheduleAssignment[] } {
  if (scaleFactor <= 1) {
    return { input, allAssignments };
  }

  const extraCount = Math.ceil(input.staff.length * (scaleFactor - 1));
  const sourceStaff = input.staff.slice(0, extraCount);
  const staffIdMap = new Map<string, string>();

  const extraStaff: StaffSnapshot[] = sourceStaff.map((member, index) => {
    const nextId = `${member.id}-scale-${index}`;
    staffIdMap.set(member.id, nextId);
    return { ...member, id: nextId };
  });

  const extraAssignments = allAssignments
    .filter((assignment) => staffIdMap.has(assignment.staffId))
    .map((assignment, index) => ({
      ...assignment,
      id: `${assignment.id}-scale-${index}`,
      staffId: staffIdMap.get(assignment.staffId)!,
    }));

  const cycleExtraAssignments = extraAssignments.filter(
    (assignment) =>
      assignment.scheduleDate >= input.cycleStartDate &&
      assignment.scheduleDate <= input.cycleEndDate,
  );

  return {
    input: {
      ...input,
      staff: [...input.staff, ...extraStaff],
      assignments: [...input.assignments, ...cycleExtraAssignments],
    },
    allAssignments: [...allAssignments, ...extraAssignments],
  };
}

/** สร้าง fixture benchmark จาก validation dataset +25% */
export function buildSolverPerformanceFixture(scaleFactor = 1.25): {
  dayOffInput: DayOffPlanInput;
  balanceInput: BalancePlanInput;
  staffCount: number;
  slotCount: number;
} {
  /** ใช้ 7 วันแรกของ golden cycle — ลดขนาดกราฟแต่คง staff +25% */
  const goldenCycle = {
    cycleStartDate: "2026-06-01",
    cycleEndDate: "2026-06-07",
  };

  const base = buildValidationScheduleInput({
    ...goldenCycle,
    includeHistoricalAssignments: true,
  });

  const enriched: ScheduleEngineInput = {
    ...base.input,
    shiftDemands: loadShiftDemands(base.shiftCodes),
    ruleInstances: benchmarkRuleInstances(),
  };

  const scaled = scaleStaffAndAssignments(enriched, base.allAssignments, scaleFactor);
  const slots = buildDemandSlots(scaled.input);

  const dayOffInput: DayOffPlanInput = {
    organizationId: scaled.input.organizationId,
    scheduleDraftId: "perf-draft",
    cycleStartDate: scaled.input.cycleStartDate,
    cycleEndDate: scaled.input.cycleEndDate,
    holidayDates: scaled.input.holidayDates,
    staff: scaled.input.staff,
    shiftCodes: scaled.input.shiftCodes,
    assignments: scaled.input.assignments,
    ruleInstances: scaled.input.ruleInstances,
    nonWorkingDayKindId: OFF_KIND_ID,
    plannedNonWorkingDays: scaled.input.plannedNonWorkingDays,
    dayOffRequests: [],
    historicalOffDates: [],
    staffWorkloadMonthly: scaled.input.staffWorkloadMonthly,
  };

  const balanceInput: BalancePlanInput = {
    ...scaled.input,
    slots,
  };

  return {
    dayOffInput,
    balanceInput,
    staffCount: scaled.input.staff.length,
    slotCount: slots.length,
  };
}

/** คำนวณ percentile จากตัวอย่างที่เรียงแล้ว */
export function percentile(sortedValues: readonly number[], p: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }
  const rank = Math.ceil((p / 100) * sortedValues.length) - 1;
  const index = Math.min(Math.max(rank, 0), sortedValues.length - 1);
  return sortedValues[index] ?? 0;
}
