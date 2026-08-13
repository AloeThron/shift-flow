"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  clearCanvasPlannedDayOffAction,
  commitCanvasChangesAction,
  getScheduleCanvasAction,
  type ScheduleCanvasPayload,
  setCanvasPlannedDayOffAction,
  toggleCanvasCellPinAction,
  updateCanvasCellAction,
} from "@/actions/schedule/canvas";
import { runBalanceSolverAction, runDayOffSolverAction } from "@/actions/schedule/solver";
import { updateStaffGroupDisplayNameAction } from "@/actions/schedule/staff-groups";
import { getWorkloadStatsAction } from "@/actions/schedule/workload";
import {
  PublishShareDialog,
  type PublishShareDialogProps,
} from "@/components/schedule/publish-share-dialog";
import {
  recomputeWorkloadStatsFromDraft,
  type WorkloadStatsSnapshot,
} from "@/domain/optimize/fairness/workload-stats";
import {
  buildScheduleCanvasGrid,
  canvasStaffRows,
  type ScheduleCanvasCell,
} from "@/domain/schedule/canvas-grid";
import {
  isValidDayOffQuotaValue,
  staffDayOffQuotaMapFromRecord,
  staffDayOffQuotasForSolver,
  validateStaffDayOffQuotasComplete,
} from "@/domain/schedule/day-off-quota-draft";
import { analyzeFeasibility } from "@/domain/schedule/feasibility";
import type { CanvasPlannedOffChangeInput } from "@/domain/schedule/schemas";
import {
  buildSuggestionBaseline,
  rankShiftCodeCandidates,
  type SameDayAssignmentRef,
  type ShiftCodeSuggestion,
  type SuggestionAction,
} from "@/domain/schedule/suggest";
import type { ScheduleEngineInput, ValidationResult } from "@/domain/schedule/types";
import { validateIncremental } from "@/domain/schedule/validate";
import { buildDemandSlots } from "@/lib/scheduling/build-demand-slots";
import {
  gridToEngineAssignments,
  gridToPlannedOff,
  type ShiftCodeOption,
} from "@/lib/scheduling/load-canvas-draft";

import { shiftCodeMetaById } from "./cell-style";
import { computeScheduleAchievementStatus } from "./schedule-achievement";
import { type CanvasCellSelection, ScheduleCanvasGrid } from "./schedule-canvas-grid";
import { ScheduleCanvasToolbar } from "./schedule-canvas-toolbar";
import { ScheduleStatusPanel } from "./schedule-status-panel";
import { ScheduleStepBar } from "./schedule-step-bar";
import {
  deriveScheduleStepStates,
  resolveCanvasInteractionMode,
  resolveInitialStep,
  type ScheduleStepId,
} from "./schedule-steps";
import type { ShiftCodePickerSelectOptions } from "./shift-code-picker";
import { buildDepartmentLabelMap, buildStaffLabelMap } from "./status-issue-format";

const SHOW_EMPTY_SECTIONS_STORAGE_KEY = "shift-flow:canvas:show-empty-sections";

/** สร้าง map โควตาจาก payload เริ่มต้น */
function quotaStateFromPayload(payload: ScheduleCanvasPayload): Map<string, number | null> {
  return staffDayOffQuotaMapFromRecord(payload.staffDayOffQuotas ?? {});
}

/** ประกอบ engine input จาก grid ปัจจุบัน */
function buildEngineInputFromGrid(
  base: ScheduleEngineInput,
  grid: ScheduleCanvasPayload["grid"],
  shiftCodes: readonly ShiftCodeOption[],
  timezone: string,
  nonWorkingDayKinds: ScheduleCanvasPayload["nonWorkingDayKinds"],
  defaultOffKindId: string | null,
): ScheduleEngineInput {
  const shiftById = shiftCodeMetaById(shiftCodes);
  return {
    ...base,
    assignments: gridToEngineAssignments(grid, shiftById, timezone),
    plannedNonWorkingDays: gridToPlannedOff(grid, nonWorkingDayKinds, defaultOffKindId),
  };
}

/** ข้อมูล publish/share จาก server */
export type ScheduleCanvasPublishShareConfig = Omit<
  PublishShareDialogProps,
  "achievement" | "draftId" | "draftVersionId" | "cycleId" | "busy"
> & {
  readonly canPublish: boolean;
  readonly canShare: boolean;
};

/** สรุปผลรันเกลี่ยงาน Stage B ล่าสุด */
function BalanceRunSummary({ summary }: { summary: Record<string, unknown> }) {
  const filledCells = typeof summary.filledCells === "number" ? summary.filledCells : null;
  const skippedCells = typeof summary.skippedCells === "number" ? summary.skippedCells : null;
  const unfilledMandatory =
    typeof summary.unfilledMandatorySlots === "number" ? summary.unfilledMandatorySlots : null;
  const blockingIssues = Array.isArray(summary.blockingIssues)
    ? (summary.blockingIssues as { messageTh?: string }[])
    : [];

  const parts: string[] = [];
  if (filledCells !== null) {
    parts.push(`เติม ${filledCells} เซลล์`);
  }
  if (skippedCells !== null && skippedCells > 0) {
    parts.push(`ข้าม ${skippedCells} เซลล์`);
  }
  if (unfilledMandatory !== null && unfilledMandatory > 0) {
    parts.push(`slot บังคับค้าง ${unfilledMandatory}`);
  }

  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
      <p className="font-medium">ผลเกลี่ยงานล่าสุด</p>
      {parts.length > 0 ? (
        <p className="text-muted-foreground mt-0.5">{parts.join(" · ")}</p>
      ) : null}
      {blockingIssues.length > 0 ? (
        <ul className="text-muted-foreground mt-1 max-h-24 list-inside list-disc overflow-y-auto text-xs">
          {blockingIssues.slice(0, 5).map((issue) => (
            <li key={issue.messageTh ?? "issue"}>{issue.messageTh ?? "มีปัญหา feasibility"}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** คอมโพเนนต์หลัก canvas จัดเวร */
export function ScheduleCanvas({
  initial,
  initialWorkloadSnapshot = null,
  publishShare = null,
}: {
  initial: ScheduleCanvasPayload;
  initialWorkloadSnapshot?: WorkloadStatsSnapshot | null;
  publishShare?: ScheduleCanvasPublishShareConfig | null;
}) {
  const [payload, setPayload] = useState(initial);
  const [grid, setGrid] = useState(initial.grid);
  const [staffDayOffQuotas, setStaffDayOffQuotas] = useState(() => quotaStateFromPayload(initial));
  const [dirtyQuotaStaffIds, setDirtyQuotaStaffIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [optimisticVersion, setOptimisticVersion] = useState(initial.optimisticVersion);
  const [selection, setSelection] = useState<CanvasCellSelection | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(new Set());
  const [showEmptySections, setShowEmptySections] = useState(true);
  const [activeStep, setActiveStep] = useState<ScheduleStepId>("TIDY");
  const [paintKindId, setPaintKindId] = useState<string | null>(initial.defaultOffKindId);
  const initialStepResolvedRef = useRef(false);
  const paintVisitedRef = useRef<Set<string>>(new Set());
  const paintPendingRef = useRef<CanvasPlannedOffChangeInput[]>([]);
  const [validationScope, setValidationScope] = useState<{
    changedStaffIds: string[];
    changedDates: string[];
  }>({ changedStaffIds: [], changedDates: [] });
  const [baseWorkloadSnapshot, setBaseWorkloadSnapshot] = useState<WorkloadStatsSnapshot | null>(
    initialWorkloadSnapshot,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [balanceResultSummary, setBalanceResultSummary] = useState<Record<string, unknown> | null>(
    null,
  );
  const [pickerSuggestions, setPickerSuggestions] = useState<readonly ShiftCodeSuggestion[]>([]);
  const [pickerSuggestionsLoading, setPickerSuggestionsLoading] = useState(false);
  const pickerSuggestionsRequestRef = useRef(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const stored = window.localStorage.getItem(SHOW_EMPTY_SECTIONS_STORAGE_KEY);
    if (stored === "0") {
      setShowEmptySections(false);
    }
  }, []);

  const engineInput = useMemo(() => {
    const base = buildEngineInputFromGrid(
      payload.engineInput,
      grid,
      payload.shiftCodes,
      payload.timezone,
      payload.nonWorkingDayKinds,
      payload.defaultOffKindId,
    );

    return {
      ...base,
      staffDayOffQuotas: staffDayOffQuotasForSolver(staffDayOffQuotas),
    };
  }, [
    grid,
    payload.defaultOffKindId,
    payload.engineInput,
    payload.nonWorkingDayKinds,
    payload.shiftCodes,
    payload.timezone,
    staffDayOffQuotas,
  ]);

  const validation: ValidationResult = useMemo(() => {
    if (validationScope.changedStaffIds.length === 0 && validationScope.changedDates.length === 0) {
      return validateIncremental(engineInput, {
        changedStaffIds: engineInput.staff.map((member) => member.id),
        changedDates: grid.dates as string[],
      });
    }

    return validateIncremental(engineInput, validationScope);
  }, [engineInput, grid.dates, validationScope]);

  const demandSlots = useMemo(() => buildDemandSlots(engineInput), [engineInput]);

  const coverageIssues = useMemo(
    () => analyzeFeasibility(engineInput, demandSlots).issues,
    [engineInput, demandSlots],
  );

  const staffLabelById = useMemo(() => buildStaffLabelMap(grid), [grid]);
  const departmentLabelById = useMemo(
    () => buildDepartmentLabelMap(payload.departments),
    [payload.departments],
  );
  const shiftCodeLabelById = useMemo(
    () => new Map(payload.shiftCodes.map((code) => [code.id, code.code])),
    [payload.shiftCodes],
  );

  /** snapshot ภาระงานอัปเดตสดจาก draft ปัจจุบัน */
  const liveWorkloadSnapshot = useMemo(() => {
    if (!baseWorkloadSnapshot) {
      return null;
    }

    const shiftById = shiftCodeMetaById(payload.shiftCodes);
    return recomputeWorkloadStatsFromDraft(baseWorkloadSnapshot, {
      engineInput: payload.engineInput,
      currentCycleAssignments: gridToEngineAssignments(grid, shiftById, payload.timezone),
      currentCyclePlannedOff: gridToPlannedOff(
        grid,
        payload.nonWorkingDayKinds,
        payload.defaultOffKindId,
      ),
    });
  }, [
    baseWorkloadSnapshot,
    grid,
    payload.defaultOffKindId,
    payload.engineInput,
    payload.nonWorkingDayKinds,
    payload.shiftCodes,
    payload.timezone,
  ]);

  /** เกณฑ์พร้อมเผยแพร่จาก draft สด */
  const achievement = useMemo(
    () => computeScheduleAchievementStatus(validation, coverageIssues, liveWorkloadSnapshot),
    [validation, coverageIssues, liveWorkloadSnapshot],
  );

  const publishedVersionNumber = publishShare?.publishedVersionNumber ?? null;

  /** สถานะ done ต่อขั้นตอนจัดตาราง */
  const stepStates = useMemo(
    () =>
      deriveScheduleStepStates({
        grid,
        validation,
        achievement,
        showEmptySections,
        publishedVersionNumber,
      }),
    [achievement, grid, publishedVersionNumber, showEmptySections, validation],
  );

  useEffect(() => {
    if (initialStepResolvedRef.current) {
      return;
    }
    initialStepResolvedRef.current = true;
    setActiveStep(resolveInitialStep(stepStates));
  }, [stepStates]);

  const interactionMode = resolveCanvasInteractionMode(payload.canWrite, activeStep, validation);

  useEffect(() => {
    if (interactionMode === "PAINT_OFF" && pickerOpen) {
      setPickerOpen(false);
    }
  }, [interactionMode, pickerOpen]);

  const publishShareActions = useMemo(() => {
    if (!publishShare || (!publishShare.canPublish && !publishShare.canShare)) {
      return null;
    }

    return (
      <PublishShareDialog
        cycleId={payload.cycleId}
        draftId={payload.draftId}
        draftVersionId={payload.draftVersionId}
        achievement={achievement}
        busy={pending}
        {...publishShare}
      />
    );
  }, [
    achievement,
    pending,
    payload.cycleId,
    payload.draftId,
    payload.draftVersionId,
    publishShare,
  ]);

  const selectedStaffRow = useMemo(() => {
    if (!selection) {
      return null;
    }

    for (const row of grid.rows) {
      if (row.kind === "staff" && row.row.staffProfileId === selection.staffProfileId) {
        return row.row;
      }
    }
    return null;
  }, [grid.rows, selection]);

  const selectedCell = useMemo(() => {
    if (!selection) {
      return null;
    }
    return selectedStaffRow?.cells[selection.dateIndex] ?? null;
  }, [selectedStaffRow, selection]);

  const selectedDate = selection ? grid.dates[selection.dateIndex] : undefined;

  const isSelectedCellLocked =
    (selectedCell?.isPinned ?? false) || (selectedCell?.plannedOffLocked ?? false);

  /** จัดอันดับรหัสเวรหลัง paint — ไม่บล็อกการเปิด popup */
  useEffect(() => {
    if (!pickerOpen) {
      setPickerSuggestions([]);
      setPickerSuggestionsLoading(false);
      return;
    }

    const defaultOffKindId = payload.defaultOffKindId;
    if (!selection || !selectedDate || !defaultOffKindId || isSelectedCellLocked) {
      setPickerSuggestions([]);
      setPickerSuggestionsLoading(false);
      return;
    }

    const staffProfileId = selection.staffProfileId;

    const requestId = ++pickerSuggestionsRequestRef.current;
    setPickerSuggestionsLoading(true);
    setPickerSuggestions([]);

    let cancelled = false;
    let frame1 = 0;
    let frame2 = 0;

    frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => {
        if (cancelled || requestId !== pickerSuggestionsRequestRef.current) {
          return;
        }

        const baseline = buildSuggestionBaseline(engineInput, staffProfileId, selectedDate);
        const sameDayAssignments: SameDayAssignmentRef[] = grid.rows.flatMap((row) => {
          if (row.kind !== "staff" || row.row.staffProfileId === staffProfileId) {
            return [];
          }

          const cell = row.row.cells[selection.dateIndex];
          if (!cell?.shiftCodeId || cell.isPlannedOff || !cell.shiftCode) {
            return [];
          }

          return [
            {
              staffId: row.row.staffProfileId,
              staffDisplayName: row.row.staffName,
              shiftCodeId: cell.shiftCodeId,
              code: cell.shiftCode,
            },
          ];
        });

        const suggestions = rankShiftCodeCandidates(engineInput, {
          staffId: staffProfileId,
          localDate: selectedDate,
          baseline,
          nonWorkingDayKinds: payload.nonWorkingDayKinds.map((kind) => ({
            id: kind.id,
            code: kind.code,
            displayName: kind.displayName,
          })),
          defaultOffKindId,
          staffGroupId: selectedStaffRow?.staffGroupId ?? undefined,
          sameDayAssignments,
        });

        if (!cancelled && requestId === pickerSuggestionsRequestRef.current) {
          setPickerSuggestions(suggestions);
          setPickerSuggestionsLoading(false);
        }
      });
    });

    return () => {
      cancelled = true;
      pickerSuggestionsRequestRef.current += 1;
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
    };
  }, [
    engineInput,
    isSelectedCellLocked,
    payload.defaultOffKindId,
    payload.nonWorkingDayKinds,
    pickerOpen,
    selectedDate,
    selectedStaffRow?.staffGroupId,
    selection,
    grid.rows,
  ]);

  const handleOpenPicker = useCallback((cellSelection: CanvasCellSelection) => {
    setSelection(cellSelection);
    setPickerOpen(true);
  }, []);

  useEffect(() => {
    if (initialWorkloadSnapshot) {
      return;
    }

    void getWorkloadStatsAction().then((result) => {
      if (result.ok) {
        setBaseWorkloadSnapshot(result.data.snapshot);
      }
    });
  }, [initialWorkloadSnapshot]);

  const refreshFromServer = useCallback(async () => {
    const result = await getScheduleCanvasAction(payload.cycleId);
    if (result.ok) {
      setPayload(result.data);
      setGrid(result.data.grid);
      setStaffDayOffQuotas(quotaStateFromPayload(result.data));
      setDirtyQuotaStaffIds(new Set());
      setOptimisticVersion(result.data.optimisticVersion);
    } else {
      setErrorMessage(result.error);
    }
  }, [payload.cycleId]);

  const applyLocalPlannedOffChange = useCallback(
    (change: CanvasPlannedOffChangeInput) => {
      const kindById = new Map(payload.nonWorkingDayKinds.map((kind) => [kind.id, kind]));

      setGrid((current) => {
        const staff = current.rows
          .filter((row) => row.kind === "staff")
          .map((row) => ({
            id: row.row.staffProfileId,
            staffCode: row.row.staffCode,
            displayName: row.row.staffName,
            staffGroupId: row.row.staffGroupId,
            staffGroupSection: row.row.staffGroupSection,
            rowOrder: row.row.rowOrder,
          }));

        const assignments = current.rows.flatMap((row) => {
          if (row.kind !== "staff") {
            return [];
          }
          return row.row.cells
            .map((cell, index) => ({
              id: cell.assignmentId ?? `${row.row.staffProfileId}:${current.dates[index]}`,
              staffProfileId: row.row.staffProfileId,
              localDate: current.dates[index]!,
              shiftCodeId: cell.shiftCodeId,
              shiftCode: cell.shiftCode,
              isPinned: cell.isPinned,
              plannedOtHours: cell.plannedOtHours,
            }))
            .filter((item) => item.shiftCodeId);
        });

        const plannedOff = current.rows.flatMap((row) => {
          if (row.kind !== "staff") {
            return [];
          }
          return row.row.cells
            .map((cell, index) => ({
              staffProfileId: row.row.staffProfileId,
              localDate: current.dates[index]!,
              locked: cell.plannedOffLocked,
              kindCode: cell.nonWorkingDayKindCode ?? "OFF",
            }))
            .filter((_, index) => row.row.cells[index]?.isPlannedOff);
        });

        const nextPlannedOff = plannedOff.filter(
          (item) =>
            !(item.staffProfileId === change.staffProfileId && item.localDate === change.localDate),
        );

        let nextAssignments = assignments;

        if (change.action === "set") {
          const kind = kindById.get(change.nonWorkingDayKindId ?? "");
          const blocksScheduling = kind?.blocksScheduling ?? true;
          if (blocksScheduling) {
            nextAssignments = assignments.filter(
              (item) =>
                !(
                  item.staffProfileId === change.staffProfileId &&
                  item.localDate === change.localDate
                ),
            );
          }
          nextPlannedOff.push({
            staffProfileId: change.staffProfileId,
            localDate: change.localDate,
            locked: change.locked ?? false,
            kindCode: kind?.code ?? "OFF",
          });
        }

        return buildScheduleCanvasGrid({
          periodStart: payload.periodStart,
          periodEnd: payload.periodEnd,
          holidayDates: current.holidayDates,
          staffGroups: payload.staffGroups,
          staff,
          assignments: nextAssignments,
          plannedOff: nextPlannedOff,
        });
      });

      setValidationScope({
        changedStaffIds: [change.staffProfileId],
        changedDates: [change.localDate],
      });
    },
    [payload.nonWorkingDayKinds, payload.periodEnd, payload.periodStart, payload.staffGroups],
  );

  const handlePaintStart = useCallback(() => {
    paintVisitedRef.current.clear();
    paintPendingRef.current = [];
  }, []);

  const handlePaintDayOff = useCallback(
    (staffProfileId: string, dateIndex: number) => {
      if (
        !payload.canWrite ||
        resolveCanvasInteractionMode(payload.canWrite, activeStep, validation) !== "PAINT_OFF" ||
        !paintKindId
      ) {
        return;
      }

      const localDate = grid.dates[dateIndex];
      if (!localDate) {
        return;
      }

      const visitKey = `${staffProfileId}:${localDate}`;
      if (paintVisitedRef.current.has(visitKey)) {
        return;
      }
      paintVisitedRef.current.add(visitKey);

      let cell: ScheduleCanvasCell | null = null;
      for (const row of grid.rows) {
        if (row.kind === "staff" && row.row.staffProfileId === staffProfileId) {
          cell = row.row.cells[dateIndex] ?? null;
          break;
        }
      }

      if (!cell || cell.isPinned || cell.plannedOffLocked) {
        return;
      }

      const selectedKind = payload.nonWorkingDayKinds.find((kind) => kind.id === paintKindId);
      if (!selectedKind) {
        return;
      }

      const change: CanvasPlannedOffChangeInput =
        cell.isPlannedOff && cell.nonWorkingDayKindCode === selectedKind.code
          ? {
              staffProfileId,
              localDate,
              action: "clear",
            }
          : {
              staffProfileId,
              localDate,
              action: "set",
              nonWorkingDayKindId: paintKindId,
            };

      paintPendingRef.current.push(change);
      applyLocalPlannedOffChange(change);
    },
    [
      activeStep,
      applyLocalPlannedOffChange,
      grid.dates,
      grid.rows,
      paintKindId,
      payload.canWrite,
      payload.nonWorkingDayKinds,
      validation,
    ],
  );

  const handlePaintEnd = useCallback(() => {
    const changes = paintPendingRef.current;
    paintPendingRef.current = [];
    paintVisitedRef.current.clear();

    if (!payload.canWrite || changes.length === 0) {
      return;
    }

    startTransition(async () => {
      const result = await commitCanvasChangesAction({
        cycleId: payload.cycleId,
        draftId: payload.draftId,
        draftVersionId: payload.draftVersionId,
        optimisticVersion,
        plannedOffChanges: changes,
      });

      if (result.ok) {
        setOptimisticVersion(result.data.optimisticVersion);
        setErrorMessage(null);
        setValidationScope({
          changedStaffIds: [...new Set(changes.map((change) => change.staffProfileId))],
          changedDates: [...new Set(changes.map((change) => change.localDate))],
        });
        await refreshFromServer();
      } else {
        setErrorMessage(result.error);
        await refreshFromServer();
      }
    });
  }, [
    optimisticVersion,
    payload.canWrite,
    payload.cycleId,
    payload.draftId,
    payload.draftVersionId,
    refreshFromServer,
  ]);

  const applyLocalCellUpdate = useCallback(
    (staffProfileId: string, localDate: string, shiftCodeText: string) => {
      const resolved = shiftCodeText.trim();
      const shiftCode = payload.shiftCodes.find(
        (code) => code.code.toLowerCase() === resolved.toLowerCase(),
      );

      setGrid((current) => {
        const staff = current.rows
          .filter((row) => row.kind === "staff")
          .map((row) => ({
            id: row.row.staffProfileId,
            staffCode: row.row.staffCode,
            displayName: row.row.staffName,
            staffGroupId: row.row.staffGroupId,
            staffGroupSection: row.row.staffGroupSection,
            rowOrder: row.row.rowOrder,
          }));

        const assignments = current.rows.flatMap((row) => {
          if (row.kind !== "staff") {
            return [];
          }
          return row.row.cells
            .map((cell, index) => ({
              id: cell.assignmentId ?? `${row.row.staffProfileId}:${current.dates[index]}`,
              staffProfileId: row.row.staffProfileId,
              localDate: current.dates[index]!,
              shiftCodeId: cell.shiftCodeId,
              shiftCode: cell.shiftCode,
              isPinned: cell.isPinned,
              plannedOtHours: cell.plannedOtHours,
            }))
            .filter((item) => item.shiftCodeId);
        });

        const plannedOff = current.rows.flatMap((row) => {
          if (row.kind !== "staff") {
            return [];
          }
          return row.row.cells
            .map((cell, index) => ({
              staffProfileId: row.row.staffProfileId,
              localDate: current.dates[index]!,
              locked: cell.plannedOffLocked,
              kindCode: cell.nonWorkingDayKindCode ?? "OFF",
            }))
            .filter((_, index) => row.row.cells[index]?.isPlannedOff);
        });

        const nextAssignments = assignments.filter(
          (item) => !(item.staffProfileId === staffProfileId && item.localDate === localDate),
        );

        if (resolved && shiftCode) {
          nextAssignments.push({
            id: `${staffProfileId}:${localDate}`,
            staffProfileId,
            localDate,
            shiftCodeId: shiftCode.id,
            shiftCode: shiftCode.code,
            isPinned: false,
            plannedOtHours: shiftCode.otHours,
          });
        }

        return buildScheduleCanvasGrid({
          periodStart: payload.periodStart,
          periodEnd: payload.periodEnd,
          holidayDates: current.holidayDates,
          staffGroups: payload.staffGroups,
          staff,
          assignments: nextAssignments,
          plannedOff,
        });
      });

      setValidationScope({
        changedStaffIds: [staffProfileId],
        changedDates: [localDate],
      });
    },
    [payload.periodEnd, payload.periodStart, payload.shiftCodes, payload.staffGroups],
  );

  const handleApplyAction = useCallback(
    (
      staffProfileId: string,
      localDate: string,
      action: SuggestionAction,
      options?: ShiftCodePickerSelectOptions,
    ) => {
      if (!payload.canWrite) {
        return;
      }

      setPickerOpen(false);

      if (action.kind === "SHIFT_CODE") {
        applyLocalCellUpdate(staffProfileId, localDate, action.code);

        startTransition(async () => {
          const result = await updateCanvasCellAction({
            cycleId: payload.cycleId,
            draftId: payload.draftId,
            draftVersionId: payload.draftVersionId,
            optimisticVersion,
            staffProfileId,
            localDate,
            shiftCodeText: action.code,
          });

          if (result.ok) {
            setOptimisticVersion(result.data.optimisticVersion);
            setErrorMessage(null);
            await refreshFromServer();
          } else {
            setErrorMessage(result.error);
            await refreshFromServer();
          }
        });
        return;
      }

      if (action.kind === "OVERRIDE") {
        applyLocalCellUpdate(staffProfileId, localDate, action.code);

        startTransition(async () => {
          const result = await commitCanvasChangesAction({
            cycleId: payload.cycleId,
            draftId: payload.draftId,
            draftVersionId: payload.draftVersionId,
            optimisticVersion,
            cellChanges: [
              {
                staffProfileId,
                localDate,
                shiftCodeText: action.code,
              },
            ],
            override: options?.overrideReason ? { reason: options.overrideReason } : undefined,
          });

          if (result.ok) {
            setOptimisticVersion(result.data.optimisticVersion);
            setErrorMessage(null);
            setValidationScope({
              changedStaffIds: [staffProfileId],
              changedDates: [localDate],
            });
            await refreshFromServer();
          } else {
            setErrorMessage(result.error);
            await refreshFromServer();
          }
        });
        return;
      }

      if (action.kind === "SWAP_WITH") {
        const currentCode =
          selectedCell?.isPlannedOff || !selectedCell?.shiftCode ? "" : selectedCell.shiftCode;

        applyLocalCellUpdate(staffProfileId, localDate, action.counterpartCode);
        applyLocalCellUpdate(action.counterpartStaffId, localDate, currentCode);

        startTransition(async () => {
          const result = await commitCanvasChangesAction({
            cycleId: payload.cycleId,
            draftId: payload.draftId,
            draftVersionId: payload.draftVersionId,
            optimisticVersion,
            cellChanges: [
              {
                staffProfileId,
                localDate,
                shiftCodeText: action.counterpartCode,
              },
              {
                staffProfileId: action.counterpartStaffId,
                localDate,
                shiftCodeText: currentCode,
              },
            ],
          });

          if (result.ok) {
            setOptimisticVersion(result.data.optimisticVersion);
            setErrorMessage(null);
            setValidationScope({
              changedStaffIds: [staffProfileId, action.counterpartStaffId],
              changedDates: [localDate],
            });
            await refreshFromServer();
          } else {
            setErrorMessage(result.error);
            await refreshFromServer();
          }
        });
        return;
      }

      if (action.kind === "CLEAR") {
        applyLocalCellUpdate(staffProfileId, localDate, "");

        startTransition(async () => {
          const result = await updateCanvasCellAction({
            cycleId: payload.cycleId,
            draftId: payload.draftId,
            draftVersionId: payload.draftVersionId,
            optimisticVersion,
            staffProfileId,
            localDate,
            shiftCodeText: "",
          });

          if (result.ok) {
            setOptimisticVersion(result.data.optimisticVersion);
            setErrorMessage(null);
            await refreshFromServer();
          } else {
            setErrorMessage(result.error);
            await refreshFromServer();
          }
        });
        return;
      }

      if (action.kind === "PLANNED_OFF") {
        applyLocalPlannedOffChange({
          staffProfileId,
          localDate,
          action: "set",
          nonWorkingDayKindId: action.nonWorkingDayKindId,
        });

        setValidationScope({
          changedStaffIds: [staffProfileId],
          changedDates: [localDate],
        });

        startTransition(async () => {
          const result = await setCanvasPlannedDayOffAction({
            cycleId: payload.cycleId,
            draftId: payload.draftId,
            optimisticVersion,
            staffProfileId,
            localDate,
            nonWorkingDayKindId: action.nonWorkingDayKindId,
          });

          if (result.ok) {
            setOptimisticVersion(result.data.optimisticVersion);
            setErrorMessage(null);
            await refreshFromServer();
          } else {
            setErrorMessage(result.error);
            await refreshFromServer();
          }
        });
      }
    },
    [
      applyLocalCellUpdate,
      applyLocalPlannedOffChange,
      optimisticVersion,
      payload.canWrite,
      payload.cycleId,
      payload.draftId,
      payload.draftVersionId,
      refreshFromServer,
      selectedCell,
    ],
  );

  const handleClearDayOff = useCallback(() => {
    if (!payload.canWrite || !selection || !selectedDate) {
      return;
    }

    startTransition(async () => {
      const result = await clearCanvasPlannedDayOffAction({
        draftId: payload.draftId,
        optimisticVersion,
        staffProfileId: selection.staffProfileId,
        localDate: selectedDate,
      });

      if (result.ok) {
        setOptimisticVersion(result.data.optimisticVersion);
        await refreshFromServer();
        setSelection(null);
        setPickerOpen(false);
      } else {
        setErrorMessage(result.error);
      }
    });
  }, [
    optimisticVersion,
    payload.canWrite,
    payload.draftId,
    refreshFromServer,
    selectedDate,
    selection,
  ]);

  const handleTogglePin = useCallback(() => {
    if (!payload.canWrite || !selection || !selectedDate || !selectedCell) {
      return;
    }

    startTransition(async () => {
      const result = await toggleCanvasCellPinAction({
        draftId: payload.draftId,
        optimisticVersion,
        staffProfileId: selection.staffProfileId,
        localDate: selectedDate,
        draftVersionId: payload.draftVersionId,
        pinned: !selectedCell.isPinned,
      });

      if (result.ok) {
        setOptimisticVersion(result.data.optimisticVersion);
        await refreshFromServer();
      } else {
        setErrorMessage(result.error);
      }
    });
  }, [
    optimisticVersion,
    payload.canWrite,
    payload.draftId,
    payload.draftVersionId,
    refreshFromServer,
    selectedCell,
    selectedDate,
    selection,
  ]);

  const handleToggleOffLock = useCallback(() => {
    if (!payload.canWrite || !selection || !selectedDate || !selectedCell?.isPlannedOff) {
      return;
    }

    startTransition(async () => {
      const result = await setCanvasPlannedDayOffAction({
        cycleId: payload.cycleId,
        draftId: payload.draftId,
        optimisticVersion,
        staffProfileId: selection.staffProfileId,
        localDate: selectedDate,
        locked: !selectedCell.plannedOffLocked,
      });

      if (result.ok) {
        setOptimisticVersion(result.data.optimisticVersion);
        await refreshFromServer();
      } else {
        setErrorMessage(result.error);
      }
    });
  }, [
    optimisticVersion,
    payload.canWrite,
    payload.cycleId,
    payload.draftId,
    refreshFromServer,
    selectedCell,
    selectedDate,
    selection,
  ]);

  const handleToggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  const handleToggleShowEmptySections = useCallback(() => {
    setShowEmptySections((current) => {
      const next = !current;
      window.localStorage.setItem(SHOW_EMPTY_SECTIONS_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const handleRenameGroup = useCallback(
    (groupId: string, displayName: string) => {
      if (!payload.canWrite) {
        return;
      }

      startTransition(async () => {
        const result = await updateStaffGroupDisplayNameAction({ groupId, displayName });
        if (result.ok) {
          setPayload((current) => ({
            ...current,
            staffGroups: current.staffGroups.map((group) =>
              group.id === groupId ? { ...group, displayName } : group,
            ),
          }));
          await refreshFromServer();
        } else {
          setErrorMessage(result.error);
        }
      });
    },
    [payload.canWrite, refreshFromServer],
  );

  const handleRunDayOffSolver = useCallback(() => {
    if (!payload.canWrite) {
      return;
    }

    const staffIds = canvasStaffRows(grid).map((row) => row.staffProfileId);
    const quotaValidation = validateStaffDayOffQuotasComplete(staffIds, staffDayOffQuotas);
    if (!quotaValidation.ok) {
      setErrorMessage(
        `กรุณากรอกโควตาวัน OFF ให้ครบทุกคนก่อนเกลี่ยวันหยุด (ขาด ${quotaValidation.missingStaffIds.length} คน)`,
      );
      return;
    }

    startTransition(async () => {
      let currentOptimisticVersion = optimisticVersion;

      const dirtyRows = [...dirtyQuotaStaffIds]
        .map((staffProfileId) => ({
          staffProfileId,
          daysOffQuota: staffDayOffQuotas.get(staffProfileId),
        }))
        .filter((row): row is { staffProfileId: string; daysOffQuota: number } =>
          isValidDayOffQuotaValue(row.daysOffQuota),
        );

      if (dirtyRows.length > 0) {
        const commitResult = await commitCanvasChangesAction({
          cycleId: payload.cycleId,
          draftId: payload.draftId,
          draftVersionId: payload.draftVersionId,
          optimisticVersion: currentOptimisticVersion,
          staffDayOffQuotas: dirtyRows,
        });

        if (!commitResult.ok) {
          setErrorMessage(commitResult.error);
          return;
        }

        currentOptimisticVersion = commitResult.data.optimisticVersion;
        setOptimisticVersion(currentOptimisticVersion);
        setDirtyQuotaStaffIds(new Set());
      }

      const result = await runDayOffSolverAction({
        cycleId: payload.cycleId,
        draftId: payload.draftId,
        draftVersionId: payload.draftVersionId,
        optimisticVersion: currentOptimisticVersion,
      });

      if (result.ok) {
        setOptimisticVersion(result.data.optimisticVersion);
        setErrorMessage(null);
        await refreshFromServer();
      } else {
        setErrorMessage(result.error);
      }
    });
  }, [
    dirtyQuotaStaffIds,
    grid,
    optimisticVersion,
    payload.canWrite,
    payload.cycleId,
    payload.draftId,
    payload.draftVersionId,
    refreshFromServer,
    staffDayOffQuotas,
  ]);

  const handleQuotaChange = useCallback((staffProfileId: string, rawValue: string) => {
    setStaffDayOffQuotas((current) => {
      const next = new Map(current);
      if (rawValue.trim() === "") {
        next.set(staffProfileId, null);
        return next;
      }

      const parsed = Number.parseInt(rawValue, 10);
      next.set(staffProfileId, Number.isNaN(parsed) ? null : parsed);
      return next;
    });
    setDirtyQuotaStaffIds((current) => new Set([...current, staffProfileId]));
  }, []);

  const handleQuotaBlur = useCallback(
    (staffProfileId: string) => {
      if (!payload.canWrite || !dirtyQuotaStaffIds.has(staffProfileId)) {
        return;
      }

      const daysOffQuota = staffDayOffQuotas.get(staffProfileId);
      if (!isValidDayOffQuotaValue(daysOffQuota)) {
        return;
      }

      startTransition(async () => {
        const result = await commitCanvasChangesAction({
          cycleId: payload.cycleId,
          draftId: payload.draftId,
          draftVersionId: payload.draftVersionId,
          optimisticVersion,
          staffDayOffQuotas: [{ staffProfileId, daysOffQuota }],
        });

        if (result.ok) {
          setOptimisticVersion(result.data.optimisticVersion);
          setDirtyQuotaStaffIds((current) => {
            const next = new Set(current);
            next.delete(staffProfileId);
            return next;
          });
          setErrorMessage(null);
        } else {
          setErrorMessage(result.error);
        }
      });
    },
    [
      dirtyQuotaStaffIds,
      optimisticVersion,
      payload.canWrite,
      payload.cycleId,
      payload.draftId,
      payload.draftVersionId,
      staffDayOffQuotas,
    ],
  );

  const handleRunBalanceSolver = useCallback(() => {
    if (!payload.canWrite) {
      return;
    }

    startTransition(async () => {
      const result = await runBalanceSolverAction({
        cycleId: payload.cycleId,
        draftId: payload.draftId,
        draftVersionId: payload.draftVersionId,
        optimisticVersion,
      });

      if (result.ok) {
        setOptimisticVersion(result.data.optimisticVersion);
        setBalanceResultSummary(result.data.resultSummary);
        setErrorMessage(
          result.data.feasible
            ? null
            : (result.data.messageTh ?? "Stage B เติมได้บางส่วน — ยังมี slot บังคับค้าง"),
        );
        await refreshFromServer();
      } else {
        setErrorMessage(result.error);
      }
    });
  }, [
    optimisticVersion,
    payload.canWrite,
    payload.cycleId,
    payload.draftId,
    payload.draftVersionId,
    refreshFromServer,
  ]);

  return (
    <section className="space-y-4" aria-label="Canvas จัดเวร" aria-busy={pending}>
      <ScheduleStepBar
        activeStep={activeStep}
        stepStates={stepStates}
        onStepChange={setActiveStep}
        actions={
          <ScheduleCanvasToolbar
            activeStep={activeStep}
            canWrite={payload.canWrite}
            showPaintOffControls={interactionMode === "PAINT_OFF"}
            onRunDayOffSolver={handleRunDayOffSolver}
            onRunBalanceSolver={handleRunBalanceSolver}
            publishActions={publishShareActions}
            busy={pending}
            showEmptySections={showEmptySections}
            onToggleShowEmptySections={handleToggleShowEmptySections}
            nonWorkingDayKinds={payload.nonWorkingDayKinds}
            paintKindId={paintKindId}
            onPaintKindChange={setPaintKindId}
          />
        }
      />

      {errorMessage ? (
        <p className="text-destructive text-sm" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {activeStep === "AUTO_BALANCE" && balanceResultSummary ? (
        <BalanceRunSummary summary={balanceResultSummary} />
      ) : null}

      <ScheduleCanvasGrid
        grid={grid}
        shiftCodes={payload.shiftCodes}
        canWrite={payload.canWrite}
        selection={selection}
        onSelectionChange={setSelection}
        onOpenPicker={handleOpenPicker}
        pickerOpen={pickerOpen}
        onPickerOpenChange={setPickerOpen}
        pickerSuggestions={pickerSuggestions}
        pickerSuggestionsLoading={pickerSuggestionsLoading}
        onApplyAction={handleApplyAction}
        onClearDayOff={handleClearDayOff}
        onLockPin={handleTogglePin}
        onLockPlannedOff={handleToggleOffLock}
        onUnlockPin={handleTogglePin}
        onUnlockPlannedOff={handleToggleOffLock}
        collapsedGroups={collapsedGroups}
        onToggleGroup={handleToggleGroup}
        onRenameGroup={handleRenameGroup}
        showEmptySections={showEmptySections}
        interactionMode={interactionMode}
        onPaintDayOff={handlePaintDayOff}
        onPaintStart={handlePaintStart}
        onPaintEnd={handlePaintEnd}
        staffDayOffQuotas={staffDayOffQuotas}
        defaultDayOffQuota={payload.defaultDayOffQuota ?? 0}
        onQuotaChange={handleQuotaChange}
        onQuotaBlur={handleQuotaBlur}
      />

      <ScheduleStatusPanel
        validation={validation}
        coverageIssues={coverageIssues}
        workloadSnapshot={liveWorkloadSnapshot}
        staffLabelById={staffLabelById}
        departmentLabelById={departmentLabelById}
        shiftCodeLabelById={shiftCodeLabelById}
      />
    </section>
  );
}
