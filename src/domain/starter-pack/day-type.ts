import type { CoverageDayType } from "./types";

/** แปลง day_type จาก CSV เป็น weekday mask (bit 0=จ … 6=อา) */
export function dayTypeToWeekdayMask(dayType: CoverageDayType): {
  weekdayMask: number;
  appliesOnHolidays: boolean;
} {
  switch (dayType) {
    case "WEEKDAY":
      return { weekdayMask: 31, appliesOnHolidays: false };
    case "WEEKEND":
      return { weekdayMask: 96, appliesOnHolidays: false };
    case "HOLIDAY":
      return { weekdayMask: 0, appliesOnHolidays: true };
    case "ALL":
      return { weekdayMask: 127, appliesOnHolidays: true };
  }
}

/** แปลง weekday mask กลับเป็น day type สำหรับ engine snapshot */
export function weekdayMaskToDayType(
  weekdayMask: number,
  appliesOnHolidays: boolean,
): CoverageDayType {
  if (weekdayMask === 31 && !appliesOnHolidays) {
    return "WEEKDAY";
  }
  if (weekdayMask === 96 && !appliesOnHolidays) {
    return "WEEKEND";
  }
  if (weekdayMask === 0 && appliesOnHolidays) {
    return "HOLIDAY";
  }
  return "ALL";
}

/** สร้างชื่อ demand จากแถว CSV */
export function buildDemandName(canonicalCode: string, dayType: CoverageDayType): string {
  return `${canonicalCode} ${dayType}`;
}

/** @deprecated ใช้ buildDemandName */
export function buildCoverageName(
  workAreaCode: string,
  dayType: CoverageDayType,
  startTime: string,
  endTime: string,
): string {
  return `${workAreaCode} ${dayType} ${startTime}-${endTime}`;
}
