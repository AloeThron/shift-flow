import type { WorkloadMetrics } from "@/domain/optimize/fairness/workload-stats";
import type { FairnessDimension } from "@/domain/rules/helpers/schedule-metrics";

/** ชื่อ metric ภาษาไทย */
export const WORKLOAD_METRIC_LABELS: Readonly<Record<keyof WorkloadMetrics, string>> = {
  plannedHours: "ชม.ตามแผน",
  otHours: "OT (ชม.)",
  nightCount: "เวรดึก",
  weekendCount: "สุดสัปดาห์",
  holidayCount: "วันหยุดนักขัตฤกษ์",
  workedDays: "วันทำงาน",
  daysOff: "วันหยุด",
};

/** ชื่อมิติ fairness */
export const FAIRNESS_DIMENSION_LABELS: Readonly<Record<FairnessDimension, string>> = {
  TOTAL_HOURS: "ชั่วโมงรวม",
  OT_HOURS: "OT",
  NIGHT_SHIFTS: "เวรดึก",
  WEEKEND_DAYS: "วันสุดสัปดาห์",
  HOLIDAY_DAYS: "วันหยุดนักขัตฤกษ์",
};

/** จัดรูปแบบตัวเลขสำหรับแสดง */
export function formatWorkloadNumber(value: number, fractionDigits = 1): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(fractionDigits);
}

/** แปลง yearMonth เป็นข้อความสั้น */
export function formatYearMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return `${month}/${year.slice(2)}`;
}
