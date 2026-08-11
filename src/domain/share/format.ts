/** แปลง ISO instant เป็นเวลา HH:mm ตาม timezone */
export function formatTimeInTimezone(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(new Date(iso));
}

/** แสดงช่วงเวลาเซลล์ — คืน null เมื่อไม่มีหรือเป็นศูนย์ความยาว */
export function formatCellTimeRange(input: {
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly timezone: string;
}): string | null {
  if (!input.startsAt || !input.endsAt) {
    return null;
  }
  if (input.startsAt === input.endsAt) {
    return null;
  }
  return `${formatTimeInTimezone(input.startsAt, input.timezone)}–${formatTimeInTimezone(input.endsAt, input.timezone)}`;
}
