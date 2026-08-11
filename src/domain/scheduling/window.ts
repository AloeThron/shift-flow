import { yearMonthFromDate } from "@/domain/rules/helpers/schedule-metrics";
import { addDaysToDate } from "@/domain/schedule/time";

/** บวก/ลบเดือนจาก YYYY-MM */
export function addMonthsToYearMonth(yearMonth: string, deltaMonths: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const anchor = new Date(Date.UTC(year, month - 1 + deltaMonths, 1));
  const nextYear = anchor.getUTCFullYear();
  const nextMonth = String(anchor.getUTCMonth() + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
}

/** วันแรกของเดือน YYYY-MM */
export function firstDayOfMonth(yearMonth: string): string {
  return `${yearMonth}-01`;
}

/** วันสุดท้ายของเดือน YYYY-MM */
export function lastDayOfMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${yearMonth}-${String(lastDay).padStart(2, "0")}`;
}

/** ช่วงหน้าต่างปฏิบัติการ [start, end] รวมปลายทาง */
export function computeHistoryWindow(
  asOfDate: string,
  historyWindowMonths: number,
): { readonly windowStart: string; readonly windowEnd: string } {
  const endYearMonth = yearMonthFromDate(asOfDate);
  const startYearMonth = addMonthsToYearMonth(endYearMonth, -(historyWindowMonths - 1));

  return {
    windowStart: firstDayOfMonth(startYearMonth),
    windowEnd: lastDayOfMonth(endYearMonth),
  };
}

/** รายการ yearMonth สำหรับ fairness lookback รวมเดือน ณ asOf */
export function fairnessLookbackYearMonths(
  asOfDate: string,
  fairnessLookbackMonths: number,
): readonly string[] {
  const endYearMonth = yearMonthFromDate(asOfDate);
  const months: string[] = [];

  for (let offset = fairnessLookbackMonths - 1; offset >= 0; offset -= 1) {
    months.push(addMonthsToYearMonth(endYearMonth, -offset));
  }

  return months;
}

/** รายการ yearMonth ที่อยู่ก่อนหน้าต่างปฏิบัติการ — ใช้ archive job */
export function yearMonthsBeforeWindow(
  windowStart: string,
  candidateYearMonths: readonly string[],
): readonly string[] {
  const cutoffYearMonth = yearMonthFromDate(windowStart);
  return candidateYearMonths.filter((yearMonth) => yearMonth < cutoffYearMonth).sort();
}

/** ช่วงรอบรายเดือน [periodStart, periodEnd] จาก yearMonth */
export function monthCyclePeriod(yearMonth: string): {
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly name: string;
} {
  return {
    periodStart: firstDayOfMonth(yearMonth),
    periodEnd: lastDayOfMonth(yearMonth),
    name: yearMonth,
  };
}

/** yearMonth ของเดือนถัดไปจากวันที่ */
export function nextMonthYearMonth(fromDate: string): string {
  const current = yearMonthFromDate(fromDate);
  return addMonthsToYearMonth(current, 1);
}

/** yearMonth ที่ควรเปิดเป็นรอบ planning ตาม horizon */
export function planningCycleYearMonths(
  asOfDate: string,
  planningHorizonMonths: number,
): readonly string[] {
  const months: string[] = [];
  let cursor = nextMonthYearMonth(asOfDate);

  for (let index = 0; index < planningHorizonMonths; index += 1) {
    months.push(cursor);
    cursor = addMonthsToYearMonth(cursor, 1);
  }

  return months;
}

/** ตรวจว่าวันที่อยู่ในช่วง [start, end] */
export function isDateInInclusiveRange(
  date: string,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  return date >= rangeStart && date <= rangeEnd;
}

/** วันที่ publish deadline สำหรับรอบที่เริ่ม periodStart */
export function computePublishDeadline(periodStart: string, publishLeadDays: number): string {
  return addDaysToDate(periodStart, -publishLeadDays);
}
