import type { BalancePlanInput } from "@/domain/optimize/balance/types";
import type { DayOffPlanInput, DayOffRequest, HistoricalOffDate } from "@/domain/optimize/day-off";
import { isWorkingAssignment } from "@/domain/rules/helpers/schedule-metrics";
import { serializeStaffDayOffQuotas } from "@/domain/schedule/day-off-quota-draft";
import { eachDateInRange } from "@/domain/schedule/time";
import type { ScheduleEngineInput } from "@/domain/schedule/types";
import { prisma } from "@/lib/prisma";
import type { CanvasDraftSnapshot } from "@/lib/scheduling/load-canvas-draft";
import type { HistoryWindowSnapshot } from "@/lib/scheduling/load-history-window";

import { buildDemandSlots } from "./build-demand-slots";

/** ขอบเขตรอบที่ solver ใช้ — จำกัดวันสำหรับ e2e/perf ผ่าน E2E_SOLVER_MAX_DAYS */
export type SolverCycleBounds = {
  readonly cycleStartDate: string;
  readonly cycleEndDate: string;
};

/** คำนวณ cycleEnd ที่ solver ใช้จริง */
export function resolveSolverCycleBounds(
  periodStart: string,
  periodEnd: string,
): SolverCycleBounds {
  const limitText = process.env.E2E_SOLVER_MAX_DAYS;
  if (!limitText) {
    return { cycleStartDate: periodStart, cycleEndDate: periodEnd };
  }

  const limit = Number.parseInt(limitText, 10);
  if (!Number.isFinite(limit) || limit <= 0) {
    return { cycleStartDate: periodStart, cycleEndDate: periodEnd };
  }

  const dates = eachDateInRange(periodStart, periodEnd);
  const boundedEnd = dates[Math.min(limit, dates.length) - 1] ?? periodEnd;
  return { cycleStartDate: periodStart, cycleEndDate: boundedEnd };
}

/** ตัด engine input ให้อยู่ในขอบเขตรอบที่ solver ใช้ */
export function truncateEngineInputForSolver(
  input: ScheduleEngineInput,
  bounds: SolverCycleBounds,
): ScheduleEngineInput {
  if (
    bounds.cycleEndDate === input.cycleEndDate &&
    bounds.cycleStartDate === input.cycleStartDate
  ) {
    return input;
  }

  const inRange = (localDate: string): boolean =>
    localDate >= bounds.cycleStartDate && localDate <= bounds.cycleEndDate;

  return {
    ...input,
    cycleStartDate: bounds.cycleStartDate,
    cycleEndDate: bounds.cycleEndDate,
    assignments: input.assignments.filter((assignment) => inRange(assignment.scheduleDate)),
    plannedNonWorkingDays: input.plannedNonWorkingDays.filter((entry) => inRange(entry.localDate)),
    holidayDates: input.holidayDates.filter((date) => inRange(date)),
  };
}

/** สร้าง DayOffPlanInput จาก canvas snapshot */
export function buildDayOffPlanInput(
  snapshot: CanvasDraftSnapshot,
  history: HistoryWindowSnapshot,
): DayOffPlanInput {
  if (!snapshot.defaultOffKindId) {
    throw new Error("ไม่พบชนิดวันหยุดในระบบ");
  }

  const bounds = resolveSolverCycleBounds(snapshot.periodStart, snapshot.periodEnd);
  const engineInput = truncateEngineInputForSolver(snapshot.engineInput, bounds);

  return {
    organizationId: engineInput.organizationId,
    scheduleDraftId: snapshot.draftId,
    cycleStartDate: bounds.cycleStartDate,
    cycleEndDate: bounds.cycleEndDate,
    holidayDates: engineInput.holidayDates,
    staff: engineInput.staff,
    shiftCodes: engineInput.shiftCodes,
    assignments: engineInput.assignments,
    ruleInstances: engineInput.ruleInstances,
    nonWorkingDayKindId: snapshot.defaultOffKindId,
    dayOffRequests: engineInput.plannedNonWorkingDays
      .filter((entry) => !entry.locked && entry.source === "REQUEST")
      .map(
        (entry): DayOffRequest => ({
          staffId: entry.staffId,
          localDate: entry.localDate,
        }),
      ),
    plannedNonWorkingDays: engineInput.plannedNonWorkingDays,
    historicalOffDates: buildHistoricalOffDates(history),
    staffWorkloadMonthly: engineInput.staffWorkloadMonthly,
    staffDayOffQuotas: engineInput.staffDayOffQuotas,
  };
}

/** สร้าง BalancePlanInput จาก canvas snapshot */
export function buildBalancePlanInput(snapshot: CanvasDraftSnapshot): BalancePlanInput {
  const bounds = resolveSolverCycleBounds(snapshot.periodStart, snapshot.periodEnd);
  const engineInput = truncateEngineInputForSolver(snapshot.engineInput, bounds);
  const slots = buildDemandSlots(engineInput);

  return {
    ...engineInput,
    slots,
  };
}

/** รวบรวมวันหยุดย้อนหลังจาก history window */
export function buildHistoricalOffDates(history: HistoryWindowSnapshot): HistoricalOffDate[] {
  const shiftCodeById = new Map(history.shiftCodes.map((code) => [code.id, code]));
  const historical = new Map<string, HistoricalOffDate>();

  for (const assignment of history.assignments) {
    if (isWorkingAssignment(shiftCodeById, assignment)) {
      continue;
    }
    historical.set(`${assignment.staffId}:${assignment.scheduleDate}`, {
      staffId: assignment.staffId,
      localDate: assignment.scheduleDate,
    });
  }

  for (const planned of history.plannedNonWorkingDays) {
    if (!planned.blocksScheduling) {
      continue;
    }
    historical.set(`${planned.staffId}:${planned.localDate}`, {
      staffId: planned.staffId,
      localDate: planned.localDate,
    });
  }

  return [...historical.values()].sort((left, right) => {
    const staffCompare = left.staffId.localeCompare(right.staffId);
    if (staffCompare !== 0) {
      return staffCompare;
    }
    return left.localDate.localeCompare(right.localDate);
  });
}

/** โหลด ruleSetVersionId จาก draft version */
export async function loadRuleSetVersionId(
  organizationId: string,
  draftVersionId: string,
): Promise<string> {
  const version = await prisma.scheduleVersion.findFirst({
    where: {
      id: draftVersionId,
      organizationId,
    },
    select: { ruleSetVersionId: true },
  });

  if (!version) {
    throw new Error("ไม่พบ schedule version ของ draft");
  }

  return version.ruleSetVersionId;
}

/** นับ attempt ถัดไปของ ScheduleRun */
export async function nextScheduleRunAttempt(args: {
  organizationId: string;
  scheduleDraftId: string;
  stage: "DAY_OFF" | "BALANCE";
}): Promise<number> {
  const latest = await prisma.scheduleRun.findFirst({
    where: {
      organizationId: args.organizationId,
      scheduleDraftId: args.scheduleDraftId,
      stage: args.stage,
    },
    orderBy: { attemptNumber: "desc" },
    select: { attemptNumber: true },
  });

  return (latest?.attemptNumber ?? 0) + 1;
}

/** payload checksum สำหรับ Stage A */
export function dayOffChecksumInput(
  snapshot: CanvasDraftSnapshot,
  history: HistoryWindowSnapshot,
): Record<string, unknown> {
  const planInput = buildDayOffPlanInput(snapshot, history);
  return {
    stage: "DAY_OFF",
    draftId: snapshot.draftId,
    optimisticVersion: snapshot.optimisticVersion,
    cycleStartDate: planInput.cycleStartDate,
    cycleEndDate: planInput.cycleEndDate,
    staffIds: planInput.staff.map((member) => member.id).sort(),
    ruleInstanceIds: planInput.ruleInstances.map((rule) => rule.id).sort(),
    plannedOff: planInput.plannedNonWorkingDays,
    dayOffRequests: planInput.dayOffRequests,
    staffDayOffQuotas: planInput.staffDayOffQuotas
      ? serializeStaffDayOffQuotas(planInput.staffDayOffQuotas)
      : [],
  };
}

/** payload checksum สำหรับ Stage B */
export function balanceChecksumInput(snapshot: CanvasDraftSnapshot): Record<string, unknown> {
  const planInput = buildBalancePlanInput(snapshot);
  return {
    stage: "BALANCE",
    draftId: snapshot.draftId,
    optimisticVersion: snapshot.optimisticVersion,
    cycleStartDate: planInput.cycleStartDate,
    cycleEndDate: planInput.cycleEndDate,
    staffIds: planInput.staff.map((member) => member.id).sort(),
    slotIds: planInput.slots.map((slot) => slot.id).sort(),
    assignmentIds: planInput.assignments.map((assignment) => assignment.id).sort(),
    plannedOff: planInput.plannedNonWorkingDays,
  };
}

/** ตรวจว่าวันที่อยู่ในรอบ */
export function isDateInCycle(engineInput: ScheduleEngineInput, localDate: string): boolean {
  const dates = new Set(eachDateInRange(engineInput.cycleStartDate, engineInput.cycleEndDate));
  return dates.has(localDate);
}
