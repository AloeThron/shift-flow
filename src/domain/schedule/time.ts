/** แปลง HH:mm เป็นนาทีตั้งแต่เที่ยงคืน */
export function timeToMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

/** บวกวันในรูป YYYY-MM-DD */
export function addDaysToDate(date: string, days: number): string {
  const base = new Date(`${date}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/** offset นาทีของ timezone ณ instant ที่กำหนด */
function getTimezoneOffsetMinutes(timezone: string, utcMs: number): number {
  const date = new Date(utcMs);
  const utc = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const local = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
  return (local.getTime() - utc.getTime()) / 60_000;
}

/** แปลง local date+time เป็น UTC epoch ms */
export function localDateTimeToUtcMs(
  localDate: string,
  localTime: string,
  timezone: string,
): number {
  const [year, month, day] = localDate.split("-").map(Number);
  const [hour, minute] = localTime.split(":").map(Number);
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offsetMinutes = getTimezoneOffsetMinutes(timezone, utcMs);
    utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0) - offsetMinutes * 60_000;
  }

  return utcMs;
}

/** สร้าง ISO instant จาก local date/time */
export function localDateTimeToIso(localDate: string, localTime: string, timezone: string): string {
  return new Date(localDateTimeToUtcMs(localDate, localTime, timezone)).toISOString();
}

/** ตรวจว่าเวรข้ามเที่ยงคืนจากเวลาเริ่ม–จบ */
export function shiftCrossesMidnight(startTime: string, endTime: string): boolean {
  return timeToMinutes(endTime) <= timeToMinutes(startTime);
}

/** คำนวณช่วงเวลา assignment จาก shift code */
export function buildAssignmentInterval(
  shiftCode: {
    startTime: string;
    endTime: string;
  },
  scheduleDate: string,
  timezone: string,
): { startAt: string; endAt: string } {
  const startAt = localDateTimeToIso(scheduleDate, shiftCode.startTime, timezone);
  const endDate = shiftCrossesMidnight(shiftCode.startTime, shiftCode.endTime)
    ? addDaysToDate(scheduleDate, 1)
    : scheduleDate;
  const endAt = localDateTimeToIso(endDate, shiftCode.endTime, timezone);
  return { startAt, endAt };
}

/** ตรวจ overlap ระหว่างสองช่วง instant */
export function intervalsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const aStart = Date.parse(startA);
  const aEnd = Date.parse(endA);
  const bStart = Date.parse(startB);
  const bEnd = Date.parse(endB);
  return aStart < bEnd && bStart < aEnd;
}

/** ชั่วโมงระหว่าง end ของ A กับ start ของ B */
export function hoursBetween(endAt: string, startAt: string): number {
  return (Date.parse(startAt) - Date.parse(endAt)) / 3_600_000;
}

/** ชั่วโมงที่ assignment ครอบคลุมในช่วง [windowStart, windowEnd) */
export function assignmentHoursInWindow(
  assignment: { startAt: string; endAt: string },
  windowStartMs: number,
  windowEndMs: number,
): number {
  const start = Math.max(Date.parse(assignment.startAt), windowStartMs);
  const end = Math.min(Date.parse(assignment.endAt), windowEndMs);
  return Math.max(0, end - start) / 3_600_000;
}

/** วันในสัปดาห์จาก YYYY-MM-DD — 0=อาทิตย์ */
export function dayOfWeek(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** ตรวจว่า date เป็นวันหยุดใน calendar */
export function isHolidayDate(date: string, holidayDates: readonly string[]): boolean {
  return holidayDates.includes(date);
}

/** ประเภทวันสำหรับ coverage */
export function resolveDayType(
  date: string,
  holidayDates: readonly string[],
): "WEEKDAY" | "WEEKEND" | "HOLIDAY" {
  if (isHolidayDate(date, holidayDates)) {
    return "HOLIDAY";
  }
  const dow = dayOfWeek(date);
  return dow === 0 || dow === 6 ? "WEEKEND" : "WEEKDAY";
}

/** ตรวจว่า shift demand ใช้กับวันนี้ */
export function demandAppliesToDate(
  demand: { dayType: "WEEKDAY" | "WEEKEND" | "HOLIDAY" | "ALL" },
  date: string,
  holidayDates: readonly string[],
): boolean {
  if (demand.dayType === "ALL") {
    return true;
  }
  return demand.dayType === resolveDayType(date, holidayDates);
}

/** @deprecated ใช้ demandAppliesToDate แทน */
export const coverageAppliesToDate = demandAppliesToDate;

/** รายการวันในช่วง [start, end] รวมปลายทาง */
export function eachDateInRange(startDate: string, endDate: string): readonly string[] {
  const dates: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = addDaysToDate(cursor, 1);
  }
  return dates;
}
