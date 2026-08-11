import type { ShiftCodeOption } from "@/lib/scheduling/load-canvas-draft";

/** สไตล์เซลล์จาก config — ไม่ hardcode รหัส pilot */
export function canvasCellClassName(input: {
  readonly shiftCode: string | null;
  readonly shiftCodeMeta: ShiftCodeOption | null;
  readonly isPlannedOff: boolean;
  readonly isWeekend: boolean;
  readonly isHoliday: boolean;
  readonly isFocused: boolean;
}): string {
  const classes: string[] = ["border-b", "px-1", "py-1.5", "text-center", "relative"];

  if (input.isWeekend) {
    classes.push("bg-muted/30");
  }

  if (input.isHoliday) {
    classes.push("ring-1 ring-inset ring-amber-400/50");
  }

  if (input.isPlannedOff) {
    classes.push(
      "bg-emerald-100/80 font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
    );
  } else if (input.shiftCodeMeta?.isNightShift) {
    classes.push("bg-slate-900/90 font-medium text-white");
  } else if (input.shiftCode) {
    classes.push("font-medium text-foreground");
  } else {
    classes.push("text-muted-foreground");
  }

  if (input.isFocused) {
    classes.push("ring-2 ring-primary ring-inset z-10");
  }

  return classes.join(" ");
}

/** เซลล์ถูกล็อก — pin assignment หรือ lock วันหยุด */
export function isCanvasCellLocked(input: {
  readonly isPinned: boolean;
  readonly plannedOffLocked: boolean;
}): boolean {
  return input.isPinned || input.plannedOffLocked;
}

/** หา shift code meta จาก id */
export function shiftCodeMetaById(
  shiftCodes: readonly ShiftCodeOption[],
): ReadonlyMap<string, ShiftCodeOption> {
  return new Map(shiftCodes.map((code) => [code.id, code]));
}

/** แปลงข้อความเป็น shift code */
export function resolveShiftCodeFromText(
  text: string,
  shiftCodes: readonly ShiftCodeOption[],
): ShiftCodeOption | null {
  const normalized = text.trim();
  if (!normalized) {
    return null;
  }

  return shiftCodes.find((code) => code.code.toLowerCase() === normalized.toLowerCase()) ?? null;
}
