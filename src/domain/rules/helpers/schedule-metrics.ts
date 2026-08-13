import type { ValidationContext } from "@/domain/rules/types";
import { eachDateInRange, resolveDayType } from "@/domain/schedule/time";
import type {
  ScheduleAssignment,
  ShiftCodeSnapshot,
  StaffWorkloadMonthlySnapshot,
} from "@/domain/schedule/types";

/** มิติที่ FAIR_DISTRIBUTION วัด */
export type FairnessDimension =
  | "TOTAL_HOURS"
  | "OT_HOURS"
  | "NIGHT_SHIFTS"
  | "WEEKEND_DAYS"
  | "HOLIDAY_DAYS";

/** ขอบเขตการจัดกลุ่ม staff */
export type FairnessScope = "GROUP" | "ORG";

/** ตรวจว่ารหัสเวรนับเป็นวันหยุดหรือไม่ */
export function isOffShiftCode(shiftCode: ShiftCodeSnapshot): boolean {
  if (shiftCode.standardHours <= 0) {
    return true;
  }
  return shiftCode.code.trim().toLowerCase() === "off";
}

/** ตรวจว่า assignment เป็นการทำงาน (ไม่ใช่วันหยุด) */
export function isWorkingAssignment(
  shiftCodeById: ReadonlyMap<string, ShiftCodeSnapshot>,
  assignment: ScheduleAssignment,
): boolean {
  const shiftCode = shiftCodeById.get(assignment.shiftCodeId);
  if (!shiftCode) {
    return false;
  }
  return !isOffShiftCode(shiftCode);
}

/** ตรวจว่า staff มีวันหยุด/ลาที่บล็อกการจัดเวรในวันที่กำหนด */
export function hasApprovedLeaveOnDate(
  context: ValidationContext,
  staffId: string,
  date: string,
): boolean {
  return context.plannedNonWorkingDays.some(
    (entry) => entry.staffId === staffId && entry.localDate === date && entry.blocksScheduling,
  );
}

/** ตรวจว่า staff หยุดในวันที่กำหนด */
export function isStaffOffOnDate(
  context: ValidationContext,
  staffId: string,
  date: string,
): boolean {
  const plannedOff = context.plannedNonWorkingDays.some(
    (entry) => entry.staffId === staffId && entry.localDate === date,
  );
  if (plannedOff) {
    return true;
  }

  if (hasApprovedLeaveOnDate(context, staffId, date)) {
    return true;
  }

  const offAssignment = context.allAssignments.some(
    (assignment) =>
      assignment.staffId === staffId &&
      assignment.scheduleDate === date &&
      !isWorkingAssignment(context.shiftCodeById, assignment),
  );
  return offAssignment;
}

/** รวบรวมวันที่ staff หยุดในรอบ */
export function collectStaffOffDates(
  context: ValidationContext,
  staffId: string,
): ReadonlySet<string> {
  const offDates = new Set<string>();
  const cycleDates = eachDateInRange(context.cycleStartDate, context.cycleEndDate);

  for (const date of cycleDates) {
    if (isStaffOffOnDate(context, staffId, date)) {
      offDates.add(date);
    }
  }

  return offDates;
}

/** นับสัปดาห์ในรอบ (ปัดขึ้น) */
export function countWeeksInCycle(cycleStartDate: string, cycleEndDate: string): number {
  const dayCount = eachDateInRange(cycleStartDate, cycleEndDate).length;
  return Math.max(1, Math.ceil(dayCount / 7));
}

/** OT ต่อ assignment = planned + จากรหัสเวร */
export function assignmentOtHours(
  shiftCodeById: ReadonlyMap<string, ShiftCodeSnapshot>,
  assignment: ScheduleAssignment,
): number {
  const shiftCode = shiftCodeById.get(assignment.shiftCodeId);
  const codeOt = shiftCode?.otHours ?? 0;
  return (assignment.plannedOtHours ?? 0) + codeOt;
}

/** OT สะสมของ staff ในรอบ */
export function staffOtHoursInCycle(context: ValidationContext, staffId: string): number {
  return context.allAssignments
    .filter(
      (assignment) =>
        assignment.staffId === staffId &&
        assignment.scheduleDate >= context.cycleStartDate &&
        assignment.scheduleDate <= context.cycleEndDate &&
        isWorkingAssignment(context.shiftCodeById, assignment),
    )
    .reduce((total, assignment) => total + assignmentOtHours(context.shiftCodeById, assignment), 0);
}

/** OT สะสมทั้งองค์กรในรอบ */
export function orgOtHoursInCycle(context: ValidationContext): number {
  return context.staff.reduce(
    (total, member) => total + staffOtHoursInCycle(context, member.id),
    0,
  );
}

/** แปลง YYYY-MM-DD เป็น YYYY-MM */
export function yearMonthFromDate(date: string): string {
  return date.slice(0, 7);
}

/** เลื่อน yearMonth ตามจำนวนเดือน */
export function addMonthsToYearMonth(yearMonth: string, deltaMonths: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1 + deltaMonths, 1));
  const nextYear = cursor.getUTCFullYear();
  const nextMonth = String(cursor.getUTCMonth() + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
}

/** รายการ yearMonth ย้อนหลังก่อนรอบ (ไม่รวมเดือนที่กำลังจัด) */
export function lookbackYearMonths(
  cycleStartDate: string,
  lookbackMonths: number,
): readonly string[] {
  const anchor = yearMonthFromDate(cycleStartDate);
  const months: string[] = [];
  for (let index = lookbackMonths; index >= 1; index -= 1) {
    months.push(addMonthsToYearMonth(anchor, -index));
  }
  return months;
}

/** ค่าในรอบปัจจุบันตามมิติ fairness */
export function currentCycleFairnessValue(
  context: ValidationContext,
  staffId: string,
  dimension: FairnessDimension,
): number {
  const assignments = context.allAssignments.filter(
    (assignment) =>
      assignment.staffId === staffId &&
      assignment.scheduleDate >= context.cycleStartDate &&
      assignment.scheduleDate <= context.cycleEndDate &&
      isWorkingAssignment(context.shiftCodeById, assignment),
  );

  switch (dimension) {
    case "TOTAL_HOURS":
      return assignments.reduce((total, assignment) => {
        const shiftCode = context.shiftCodeById.get(assignment.shiftCodeId);
        return total + (shiftCode?.standardHours ?? 0);
      }, 0);
    case "OT_HOURS":
      return staffOtHoursInCycle(context, staffId);
    case "NIGHT_SHIFTS":
      return assignments.filter((assignment) => {
        const shiftCode = context.shiftCodeById.get(assignment.shiftCodeId);
        return shiftCode?.isNightShift === true;
      }).length;
    case "WEEKEND_DAYS":
      return new Set(
        assignments
          .filter(
            (assignment) =>
              resolveDayType(assignment.scheduleDate, context.holidayDates) === "WEEKEND",
          )
          .map((assignment) => assignment.scheduleDate),
      ).size;
    case "HOLIDAY_DAYS":
      return new Set(
        assignments
          .filter((assignment) => context.holidayDates.includes(assignment.scheduleDate))
          .map((assignment) => assignment.scheduleDate),
      ).size;
    default: {
      const exhaustive: never = dimension;
      return exhaustive;
    }
  }
}

/** น้ำหนักเดือนย้อนหลัง — เดือนใหม่กว่าได้น้ำหนักมากกว่า */
export function lookbackMonthWeight(monthIndex: number): number {
  return monthIndex + 1;
}

/** ค่าย้อนหลังจาก StaffWorkloadMonthly — ถ่วงน้ำหนักเดือนและ normalize ตาม FTE รายเดือน */
export function lookbackFairnessValue(
  workloadRows: readonly StaffWorkloadMonthlySnapshot[],
  staffId: string,
  dimension: FairnessDimension,
  lookbackMonthsList: readonly string[],
  normalizeByFte: boolean,
): number {
  let weightedSum = 0;
  let weightTotal = 0;
  let monthsWithData = 0;

  for (let index = 0; index < lookbackMonthsList.length; index += 1) {
    const yearMonth = lookbackMonthsList[index];
    const row = workloadRows.find(
      (entry) => entry.staffId === staffId && entry.yearMonth === yearMonth,
    );
    if (!row) {
      continue;
    }

    monthsWithData += 1;
    const weight = lookbackMonthWeight(index);
    let value = workloadMetricFromRow(row, dimension);
    if (normalizeByFte && row.fteAtPeriod > 0) {
      value = value / row.fteAtPeriod;
    }

    weightedSum += value * weight;
    weightTotal += weight;
  }

  if (weightTotal === 0 || monthsWithData === 0) {
    return 0;
  }

  // แปลงค่าเฉลี่ยถ่วงน้ำหนักกลับเป็นสเกลสะสมเทียบเท่าจำนวนเดือนที่มีข้อมูล
  return (weightedSum / weightTotal) * monthsWithData;
}

/** อ่านค่ามิติจากแถว workload */
function workloadMetricFromRow(
  row: StaffWorkloadMonthlySnapshot,
  dimension: FairnessDimension,
): number {
  switch (dimension) {
    case "TOTAL_HOURS":
      return row.plannedHours;
    case "OT_HOURS":
      return row.otHours;
    case "NIGHT_SHIFTS":
      return row.nightCount;
    case "WEEKEND_DAYS":
      return row.weekendCount;
    case "HOLIDAY_DAYS":
      return row.holidayCount;
    default: {
      const exhaustive: never = dimension;
      return exhaustive;
    }
  }
}

/** ค่า fairness รวม current + lookback แล้ว normalize ตาม FTE */
export function staffFairnessMetric(
  context: ValidationContext,
  staffId: string,
  dimension: FairnessDimension,
  lookbackMonths: number,
  normalizeByFte: boolean,
): number {
  const lookbackMonthsList = lookbackYearMonths(context.cycleStartDate, lookbackMonths);
  const workloadRows = (context.staffWorkloadMonthly ?? []).filter((row) =>
    lookbackMonthsList.includes(row.yearMonth),
  );

  const current = currentCycleFairnessValue(context, staffId, dimension);
  const historical = lookbackFairnessValue(
    workloadRows,
    staffId,
    dimension,
    lookbackMonthsList,
    normalizeByFte,
  );
  const rawTotal = current + historical;

  if (!normalizeByFte) {
    return rawTotal;
  }

  const staff = context.staffById.get(staffId);
  const fte = staff?.fte ?? 1;
  return fte > 0 ? rawTotal / fte : rawTotal;
}

/** จัดกลุ่ม staff ตาม scope — คืน key → staffIds */
export function groupStaffIdsByScope(
  context: ValidationContext,
  scope: FairnessScope,
): ReadonlyMap<string, readonly string[]> {
  const groups = new Map<string, string[]>();

  for (const member of context.staff) {
    const key = scope === "GROUP" ? (member.staffGroupId ?? "__ungrouped__") : "__org__";
    const list = groups.get(key) ?? [];
    list.push(member.id);
    groups.set(key, list);
  }

  return groups;
}
