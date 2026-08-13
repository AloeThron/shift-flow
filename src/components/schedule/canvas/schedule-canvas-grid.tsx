"use client";

import { formatWorkloadNumber } from "@/components/schedule/workload/workload-labels";
import { Input } from "@/components/ui/input";
import type {
  ScheduleCanvasGrid as CanvasGridModel,
  ScheduleCanvasRow,
} from "@/domain/schedule/canvas-grid";
import {
  computeCanvasCellHours,
  computeCanvasStaffRowTotals,
  hasCellOt,
} from "@/domain/schedule/canvas-hours";
import type { ShiftCodeSuggestion, SuggestionAction } from "@/domain/schedule/suggest";
import type { ShiftCodeOption } from "@/lib/scheduling/load-canvas-draft";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CanvasCellLockMarker } from "./canvas-cell-lock-marker";
import { CanvasCellOtMarker } from "./canvas-cell-ot-marker";
import { canvasCellClassName, isCanvasCellLocked, shiftCodeMetaById } from "./cell-style";
import type { CanvasInteractionMode } from "./schedule-steps";
import { ShiftCodePicker, type ShiftCodePickerSelectOptions } from "./shift-code-picker";

const THAI_WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"] as const;
const STAFF_NAME_COLUMN_CLASS =
  "bg-muted/40 sticky left-0 z-20 w-[9rem] min-w-[9rem] max-w-[9rem] border-r border-b px-2 py-1.5 text-left font-semibold";
const STAFF_NAME_CELL_CLASS =
  "bg-background sticky left-0 z-10 w-[9rem] min-w-[9rem] max-w-[9rem] border-r border-b px-2 py-1.5 text-left font-normal";
const OFF_QUOTA_HEADER_CLASS =
  "bg-muted/40 sticky left-[9rem] z-20 w-[2.5rem] min-w-[2.5rem] max-w-[2.5rem] border-r border-b px-0 py-1.5 text-center font-semibold";
const STAFF_OFF_QUOTA_CELL_CLASS =
  "bg-background sticky left-[9rem] z-10 h-px w-[2.5rem] min-w-[2.5rem] max-w-[2.5rem] border-r border-b p-0";
const SUMMARY_OT_COLUMN_CLASS =
  "bg-muted/40 sticky right-0 z-20 w-[1.75rem] min-w-[1.75rem] max-w-[1.75rem] border-b border-l px-0.5 py-1.5 text-center font-medium";
const SUMMARY_HOURS_COLUMN_CLASS =
  "bg-muted/40 sticky right-[1.75rem] z-20 w-[2rem] min-w-[2rem] max-w-[2rem] border-b border-l px-0.5 py-1.5 text-center font-medium";
const STAFF_SUMMARY_OT_CELL_CLASS =
  "bg-background sticky right-0 z-10 w-[1.75rem] min-w-[1.75rem] max-w-[1.75rem] border-b border-l px-0.5 py-1.5 text-center font-medium tabular-nums";
const STAFF_SUMMARY_HOURS_CELL_CLASS =
  "bg-background sticky right-[1.75rem] z-10 w-[2rem] min-w-[2rem] max-w-[2rem] border-b border-l px-0.5 py-1.5 text-center font-medium tabular-nums";

/** ตำแหน่งเซลล์ที่เลือก */
export type CanvasCellSelection = {
  readonly staffProfileId: string;
  readonly dateIndex: number;
};

/** คัดกรองให้เหลือเฉพาะตัวเลขสำหรับช่องโควตา OFF */
function sanitizeDayOffQuotaInput(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** label หัวคอลัมน์วัน */
function dayHeader(date: string): { weekday: string; day: string } {
  const parsed = new Date(`${date}T12:00:00Z`);
  return {
    weekday: THAI_WEEKDAYS[parsed.getUTCDay()] ?? "",
    day: String(parsed.getUTCDate()),
  };
}

/** ตาราง canvas แก้ไขได้ — เปิด popup เลือกรหัสเวร */
export function ScheduleCanvasGrid({
  grid,
  shiftCodes,
  canWrite,
  selection,
  onSelectionChange,
  onOpenPicker,
  pickerOpen,
  onPickerOpenChange,
  pickerSuggestions,
  pickerSuggestionsLoading,
  onApplyAction,
  onClearDayOff,
  onLockPin,
  onLockPlannedOff,
  onUnlockPin,
  onUnlockPlannedOff,
  collapsedGroups,
  onToggleGroup,
  onRenameGroup,
  showEmptySections,
  interactionMode = "PICKER",
  onPaintDayOff,
  onPaintStart,
  onPaintEnd,
  staffDayOffQuotas,
  defaultDayOffQuota,
  onQuotaChange,
  onQuotaBlur,
}: {
  grid: CanvasGridModel;
  shiftCodes: readonly ShiftCodeOption[];
  canWrite: boolean;
  selection: CanvasCellSelection | null;
  onSelectionChange: (selection: CanvasCellSelection | null) => void;
  onOpenPicker: (selection: CanvasCellSelection) => void;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  pickerSuggestions: readonly ShiftCodeSuggestion[];
  pickerSuggestionsLoading: boolean;
  onApplyAction: (
    staffProfileId: string,
    date: string,
    action: SuggestionAction,
    options?: ShiftCodePickerSelectOptions,
  ) => void;
  onClearDayOff: () => void;
  onLockPin: () => void;
  onLockPlannedOff: () => void;
  onUnlockPin: () => void;
  onUnlockPlannedOff: () => void;
  collapsedGroups: ReadonlySet<string>;
  onToggleGroup: (groupKey: string) => void;
  onRenameGroup: (groupId: string, displayName: string) => void;
  showEmptySections: boolean;
  interactionMode?: CanvasInteractionMode;
  onPaintDayOff?: (staffProfileId: string, dateIndex: number) => void;
  onPaintStart?: () => void;
  onPaintEnd?: () => void;
  staffDayOffQuotas: ReadonlyMap<string, number | null>;
  defaultDayOffQuota: number;
  onQuotaChange: (staffProfileId: string, value: string) => void;
  onQuotaBlur: (staffProfileId: string) => void;
}) {
  const shiftMetaById = useMemo(() => shiftCodeMetaById(shiftCodes), [shiftCodes]);
  const shiftHoursMetaById = useMemo(
    () =>
      new Map(
        shiftCodes.map((code) => [
          code.id,
          { standardHours: code.standardHours, otHours: code.otHours },
        ]),
      ),
    [shiftCodes],
  );
  const holidaySet = useMemo(() => new Set(grid.holidayDates), [grid.holidayDates]);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [isPainting, setIsPainting] = useState(false);
  const isPaintMode = interactionMode === "PAINT_OFF";

  /** ปล่อยเมาส์แล้วจบ session ลากลงวันหยุด */
  useEffect(() => {
    if (!isPainting) {
      return;
    }

    const handlePointerUp = () => {
      setIsPainting(false);
      onPaintEnd?.();
    };

    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, [isPainting, onPaintEnd]);

  const staffRowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    let staffIndex = 0;
    for (const row of grid.rows) {
      if (row.kind === "staff") {
        map.set(row.row.staffProfileId, staffIndex);
        staffIndex += 1;
      }
    }
    return map;
  }, [grid.rows]);

  const staffRows = useMemo(
    () =>
      grid.rows.filter(
        (row): row is Extract<ScheduleCanvasRow, { kind: "staff" }> => row.kind === "staff",
      ),
    [grid.rows],
  );

  const moveSelection = useCallback(
    (deltaStaff: number, deltaDate: number) => {
      if (!selection || staffRows.length === 0 || grid.dates.length === 0) {
        return;
      }

      const currentStaffIndex = staffRowIndexById.get(selection.staffProfileId) ?? 0;
      const nextStaffIndex = Math.max(
        0,
        Math.min(staffRows.length - 1, currentStaffIndex + deltaStaff),
      );
      const nextDateIndex = Math.max(
        0,
        Math.min(grid.dates.length - 1, selection.dateIndex + deltaDate),
      );
      const nextStaff = staffRows[nextStaffIndex]?.row.staffProfileId;
      if (!nextStaff) {
        return;
      }

      onSelectionChange({ staffProfileId: nextStaff, dateIndex: nextDateIndex });
      if (pickerOpen) {
        onPickerOpenChange(false);
      }
    },
    [
      grid.dates.length,
      onPickerOpenChange,
      onSelectionChange,
      pickerOpen,
      selection,
      staffRowIndexById,
      staffRows,
    ],
  );

  const openPickerForSelection = useCallback(
    (cellSelection: CanvasCellSelection) => {
      if (!canWrite || isPaintMode) {
        return;
      }
      onSelectionChange(cellSelection);
      onOpenPicker(cellSelection);
    },
    [canWrite, isPaintMode, onOpenPicker, onSelectionChange],
  );

  const paintCell = useCallback(
    (cellSelection: CanvasCellSelection) => {
      if (!canWrite || !isPaintMode || !onPaintDayOff) {
        return;
      }
      onSelectionChange(cellSelection);
      onPaintDayOff(cellSelection.staffProfileId, cellSelection.dateIndex);
    },
    [canWrite, isPaintMode, onPaintDayOff, onSelectionChange],
  );

  const beginPaint = useCallback(
    (cellSelection: CanvasCellSelection) => {
      if (!canWrite || !isPaintMode) {
        return;
      }
      setIsPainting(true);
      onPaintStart?.();
      paintCell(cellSelection);
    },
    [canWrite, isPaintMode, onPaintStart, paintCell],
  );

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!selection) {
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveSelection(0, 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveSelection(0, -1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1, 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1, 0);
    } else if ((event.key === "Enter" || event.key === " ") && canWrite && !pickerOpen) {
      event.preventDefault();
      if (isPaintMode) {
        onPaintStart?.();
        paintCell(selection);
        onPaintEnd?.();
      } else {
        openPickerForSelection(selection);
      }
    } else if (event.key === "Escape" && pickerOpen) {
      event.preventDefault();
      onPickerOpenChange(false);
    }
  };

  if (grid.rows.length === 0 || grid.dates.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">ยังไม่มีข้อมูลพนักงานในรอบนี้</p>;
  }

  return (
    <section className="rounded-lg border" aria-label="ตารางจัดเวรแก้ไขได้">
      <div
        ref={gridContainerRef}
        className="overflow-x-auto outline-none"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: โฟกัสกรอบตารางเพื่อลูกศรเลื่อนเซลล์
        tabIndex={0}
        role="application"
        aria-label="ตารางจัดเวร ใช้ลูกศรเลื่อนเซลล์"
        onKeyDown={handleKeyDown}
      >
        <table className="w-max min-w-full border-collapse text-xs" aria-label="ตารางจัดเวร">
          <thead>
            <tr className="bg-muted/40">
              <th className={STAFF_NAME_COLUMN_CLASS}>พนักงาน / กลุ่ม</th>
              <th className={OFF_QUOTA_HEADER_CLASS} title="โควตาวันหยุดต่อเดือน">
                OFF
              </th>
              {grid.dates.map((date) => {
                const header = dayHeader(date);
                const isWeekend = header.weekday === "ส" || header.weekday === "อา";
                const isHoliday = holidaySet.has(date);
                return (
                  <th
                    key={date}
                    className={`sticky top-0 z-10 border-b px-1.5 py-2 text-center font-medium ${isWeekend ? "bg-muted/70 text-muted-foreground" : "bg-muted/40"
                      } ${isHoliday ? "ring-1 ring-amber-400/60 ring-inset" : ""}`}
                    title={isHoliday ? "วันหยุดนักขัตฤกษ์" : undefined}
                  >
                    <div>{header.weekday}</div>
                    <div>{header.day}</div>
                  </th>
                );
              })}
              <th className={SUMMARY_HOURS_COLUMN_CLASS} title="ชั่วโมงทำงานรวม">
                ชม.
              </th>
              <th className={SUMMARY_OT_COLUMN_CLASS} title="OT สะสม">
                OT
              </th>
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => {
              if (row.kind === "group") {
                const groupKey = row.groupId ?? row.groupCode;
                const collapsed = collapsedGroups.has(groupKey);

                return (
                  <tr key={`group:${groupKey}`} className="bg-muted/20">
                    <th
                      colSpan={grid.dates.length + 4}
                      className="sticky left-0 border-b px-2 py-1.5 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="hover:bg-muted inline-flex items-center gap-1 rounded px-1 py-0.5"
                          onClick={() => onToggleGroup(groupKey)}
                          aria-expanded={!collapsed}
                          aria-label={`${collapsed ? "ขยาย" : "ยุบ"}กลุ่ม ${row.displayName}`}
                        >
                          {collapsed ? (
                            <ChevronRight className="size-4" aria-hidden />
                          ) : (
                            <ChevronDown className="size-4" aria-hidden />
                          )}
                        </button>

                        {renamingGroupId === row.groupId && row.groupId ? (
                          <Input
                            value={renameDraft}
                            onChange={(event) => setRenameDraft(event.target.value)}
                            onBlur={() => {
                              onRenameGroup(row.groupId!, renameDraft);
                              setRenamingGroupId(null);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && row.groupId) {
                                onRenameGroup(row.groupId, renameDraft);
                                setRenamingGroupId(null);
                              }
                            }}
                            className="h-7 max-w-xs text-xs"
                            autoFocus
                          />
                        ) : (
                          <button
                            type="button"
                            className="font-semibold hover:underline"
                            disabled={!canWrite || !row.groupId}
                            onDoubleClick={() => {
                              if (row.groupId && canWrite) {
                                setRenamingGroupId(row.groupId);
                                setRenameDraft(row.displayName);
                              }
                            }}
                          >
                            {row.displayName}
                          </button>
                        )}
                      </div>
                    </th>
                  </tr>
                );
              }

              if (row.kind === "section") {
                if (collapsedGroups.has(row.groupKey)) {
                  return null;
                }

                if (!showEmptySections && row.isEmpty) {
                  return null;
                }

                return (
                  <tr key={`section:${row.groupKey}:${row.section}`} className="bg-muted/10">
                    <th
                      colSpan={grid.dates.length + 4}
                      className="text-muted-foreground sticky left-0 border-b px-8 py-1 text-left text-[11px] font-medium"
                    >
                      {row.displayName}
                    </th>
                  </tr>
                );
              }

              const groupKey = row.row.staffGroupId ?? "__ungrouped__";
              if (collapsedGroups.has(groupKey)) {
                return null;
              }

              const rowTotals = computeCanvasStaffRowTotals(row.row.cells, shiftHoursMetaById);
              const dayOffQuota = staffDayOffQuotas.get(row.row.staffProfileId);

              return (
                <tr key={row.row.staffProfileId} className="hover:bg-muted/20">
                  <th className={STAFF_NAME_CELL_CLASS}>
                    <div className="truncate font-medium">{row.row.staffName}</div>
                    <div className="text-muted-foreground truncate text-[11px]">
                      {row.row.staffCode}
                    </div>
                  </th>
                  <td className={STAFF_OFF_QUOTA_CELL_CLASS}>
                    <Input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      spellCheck={false}
                      value={
                        dayOffQuota === null || dayOffQuota === undefined ? "" : String(dayOffQuota)
                      }
                      placeholder={String(defaultDayOffQuota)}
                      disabled={!canWrite}
                      aria-label={`โควตาวันหยุด ${row.row.staffName}`}
                      className="focus-visible:ring-ring/50 block h-full w-full min-h-0 rounded-none border-0 bg-transparent px-0 py-0 text-center text-xs tabular-nums shadow-none focus-visible:ring-1 md:text-xs"
                      onChange={(event) =>
                        onQuotaChange(
                          row.row.staffProfileId,
                          sanitizeDayOffQuotaInput(event.target.value),
                        )
                      }
                      onBlur={() => onQuotaBlur(row.row.staffProfileId)}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    />
                  </td>
                  {row.row.cells.map((cell, dateIndex) => {
                    const date = grid.dates[dateIndex]!;
                    const header = dayHeader(date);
                    const isWeekend = header.weekday === "ส" || header.weekday === "อา";
                    const isHoliday = holidaySet.has(date);
                    const isFocused =
                      selection?.staffProfileId === row.row.staffProfileId &&
                      selection.dateIndex === dateIndex;
                    const shiftMeta = cell.shiftCodeId
                      ? (shiftMetaById.get(cell.shiftCodeId) ?? null)
                      : null;
                    const cellHours = computeCanvasCellHours(
                      cell,
                      shiftMeta
                        ? { standardHours: shiftMeta.standardHours, otHours: shiftMeta.otHours }
                        : null,
                    );
                    const showOtMarker = hasCellOt(cellHours);
                    const displayValue = cell.isPlannedOff
                      ? (cell.nonWorkingDayKindCode ?? "OFF")
                      : cell.shiftCode;
                    const isLocked = isCanvasCellLocked({
                      isPinned: cell.isPinned,
                      plannedOffLocked: cell.plannedOffLocked,
                    });
                    const lockLabel = cell.plannedOffLocked ? " (ล็อกวันหยุด)" : " (ล็อกเซลล์)";
                    const hoursLabel =
                      cellHours.workHours > 0 ? ` · ${cellHours.workHours} ชม.` : "";
                    const otLabel = cellHours.otHours > 0 ? ` · OT ${cellHours.otHours} ชม.` : "";

                    const cellSelection = {
                      staffProfileId: row.row.staffProfileId,
                      dateIndex,
                    };

                    const cellButton = (
                      <button
                        type="button"
                        className="block min-h-[1.25rem] w-full"
                        disabled={!canWrite}
                        aria-haspopup={canWrite && !isPaintMode ? "dialog" : undefined}
                        aria-expanded={isFocused && pickerOpen && !isPaintMode ? true : undefined}
                        aria-label={
                          isPaintMode
                            ? `สลับวันหยุด ${row.row.staffName} วันที่ ${date}${displayValue ? `: ${displayValue}` : ""}${hoursLabel}${otLabel}${isLocked ? lockLabel : ""}`
                            : `รหัสเวร ${row.row.staffName} วันที่ ${date}${displayValue ? `: ${displayValue}` : ""}${hoursLabel}${otLabel}${isLocked ? lockLabel : ""}`
                        }
                        onClick={() => {
                          if (isPaintMode) {
                            return;
                          }
                          openPickerForSelection(cellSelection);
                        }}
                        onPointerDown={(event) => {
                          if (!isPaintMode || event.button !== 0) {
                            return;
                          }
                          event.preventDefault();
                          beginPaint(cellSelection);
                        }}
                        onPointerEnter={() => {
                          if (!isPainting || !isPaintMode) {
                            return;
                          }
                          paintCell(cellSelection);
                        }}
                      >
                        {displayValue ?? "—"}
                      </button>
                    );

                    return (
                      <td
                        key={`${row.row.staffProfileId}:${date}`}
                        className={canvasCellClassName({
                          shiftCode: cell.shiftCode,
                          shiftCodeMeta: shiftMeta,
                          isPlannedOff: cell.isPlannedOff,
                          isWeekend,
                          isHoliday,
                          isFocused,
                        })}
                      >
                        {isLocked ? <CanvasCellLockMarker /> : null}
                        {showOtMarker ? <CanvasCellOtMarker /> : null}
                        {isFocused && canWrite && !isPaintMode ? (
                          <ShiftCodePicker
                            open={pickerOpen}
                            onOpenChange={onPickerOpenChange}
                            anchor={cellButton}
                            staffName={row.row.staffName}
                            localDate={date}
                            suggestions={pickerSuggestions}
                            suggestionsLoading={pickerSuggestionsLoading}
                            isPinned={cell.isPinned}
                            isPlannedOff={cell.isPlannedOff}
                            plannedOffLocked={cell.plannedOffLocked}
                            canPin={Boolean(cell.shiftCodeId) && !cell.isPlannedOff}
                            onSelect={(action, options) =>
                              onApplyAction(row.row.staffProfileId, date, action, options)
                            }
                            onClearDayOff={onClearDayOff}
                            onLockPin={onLockPin}
                            onLockPlannedOff={onLockPlannedOff}
                            onUnlockPin={onUnlockPin}
                            onUnlockPlannedOff={onUnlockPlannedOff}
                            onRequestFocusReturn={() => gridContainerRef.current?.focus()}
                          />
                        ) : (
                          cellButton
                        )}
                      </td>
                    );
                  })}
                  <td className={STAFF_SUMMARY_HOURS_CELL_CLASS}>
                    {formatWorkloadNumber(rowTotals.workHours)}
                  </td>
                  <td className={STAFF_SUMMARY_OT_CELL_CLASS}>
                    {formatWorkloadNumber(rowTotals.otHours)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
