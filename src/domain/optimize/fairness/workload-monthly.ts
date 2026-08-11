import {
  assignmentOtHours,
  isOffShiftCode,
  isWorkingAssignment,
  yearMonthFromDate,
} from "@/domain/rules/helpers/schedule-metrics";
import { eachDateInRange, resolveDayType } from "@/domain/schedule/time";
import type {
  PlannedNonWorkingDaySnapshot,
  ScheduleAssignment,
  ShiftCodeSnapshot,
  StaffSnapshot,
  StaffWorkloadMonthlySnapshot,
} from "@/domain/schedule/types";

/** input สำหรับคำนวณ workload รายเดือน */
export type WorkloadMonthlyInput = {
  readonly staff: readonly StaffSnapshot[];
  readonly shiftCodes: readonly ShiftCodeSnapshot[];
  readonly assignments: readonly ScheduleAssignment[];
  readonly holidayDates: readonly string[];
  readonly plannedNonWorkingDays?: readonly PlannedNonWorkingDaySnapshot[];
};

/** ปัดทศนิยม 2 ตำแหน่ง */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** สร้าง index shift code */
function buildShiftCodeById(
  shiftCodes: readonly ShiftCodeSnapshot[],
): ReadonlyMap<string, ShiftCodeSnapshot> {
  return new Map(shiftCodes.map((entry) => [entry.id, entry]));
}

/** รายการ yearMonth ที่มีข้อมูลจาก assignment / วันหยุด */
export function collectYearMonthsFromInput(input: WorkloadMonthlyInput): readonly string[] {
  const months = new Set<string>();

  for (const assignment of input.assignments) {
    months.add(yearMonthFromDate(assignment.scheduleDate));
  }

  for (const entry of input.plannedNonWorkingDays ?? []) {
    months.add(yearMonthFromDate(entry.localDate));
  }

  return [...months].sort();
}

/** ตรวจว่า staff หยุดในวันที่กำหนด (จาก input โดยตรง) */
function isStaffOffOnDateInInput(
  input: WorkloadMonthlyInput,
  shiftCodeById: ReadonlyMap<string, ShiftCodeSnapshot>,
  staffId: string,
  date: string,
): boolean {
  const plannedOff = (input.plannedNonWorkingDays ?? []).some(
    (entry) => entry.staffId === staffId && entry.localDate === date,
  );
  if (plannedOff) {
    return true;
  }

  return input.assignments.some(
    (assignment) =>
      assignment.staffId === staffId &&
      assignment.scheduleDate === date &&
      !isWorkingAssignment(shiftCodeById, assignment),
  );
}

/** คำนวณ workload รายเดือนของ staff หนึ่งคน */
export function computeStaffWorkloadMonthlyForMonth(
  input: WorkloadMonthlyInput,
  staffId: string,
  yearMonth: string,
): StaffWorkloadMonthlySnapshot | undefined {
  const shiftCodeById = buildShiftCodeById(input.shiftCodes);
  const staff = input.staff.find((member) => member.id === staffId);
  if (!staff) {
    return undefined;
  }

  const monthAssignments = input.assignments.filter(
    (assignment) =>
      assignment.staffId === staffId && yearMonthFromDate(assignment.scheduleDate) === yearMonth,
  );

  const workingAssignments = monthAssignments.filter((assignment) =>
    isWorkingAssignment(shiftCodeById, assignment),
  );

  const monthStart = `${yearMonth}-01`;
  const monthEnd = `${yearMonth}-31`;
  const monthDates = eachDateInRange(monthStart, monthEnd).filter(
    (date) => yearMonthFromDate(date) === yearMonth,
  );

  const hasPlannedOff = (input.plannedNonWorkingDays ?? []).some(
    (entry) => entry.staffId === staffId && yearMonthFromDate(entry.localDate) === yearMonth,
  );

  if (monthAssignments.length === 0 && !hasPlannedOff) {
    return undefined;
  }

  const plannedHours = workingAssignments.reduce((total, assignment) => {
    const shiftCode = shiftCodeById.get(assignment.shiftCodeId);
    return total + (shiftCode?.standardHours ?? 0);
  }, 0);

  const otHours = workingAssignments.reduce(
    (total, assignment) => total + assignmentOtHours(shiftCodeById, assignment),
    0,
  );

  const nightCount = workingAssignments.filter((assignment) => {
    const shiftCode = shiftCodeById.get(assignment.shiftCodeId);
    return shiftCode?.isNightShift === true;
  }).length;

  const weekendDates = new Set(
    workingAssignments
      .filter(
        (assignment) => resolveDayType(assignment.scheduleDate, input.holidayDates) === "WEEKEND",
      )
      .map((assignment) => assignment.scheduleDate),
  );

  const holidayDates = new Set(
    workingAssignments
      .filter((assignment) => input.holidayDates.includes(assignment.scheduleDate))
      .map((assignment) => assignment.scheduleDate),
  );

  const workedDays = new Set(workingAssignments.map((assignment) => assignment.scheduleDate)).size;

  let daysOff = 0;
  for (const date of monthDates) {
    if (isStaffOffOnDateInInput(input, shiftCodeById, staffId, date)) {
      daysOff += 1;
    }
  }

  return {
    staffId,
    yearMonth,
    staffGroupId: staff.staffGroupId,
    plannedHours: round2(plannedHours),
    otHours: round2(otHours),
    nightCount,
    weekendCount: weekendDates.size,
    holidayCount: holidayDates.size,
    workedDays,
    daysOff,
    fteAtPeriod: staff.fte,
  };
}

/** สรุป workload รายเดือนทุกคนจาก input — idempotent เมื่อรันซ้ำ */
export function aggregateStaffWorkloadMonthly(
  input: WorkloadMonthlyInput,
  yearMonths: readonly string[] = collectYearMonthsFromInput(input),
): readonly StaffWorkloadMonthlySnapshot[] {
  const rows: StaffWorkloadMonthlySnapshot[] = [];

  for (const yearMonth of yearMonths) {
    for (const staff of input.staff) {
      const row = computeStaffWorkloadMonthlyForMonth(input, staff.id, yearMonth);
      if (row) {
        rows.push(row);
      }
    }
  }

  return rows.sort((left, right) => {
    const monthCompare = left.yearMonth.localeCompare(right.yearMonth);
    if (monthCompare !== 0) {
      return monthCompare;
    }
    return left.staffId.localeCompare(right.staffId);
  });
}

/** ตรวจว่าแถว off shift code ใช้ได้ */
export function resolveOffShiftCode(
  shiftCodes: readonly ShiftCodeSnapshot[],
): ShiftCodeSnapshot | undefined {
  return shiftCodes.find((entry) => isOffShiftCode(entry));
}
