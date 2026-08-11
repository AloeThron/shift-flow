/** meta รหัสเวรสำหรับกำหนดสีเซลล์ */
export type ShiftCodeToneMeta = {
  readonly code: string;
  readonly isNightShift: boolean;
};

/** สร้าง lookup รหัสเวร → meta สำหรับ styling */
export function buildShiftCodeToneLookup(
  shiftCodes: readonly ShiftCodeToneMeta[],
): ReadonlyMap<string, ShiftCodeToneMeta> {
  return new Map(shiftCodes.map((entry) => [entry.code, entry]));
}

/** คลาส Tailwind สำหรับเซลล์ตารางเวร share */
export function rosterGridCellClassName(input: {
  readonly displayCode: string | null;
  readonly isNonWorkingDay: boolean;
  readonly shiftMeta: ShiftCodeToneMeta | undefined;
}): string {
  if (!input.displayCode) {
    return "text-muted-foreground";
  }
  if (input.displayCode === "off" || input.isNonWorkingDay) {
    return "bg-muted/50 text-muted-foreground";
  }
  if (input.shiftMeta?.isNightShift) {
    return "bg-slate-900/90 font-medium text-white";
  }
  return "font-medium text-foreground";
}
