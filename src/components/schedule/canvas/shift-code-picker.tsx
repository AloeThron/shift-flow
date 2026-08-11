"use client";

import { Loader2, Lock, Moon, Zap } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
} from "@/components/ui/popover";
import type { ShiftCodeSuggestion, SuggestionAction } from "@/domain/schedule/suggest";

/** ตัวเลือกเมื่อเลือกจาก popup */
export type ShiftCodePickerSelectOptions = {
  readonly overrideReason?: string;
};

/** แถวใน listbox — แยก section และสถานะเลือกได้ */
type PickerListEntry = {
  readonly id: string;
  readonly suggestion: ShiftCodeSuggestion;
  readonly section: PickerSection;
  readonly selectable: boolean;
};

type PickerSection =
  "recommended" | "available" | "unavailable" | "override" | "plannedOff" | "swap";

/** พารามิเตอร์ popup เลือกรหัสเวร */
export type ShiftCodePickerProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly anchor: React.ReactElement;
  readonly staffName: string;
  readonly localDate: string;
  readonly suggestions: readonly ShiftCodeSuggestion[];
  readonly suggestionsLoading?: boolean;
  readonly isPinned: boolean;
  readonly isPlannedOff: boolean;
  readonly plannedOffLocked: boolean;
  readonly canPin: boolean;
  readonly onSelect: (action: SuggestionAction, options?: ShiftCodePickerSelectOptions) => void;
  readonly onClearDayOff: () => void;
  readonly onLockPin: () => void;
  readonly onLockPlannedOff: () => void;
  readonly onUnlockPin: () => void;
  readonly onUnlockPlannedOff: () => void;
  readonly onRequestFocusReturn?: () => void;
};

const SECTION_LABELS: Record<PickerSection, string> = {
  recommended: "แนะนำ",
  available: "ใช้ได้",
  unavailable: "ใช้ไม่ได้",
  override: "Override ด้วยเหตุผล",
  plannedOff: "วันหยุด/ลา",
  swap: "สลับ",
};

const SECTION_ORDER: readonly PickerSection[] = [
  "recommended",
  "available",
  "unavailable",
  "override",
  "plannedOff",
  "swap",
];

/** สร้าง id คงที่ต่อตัวเลือก */
function suggestionEntryId(suggestion: ShiftCodeSuggestion, index: number): string {
  if (suggestion.action.kind === "SHIFT_CODE") {
    return `shift:${suggestion.action.shiftCodeId}`;
  }
  if (suggestion.action.kind === "PLANNED_OFF") {
    return `off:${suggestion.action.nonWorkingDayKindId}`;
  }
  if (suggestion.action.kind === "SWAP_WITH") {
    return `swap:${suggestion.action.counterpartStaffId}`;
  }
  if (suggestion.action.kind === "OVERRIDE") {
    return `override:${suggestion.action.shiftCodeId}`;
  }
  if (suggestion.action.kind === "CLEAR") {
    return "clear";
  }
  return `unknown:${index}`;
}

/** ตรวจว่าตัวเลือกตรงคำค้น (รหัส canonical) */
function matchesSearchQuery(suggestion: ShiftCodeSuggestion, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  if (suggestion.labelTh.toLowerCase().includes(normalized)) {
    return true;
  }

  if (suggestion.action.kind === "SHIFT_CODE" || suggestion.action.kind === "OVERRIDE") {
    return suggestion.action.code.toLowerCase().includes(normalized);
  }

  if (suggestion.action.kind === "PLANNED_OFF") {
    return suggestion.action.code.toLowerCase().includes(normalized);
  }

  if (suggestion.action.kind === "SWAP_WITH") {
    return (
      suggestion.action.counterpartCode.toLowerCase().includes(normalized) ||
      "สลับ".includes(normalized)
    );
  }

  return "ล้าง".includes(normalized) || "clear".includes(normalized);
}

/** จัดกลุ่มตัวเลือกเป็น section ตามชนิด action */
function buildPickerSections(
  suggestions: readonly ShiftCodeSuggestion[],
): readonly PickerListEntry[] {
  const shiftCodes = suggestions.filter((entry) => entry.action.kind === "SHIFT_CODE");

  const recommendedIds = new Set(
    shiftCodes
      .filter((entry) => !entry.rank.blocked)
      .slice(0, 3)
      .map((entry, index) => suggestionEntryId(entry, index)),
  );

  const entries: PickerListEntry[] = [];

  for (const [index, suggestion] of suggestions.entries()) {
    if (suggestion.action.kind === "SHIFT_CODE") {
      const id = suggestionEntryId(suggestion, index);
      const section: PickerSection = suggestion.rank.blocked
        ? "unavailable"
        : recommendedIds.has(id)
          ? "recommended"
          : "available";

      entries.push({
        id,
        suggestion,
        section,
        selectable: !suggestion.rank.blocked,
      });
      continue;
    }

    if (suggestion.action.kind === "OVERRIDE") {
      entries.push({
        id: suggestionEntryId(suggestion, index),
        suggestion,
        section: "override",
        selectable: true,
      });
      continue;
    }

    if (suggestion.action.kind === "PLANNED_OFF") {
      entries.push({
        id: suggestionEntryId(suggestion, index),
        suggestion,
        section: "plannedOff",
        selectable: true,
      });
      continue;
    }

    if (suggestion.action.kind === "SWAP_WITH") {
      entries.push({
        id: suggestionEntryId(suggestion, index),
        suggestion,
        section: "swap",
        selectable: !suggestion.rank.blocked,
      });
      continue;
    }

    if (suggestion.action.kind === "CLEAR") {
      entries.push({
        id: suggestionEntryId(suggestion, index),
        suggestion,
        section: "available",
        selectable: true,
      });
      continue;
    }

    entries.push({
      id: suggestionEntryId(suggestion, index),
      suggestion,
      section: "available",
      selectable: true,
    });
  }

  return entries;
}

/** แสดงวันที่แบบอ่านง่าย */
function formatPickerDate(localDate: string): string {
  const parsed = new Date(`${localDate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return localDate;
  }

  return parsed.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const SKELETON_ROW_COUNT = 4;

/** skeleton แถวตัวเลือกระหว่างจัดอันดับ */
function PickerOptionSkeleton() {
  return (
    <div className="flex w-full flex-col gap-1 rounded-lg px-2 py-1.5" aria-hidden>
      <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
      <div className="bg-muted/70 h-3 w-1/2 animate-pulse rounded" />
    </div>
  );
}

/** แถวตัวเลือกใน listbox */
function PickerOptionRow({
  entry,
  active,
  onSelect,
  onRequestOverride,
  onHover,
}: {
  readonly entry: PickerListEntry;
  readonly active: boolean;
  readonly onSelect: (action: SuggestionAction) => void;
  readonly onRequestOverride: (entry: PickerListEntry) => void;
  readonly onHover: () => void;
}) {
  const { suggestion } = entry;
  const isBlocked = !entry.selectable;

  return (
    <div
      id={entry.id}
      role="option"
      aria-selected={active}
      aria-disabled={isBlocked}
      className={`flex w-full flex-col gap-0.5 rounded-lg px-2 py-1.5 text-left text-sm outline-none ${active ? "bg-accent text-accent-foreground" : ""
        } ${isBlocked ? "text-muted-foreground cursor-not-allowed opacity-70" : "hover:bg-accent/70 cursor-pointer"}`}
      onMouseEnter={onHover}
      onClick={() => {
        if (!entry.selectable) {
          return;
        }
        if (suggestion.action.kind === "OVERRIDE") {
          onRequestOverride(entry);
          return;
        }
        onSelect(suggestion.action);
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{suggestion.labelTh}</span>
        <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
          {suggestion.action.kind === "SHIFT_CODE" || suggestion.action.kind === "OVERRIDE" ? (
            <span>{suggestion.standardHours} ชม.</span>
          ) : null}
          {suggestion.otHours > 0 ? (
            <span
              className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1 py-0.5 text-amber-800 dark:text-amber-200"
              title={`OT ${suggestion.otHours} ชม.`}
            >
              <Zap className="size-3" aria-hidden />
              OT
            </span>
          ) : null}
          {suggestion.isNightShift ? (
            <span
              className="inline-flex items-center gap-0.5 rounded bg-slate-900/10 px-1 py-0.5 text-slate-900 dark:bg-slate-100/10 dark:text-slate-100"
              title="เวรดึก"
            >
              <Moon className="size-3" aria-hidden />
              ดึก
            </span>
          ) : null}
        </span>
      </div>

      {isBlocked && suggestion.blockingReasonsTh.length > 0 ? (
        <p className="text-destructive text-xs">{suggestion.blockingReasonsTh.join(" · ")}</p>
      ) : null}

      {!isBlocked && suggestion.warningsTh.length > 0 ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {suggestion.warningsTh.join(" · ")}
        </p>
      ) : null}

      {suggestion.action.kind === "OVERRIDE" && suggestion.blockingReasonsTh.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          จะละเมิด: {suggestion.blockingReasonsTh.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

/** แถบท้าย popup — ล็อกเซลล์/วันหยุดและลบวันหยุด */
function PickerActionFooter({
  canPin,
  isPlannedOff,
  onClearDayOff,
  onLockPin,
  onLockPlannedOff,
}: {
  readonly canPin: boolean;
  readonly isPlannedOff: boolean;
  readonly onClearDayOff: () => void;
  readonly onLockPin: () => void;
  readonly onLockPlannedOff: () => void;
}) {
  if (!canPin && !isPlannedOff) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap gap-2 border-t px-3 py-2"
      role="group"
      aria-label="การจัดการเซลล์"
    >
      {canPin ? (
        <Button type="button" size="sm" variant="outline" onClick={onLockPin}>
          ล็อกเซลล์
        </Button>
      ) : null}
      {isPlannedOff ? (
        <>
          <Button type="button" size="sm" variant="outline" onClick={onClearDayOff}>
            ลบวันหยุด
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onLockPlannedOff}>
            ล็อกวันหยุด
          </Button>
        </>
      ) : null}
    </div>
  );
}

/** popup เลือกรหัสเวร — listbox แบ่งแนะนำ/ใช้ได้/ใช้ไม่ได้/วันหยุด/สลับ/override */
export function ShiftCodePicker({
  open,
  onOpenChange,
  anchor,
  staffName,
  localDate,
  suggestions,
  suggestionsLoading = false,
  isPinned,
  isPlannedOff,
  plannedOffLocked,
  canPin,
  onSelect,
  onClearDayOff,
  onLockPin,
  onLockPlannedOff,
  onUnlockPin,
  onUnlockPlannedOff,
  onRequestFocusReturn,
}: ShiftCodePickerProps) {
  const listboxId = useId();
  const overrideReasonId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const overrideReasonRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [pendingOverrideEntry, setPendingOverrideEntry] = useState<PickerListEntry | null>(null);
  const [overrideReasonDraft, setOverrideReasonDraft] = useState("");

  const isLocked = isPinned || plannedOffLocked;

  const sections = useMemo(() => buildPickerSections(suggestions), [suggestions]);

  const filteredEntries = useMemo(
    () => sections.filter((entry) => matchesSearchQuery(entry.suggestion, searchQuery)),
    [searchQuery, sections],
  );

  const selectableIndices = useMemo(
    () =>
      filteredEntries
        .map((entry, index) => (entry.selectable ? index : -1))
        .filter((index) => index >= 0),
    [filteredEntries],
  );

  const activeEntry = filteredEntries[activeIndex] ?? null;

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setActiveIndex(0);
      setPendingOverrideEntry(null);
      setOverrideReasonDraft("");
      return;
    }

    const firstSelectable = selectableIndices[0] ?? 0;
    setActiveIndex(firstSelectable);
  }, [open, selectableIndices, suggestions]);

  useEffect(() => {
    if (activeIndex >= filteredEntries.length) {
      setActiveIndex(Math.max(0, filteredEntries.length - 1));
    }
  }, [activeIndex, filteredEntries.length]);

  useEffect(() => {
    if (pendingOverrideEntry) {
      overrideReasonRef.current?.focus();
    }
  }, [pendingOverrideEntry]);

  const moveActive = useCallback(
    (delta: number) => {
      if (filteredEntries.length === 0) {
        return;
      }

      const selectable =
        selectableIndices.length > 0 ? selectableIndices : filteredEntries.map((_, index) => index);

      const currentPos = selectable.indexOf(activeIndex);
      const startPos = currentPos >= 0 ? currentPos : 0;
      const nextPos = (startPos + delta + selectable.length) % selectable.length;
      setActiveIndex(selectable[nextPos] ?? 0);
    },
    [activeIndex, filteredEntries.length, selectableIndices],
  );

  const confirmOverride = useCallback(() => {
    const reason = overrideReasonDraft.trim();
    if (!pendingOverrideEntry || !reason) {
      return;
    }

    onSelect(pendingOverrideEntry.suggestion.action, { overrideReason: reason });
    setPendingOverrideEntry(null);
    setOverrideReasonDraft("");
    onOpenChange(false);
  }, [onOpenChange, onSelect, overrideReasonDraft, pendingOverrideEntry]);

  const handleSelectActive = useCallback(() => {
    if (!activeEntry?.selectable) {
      return;
    }

    if (activeEntry.suggestion.action.kind === "OVERRIDE") {
      setPendingOverrideEntry(activeEntry);
      setOverrideReasonDraft("");
      return;
    }

    onSelect(activeEntry.suggestion.action);
    onOpenChange(false);
  }, [activeEntry, onOpenChange, onSelect]);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      handleSelectActive();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
    }
  };

  const handleListboxKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      handleSelectActive();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
    }
  };

  const groupedSections = useMemo(() => {
    const groups: Array<{
      key: PickerSection;
      entries: Array<{ entry: PickerListEntry; index: number }>;
    }> = [];

    for (const key of SECTION_ORDER) {
      const entries = filteredEntries
        .map((entry, index) => ({ entry, index }))
        .filter(
          ({ entry }) =>
            entry.section === key &&
            (key !== "available" || entry.suggestion.action.kind !== "CLEAR"),
        );

      if (entries.length > 0) {
        groups.push({ key, entries });
      }
    }

    const clearEntries = filteredEntries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.suggestion.action.kind === "CLEAR");

    if (clearEntries.length > 0) {
      const availableGroup = groups.find((group) => group.key === "available");
      if (availableGroup) {
        availableGroup.entries.push(...clearEntries);
      } else {
        groups.push({ key: "available", entries: clearEntries });
      }
    }

    return groups;
  }, [filteredEntries]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>{anchor}</PopoverAnchor>
      <PopoverContent
        className="w-80 p-0"
        align="start"
        side="bottom"
        role="dialog"
        aria-label={`เลือกรหัสเวร ${staffName}`}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (!isLocked && !pendingOverrideEntry) {
            searchRef.current?.focus();
          }
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRequestFocusReturn?.();
        }}
        onEscapeKeyDown={() => {
          if (pendingOverrideEntry) {
            setPendingOverrideEntry(null);
            setOverrideReasonDraft("");
            return;
          }
          onOpenChange(false);
        }}
      >
        <div className="border-b px-3 py-2.5">
          <PopoverHeader>
            <PopoverTitle>{staffName}</PopoverTitle>
            <PopoverDescription>{formatPickerDate(localDate)}</PopoverDescription>
          </PopoverHeader>
        </div>

        {isLocked ? (
          <div className="space-y-3 px-3 py-3">
            <div className="text-muted-foreground flex items-start gap-2 text-sm">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="space-y-2">
                {isPinned ? <p>เซลล์นี้ถูกล็อก — ปลดล็อกก่อนเปลี่ยนรหัสเวร</p> : null}
                {plannedOffLocked ? <p>วันหยุดนี้ถูกล็อก — ปลดล็อกก่อนแก้ไข</p> : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {isPinned ? (
                <Button type="button" size="sm" variant="secondary" onClick={onUnlockPin}>
                  ปลดล็อกเซลล์
                </Button>
              ) : null}
              {plannedOffLocked ? (
                <Button type="button" size="sm" variant="secondary" onClick={onUnlockPlannedOff}>
                  ปลดล็อกวันหยุด
                </Button>
              ) : null}
            </div>
          </div>
        ) : pendingOverrideEntry ? (
          <div className="space-y-3 px-3 py-3">
            <p className="text-sm font-medium">
              Override:{" "}
              {pendingOverrideEntry.suggestion.action.kind === "OVERRIDE"
                ? pendingOverrideEntry.suggestion.action.code
                : pendingOverrideEntry.suggestion.labelTh}
            </p>
            <div className="space-y-2">
              <Label htmlFor={overrideReasonId}>เหตุผล override</Label>
              <Input
                ref={overrideReasonRef}
                id={overrideReasonId}
                value={overrideReasonDraft}
                onChange={(event) => setOverrideReasonDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    confirmOverride();
                    return;
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setPendingOverrideEntry(null);
                    setOverrideReasonDraft("");
                  }
                }}
                placeholder="ระบุเหตุผล…"
                aria-required
                className="h-8 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={confirmOverride}
                disabled={!overrideReasonDraft.trim()}
              >
                ยืนยัน override
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setPendingOverrideEntry(null);
                  setOverrideReasonDraft("");
                }}
              >
                ยกเลิก
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b px-3 py-2">
              <Input
                ref={searchRef}
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setActiveIndex(selectableIndices[0] ?? 0);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="ค้นหารหัสเวร…"
                aria-label="ค้นหารหัสเวร"
                aria-controls={listboxId}
                aria-activedescendant={activeEntry ? activeEntry.id : undefined}
                className="h-8 text-sm"
                autoComplete="off"
              />
            </div>

            <div
              id={listboxId}
              role="listbox"
              aria-label="ตัวเลือกรหัสเวร"
              aria-busy={suggestionsLoading}
              aria-activedescendant={suggestionsLoading ? undefined : activeEntry?.id}
              tabIndex={-1}
              className="max-h-72 overflow-y-auto px-1 py-1.5 outline-none"
              onKeyDown={handleListboxKeyDown}
            >
              {suggestionsLoading ? (
                <>
                  <div
                    role="status"
                    aria-live="polite"
                    className="text-muted-foreground flex items-center gap-2 px-2 py-2 text-sm"
                  >
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                    กำลังจัดอันดับรหัสเวร…
                  </div>
                  <div className="space-y-0.5">
                    {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
                      <PickerOptionSkeleton key={`skeleton-${index}`} />
                    ))}
                  </div>
                </>
              ) : groupedSections.length === 0 ? (
                <p className="text-muted-foreground px-2 py-4 text-center text-sm">
                  ไม่พบรหัสที่ตรงกับ &quot;{searchQuery.trim()}&quot;
                </p>
              ) : (
                groupedSections.map((group) => (
                  <div key={group.key} role="group" aria-label={SECTION_LABELS[group.key]}>
                    <p className="text-muted-foreground px-2 py-1 text-xs font-semibold tracking-wide uppercase">
                      {SECTION_LABELS[group.key]}
                    </p>
                    <div className="space-y-0.5">
                      {group.entries.map(({ entry, index }) => (
                        <PickerOptionRow
                          key={entry.id}
                          entry={entry}
                          active={index === activeIndex}
                          onSelect={(action) => {
                            onSelect(action);
                            onOpenChange(false);
                          }}
                          onRequestOverride={(overrideEntry) => {
                            setPendingOverrideEntry(overrideEntry);
                            setOverrideReasonDraft("");
                          }}
                          onHover={() => setActiveIndex(index)}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <PickerActionFooter
              canPin={canPin}
              isPlannedOff={isPlannedOff}
              onClearDayOff={onClearDayOff}
              onLockPin={onLockPin}
              onLockPlannedOff={onLockPlannedOff}
            />
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
