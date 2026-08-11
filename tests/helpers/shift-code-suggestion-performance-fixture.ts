import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildValidationScheduleInput } from "@/domain/optimize/fairness/validation-roster";
import type { NonWorkingDayKindRef } from "@/domain/schedule/suggest";
import type {
  RuleInstanceSnapshot,
  ScheduleAssignment,
  ScheduleEngineInput,
  ShiftCodeSnapshot,
  ShiftDemandSnapshot,
  StaffSnapshot,
} from "@/domain/schedule/types";

const PACK = join(process.cwd(), "demo/starter-packs/pilot-lab-example");

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

/** rule instances ขั้นต่ำสำหรับ benchmark suggestion ranking */
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
    {
      id: "rule-grade-whitelist",
      ruleTemplateId: "GRADE_CODE_WHITELIST",
      params: { enforceFromShiftCodes: true },
      severity: "HARD",
      weight: null,
      overrideClass: "NEVER",
      enabled: true,
    },
    {
      id: "rule-min-rest",
      ruleTemplateId: "MIN_REST_BETWEEN_SHIFTS",
      params: { minRestHours: 11 },
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
): ScheduleEngineInput {
  if (scaleFactor <= 1) {
    return input;
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
    ...input,
    staff: [...input.staff, ...extraStaff],
    assignments: [...input.assignments, ...cycleExtraAssignments],
  };
}

/** ชนิดวันหยุดจาก starter pack — ไม่ hardcode รหัส pilot ในเทสต์ */
function loadNonWorkingDayKinds(): readonly NonWorkingDayKindRef[] {
  return [
    { id: "kind-off", code: "off", displayName: "วันหยุด" },
    { id: "kind-vac", code: "VAC", displayName: "ลาพักร้อน" },
  ];
}

/** สร้าง fixture จัดอันดับรหัสเวรจาก validation dataset +25% */
export function buildShiftCodeSuggestionPerformanceFixture(scaleFactor = 1.25): {
  input: ScheduleEngineInput;
  staffId: string;
  localDate: string;
  nonWorkingDayKinds: readonly NonWorkingDayKindRef[];
  defaultOffKindId: string;
  staffCount: number;
  shiftCodeCount: number;
} {
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
  const staffId = scaled.staff[0]?.id ?? "";
  const localDate = scaled.cycleStartDate;

  return {
    input: scaled,
    staffId,
    localDate,
    nonWorkingDayKinds: loadNonWorkingDayKinds(),
    defaultOffKindId: "kind-off",
    staffCount: scaled.staff.length,
    shiftCodeCount: scaled.shiftCodes.length,
  };
}
