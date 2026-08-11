import {
    buildScheduleCanvasGrid,
    type CanvasAssignmentInput,
    type CanvasPlannedOffInput,
    type CanvasStaffGroupInput,
    type CanvasStaffInput,
    type ScheduleCanvasGrid,
} from "@/domain/schedule/canvas-grid";
import {
    mergeStaffDayOffQuotas,
    resolveDefaultDayOffQuota,
    type StaffDayOffQuotaByStaffId,
} from "@/domain/schedule/day-off-quota-draft";
import { buildAssignmentInterval, localDateTimeToIso } from "@/domain/schedule/time";
import type {
    PlannedNonWorkingDaySnapshot,
    RuleInstanceSnapshot,
    ScheduleAssignment,
    ScheduleEngineInput,
    ShiftCodeSnapshot,
    ShiftDemandSnapshot,
    StaffSnapshot,
} from "@/domain/schedule/types";
import { withLegacyShiftDemandAlias } from "@/domain/schedule/validate";
import { weekdayMaskToDayType } from "@/domain/starter-pack/day-type";
import type { PrismaClient } from "@/generated/client/client";
import { loadHistoryWindowSnapshot } from "@/lib/scheduling/load-history-window";

/** ตัวเลือก shift code สำหรับ palette */
export type ShiftCodeOption = {
  readonly id: string;
  readonly code: string;
  readonly isNightShift: boolean;
  readonly standardHours: number;
  readonly otHours: number;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly needsConfirmation: boolean;
  readonly active: boolean;
};

/** ชนิดวันหยุดที่วางแผนได้ */
export type NonWorkingDayKindOption = {
  readonly id: string;
  readonly code: string;
  readonly displayName: string;
  readonly blocksScheduling: boolean;
};

/** แผนกสำหรับ label ใน canvas */
export type CanvasDepartmentOption = {
  readonly id: string;
  readonly code: string;
  readonly displayName: string;
};

/** @deprecated ใช้ CanvasDepartmentOption */
export type CanvasWorkAreaOption = CanvasDepartmentOption;

/** snapshot สำหรับ bootstrap canvas */
export type CanvasDraftSnapshot = {
  readonly cycleId: string;
  readonly cycleName: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly draftId: string;
  readonly draftVersionId: string;
  readonly optimisticVersion: number;
  readonly timezone: string;
  readonly grid: ScheduleCanvasGrid;
  readonly shiftCodes: readonly ShiftCodeOption[];
  readonly nonWorkingDayKinds: readonly NonWorkingDayKindOption[];
  readonly departments: readonly CanvasDepartmentOption[];
  readonly staffGroups: readonly CanvasStaffGroupInput[];
  readonly engineInput: ScheduleEngineInput;
  readonly defaultOffKindId: string | null;
  readonly staffDayOffQuotas: StaffDayOffQuotaByStaffId;
  readonly defaultDayOffQuota: number;
};

type CanvasDraftDbClient = Pick<
  PrismaClient,
  | "scheduleCycle"
  | "scheduleDraft"
  | "scheduleVersion"
  | "assignment"
  | "plannedNonWorkingDay"
  | "staffProfile"
  | "staffGroup"
  | "shiftCode"
  | "nonWorkingDayKind"
  | "ruleInstance"
  | "shiftCodeDemand"
  | "department"
  | "organization"
  | "staffGrade"
  | "draftStaffDayOffQuota"
> &
  Parameters<typeof loadHistoryWindowSnapshot>[0];

/** แปลง Date เป็น YYYY-MM-DD */
function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** แปลง rule instances จาก Prisma */
function mapRuleInstances(
  rows: readonly {
    id: string;
    ruleTemplateId: string;
    params: unknown;
    severity: RuleInstanceSnapshot["severity"];
    weight: number | null;
    overrideClass: RuleInstanceSnapshot["overrideClass"];
    enabled: boolean;
  }[],
): RuleInstanceSnapshot[] {
  return rows.map((row) => ({
    id: row.id,
    ruleTemplateId: row.ruleTemplateId,
    params: (row.params ?? {}) as Record<string, unknown>,
    severity: row.severity,
    weight: row.weight === null ? null : Number(row.weight),
    overrideClass: row.overrideClass,
    enabled: row.enabled,
  }));
}

/** สร้าง schedule version สำหรับ draft ถ้ายังไม่มี */
async function ensureDraftScheduleVersion(
  db: CanvasDraftDbClient,
  organizationId: string,
  cycleId: string,
  draftId: string,
): Promise<{ id: string }> {
  const existing = await db.scheduleVersion.findFirst({
    where: {
      organizationId,
      scheduleDraftId: draftId,
      status: { in: ["DRAFT", "VALIDATED"] },
    },
    orderBy: { versionNumber: "desc" },
  });

  if (existing) {
    return { id: existing.id };
  }

  const ruleSet = await db.scheduleVersion.findFirst({
    where: { organizationId },
    orderBy: { versionNumber: "desc" },
    select: { ruleSetVersionId: true },
  });

  if (!ruleSet) {
    throw new Error("ไม่พบ rule set สำหรับสร้าง draft version");
  }

  const latestInCycle = await db.scheduleVersion.findFirst({
    where: { organizationId, scheduleCycleId: cycleId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });

  const created = await db.scheduleVersion.create({
    data: {
      organizationId,
      scheduleCycleId: cycleId,
      scheduleDraftId: draftId,
      versionNumber: (latestInCycle?.versionNumber ?? 0) + 1,
      status: "DRAFT",
      ruleSetVersionId: ruleSet.ruleSetVersionId,
    },
  });

  return { id: created.id };
}

/** โหลดโควตาวัน OFF ที่บันทึกแล้ว — ยอม array ว่างถ้ายังไม่ migrate */
async function loadDraftStaffDayOffQuotas(
  db: CanvasDraftDbClient,
  organizationId: string,
  scheduleDraftId: string,
): Promise<readonly { staffProfileId: string; daysOffQuota: number }[]> {
  try {
    return await db.draftStaffDayOffQuota.findMany({
      where: {
        organizationId,
        scheduleDraftId,
      },
      select: {
        staffProfileId: true,
        daysOffQuota: true,
      },
    });
  } catch {
    return [];
  }
}

/** หารอบที่มี draft EDITING ล่าสุด — ใช้ redirect เมื่อ cycleId ใน URL ใช้ไม่ได้ */
export async function findLatestEditingCycleId(
  db: Pick<PrismaClient, "scheduleDraft">,
  organizationId: string,
): Promise<string | null> {
  const draft = await db.scheduleDraft.findFirst({
    where: {
      organizationId,
      status: "EDITING",
    },
    orderBy: { updatedAt: "desc" },
    select: { scheduleCycleId: true },
  });

  return draft?.scheduleCycleId ?? null;
}

/** โหลด snapshot canvas สำหรับรอบที่กำหนด */
export async function loadCanvasDraftSnapshot(
  db: CanvasDraftDbClient,
  options: {
    readonly organizationId: string;
    readonly cycleId: string;
  },
): Promise<CanvasDraftSnapshot | null> {
  const cycle = await db.scheduleCycle.findFirst({
    where: {
      id: options.cycleId,
      organizationId: options.organizationId,
    },
  });

  if (!cycle) {
    return null;
  }

  const periodStart = formatDateInput(cycle.periodStart);
  const periodEnd = formatDateInput(cycle.periodEnd);

  let draft = await db.scheduleDraft.findFirst({
    where: {
      organizationId: options.organizationId,
      scheduleCycleId: cycle.id,
      status: "EDITING",
    },
    orderBy: { updatedAt: "desc" },
  });

  // สร้าง draft ใหม่เมื่อมีรอบแต่ยังไม่มี draft ที่แก้ได้
  if (!draft) {
    const draftCount = await db.scheduleDraft.count({
      where: {
        organizationId: options.organizationId,
        scheduleCycleId: cycle.id,
      },
    });

    draft = await db.scheduleDraft.create({
      data: {
        organizationId: options.organizationId,
        scheduleCycleId: cycle.id,
        draftNumber: draftCount + 1,
        status: "EDITING",
      },
    });
  }

  const draftVersion = await ensureDraftScheduleVersion(
    db,
    options.organizationId,
    cycle.id,
    draft.id,
  );

  const quotaRows = await loadDraftStaffDayOffQuotas(
    db,
    options.organizationId,
    draft.id,
  );

  const [
    assignmentRows,
    plannedOffRows,
    staffRows,
    groupRows,
    shiftCodeRows,
    offKindRows,
    ruleRows,
    demandRows,
    departmentRows,
    organization,
    history,
  ] = await Promise.all([
    db.assignment.findMany({
      where: {
        organizationId: options.organizationId,
        scheduleVersionId: draftVersion.id,
        localDate: {
          gte: new Date(periodStart),
          lte: new Date(periodEnd),
        },
      },
      include: { shiftCode: true },
    }),
    db.plannedNonWorkingDay.findMany({
      where: {
        organizationId: options.organizationId,
        scheduleDraftId: draft.id,
        localDate: {
          gte: new Date(periodStart),
          lte: new Date(periodEnd),
        },
      },
      include: { nonWorkingDayKind: true },
    }),
    db.staffProfile.findMany({
      where: { organizationId: options.organizationId, active: true },
      orderBy: [{ staffGroup: { sortOrder: "asc" } }, { rowOrder: "asc" }],
    }),
    db.staffGroup.findMany({
      where: { organizationId: options.organizationId, active: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.shiftCode.findMany({
      where: { organizationId: options.organizationId, deprecated: false },
    }),
    db.nonWorkingDayKind.findMany({
      where: { organizationId: options.organizationId, active: true },
    }),
    db.ruleInstance.findMany({
      where: { organizationId: options.organizationId, enabled: true },
    }),
    db.shiftCodeDemand.findMany({
      where: {
        organizationId: options.organizationId,
        active: true,
        effectiveFrom: { lte: new Date(periodEnd) },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date(periodStart) } }],
      },
      include: { shiftCode: { select: { id: true, canonicalCode: true } } },
    }),
    db.department.findMany({
      where: { organizationId: options.organizationId, active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, code: true, displayName: true },
    }),
    db.organization.findUnique({
      where: { id: options.organizationId },
      select: { timezone: true },
    }),
    loadHistoryWindowSnapshot(db, {
      organizationId: options.organizationId,
      asOfDate: periodStart,
    }),
  ]);

  const timezone = organization?.timezone ?? "Asia/Bangkok";
  const gradeRows = await db.staffGrade.findMany({
    where: { organizationId: options.organizationId },
    select: { id: true, code: true },
  });
  const gradeIdByCode = new Map(gradeRows.map((row) => [row.code, row.id]));

  const shiftCodes: ShiftCodeOption[] = shiftCodeRows.map((row) => ({
    id: row.id,
    code: row.canonicalCode,
    isNightShift: row.isNightShift,
    standardHours: row.standardHours ? Number(row.standardHours) : 0,
    otHours: Number(row.otHours),
    startTime: row.startTime,
    endTime: row.endTime,
    needsConfirmation: row.needsConfirmation,
    active: !row.deprecated,
  }));

  const shiftCodeSnapshots: ShiftCodeSnapshot[] = shiftCodeRows.map((row) => ({
    id: row.id,
    code: row.canonicalCode,
    departmentId: row.departmentId ?? undefined,
    startTime: row.startTime ?? "00:00",
    endTime: row.endTime ?? "00:00",
    standardHours: row.standardHours ? Number(row.standardHours) : 0,
    otHours: Number(row.otHours),
    isNightShift: row.isNightShift,
    allowedGradeIds: row.allowedGradeCodes
      .map((code) => gradeIdByCode.get(code))
      .filter((id): id is string => id !== undefined),
    needsConfirmation: row.needsConfirmation,
    active: !row.deprecated,
  }));

  const staffGroups: CanvasStaffGroupInput[] = groupRows.map((group) => ({
    id: group.id,
    code: group.code,
    displayName: group.displayName,
    sortOrder: group.sortOrder,
  }));

  const staff: CanvasStaffInput[] = staffRows.map((row) => ({
    id: row.id,
    staffCode: row.staffCode,
    displayName: row.displayName,
    staffGroupId: row.staffGroupId,
    staffGroupSection: row.staffGroupSection,
    rowOrder: row.rowOrder,
  }));

  const assignments: CanvasAssignmentInput[] = assignmentRows.map((row) => ({
    id: row.id,
    staffProfileId: row.staffProfileId,
    localDate: formatDateInput(row.localDate),
    shiftCodeId: row.shiftCodeId,
    shiftCode: row.shiftCode?.canonicalCode ?? null,
    isPinned: row.isPinned,
    plannedOtHours: Number(row.plannedOtHours),
  }));

  const plannedOff: CanvasPlannedOffInput[] = plannedOffRows.map((row) => ({
    staffProfileId: row.staffProfileId,
    localDate: formatDateInput(row.localDate),
    locked: row.locked,
    kindCode: row.nonWorkingDayKind.code,
  }));

  const grid = buildScheduleCanvasGrid({
    periodStart,
    periodEnd,
    holidayDates: history.holidayDates,
    staffGroups,
    staff,
    assignments,
    plannedOff,
  });

  const cycleAssignments: ScheduleAssignment[] = assignmentRows.map((row) => ({
    id: row.id,
    staffId: row.staffProfileId,
    shiftCodeId: row.shiftCodeId ?? "",
    scheduleDate: formatDateInput(row.localDate),
    startAt: row.startsAt.toISOString(),
    endAt: row.endsAt.toISOString(),
    plannedOtHours: Number(row.plannedOtHours),
    isPinned: row.isPinned,
  }));

  const plannedNonWorkingDays: PlannedNonWorkingDaySnapshot[] = plannedOffRows.map((row) => ({
    staffId: row.staffProfileId,
    localDate: formatDateInput(row.localDate),
    nonWorkingDayKindId: row.nonWorkingDayKindId,
    blocksScheduling: row.nonWorkingDayKind.blocksScheduling,
    locked: row.locked,
    source: row.source,
  }));

  const staffSnapshots: StaffSnapshot[] = staffRows.map((row) => ({
    id: row.id,
    gradeId: row.staffGradeId,
    staffGroupId: row.staffGroupId ?? undefined,
    fte: history.staff.find((member) => member.id === row.id)?.fte ?? 1,
    shiftAuthorizations:
      history.staff.find((member) => member.id === row.id)?.shiftAuthorizations ?? [],
  }));

  const shiftDemands: ShiftDemandSnapshot[] = demandRows.map((row) => ({
    id: row.id,
    shiftCodeId: row.shiftCodeId,
    dayType: weekdayMaskToDayType(row.weekdayMask, row.appliesOnHolidays),
    minCount: row.minHeadcount,
    requiresLead: row.requiresLead,
  }));

  const ruleInstances = mapRuleInstances(
    ruleRows.map((row) => ({
      id: row.id,
      ruleTemplateId: row.ruleTemplateId,
      params: row.params,
      severity: row.severity,
      weight: row.weight === null ? null : Number(row.weight),
      overrideClass: row.overrideClass,
      enabled: row.enabled,
    })),
  );

  const defaultDayOffQuota = resolveDefaultDayOffQuota(periodStart, periodEnd, ruleInstances);
  const staffDayOffQuotas = mergeStaffDayOffQuotas(
    staffSnapshots.map((member) => member.id),
    quotaRows.map((row) => ({
      staffProfileId: row.staffProfileId,
      daysOffQuota: row.daysOffQuota,
    })),
    defaultDayOffQuota,
  );

  const engineInput: ScheduleEngineInput = {
    organizationId: options.organizationId,
    timezone,
    cycleStartDate: periodStart,
    cycleEndDate: periodEnd,
    assignments: cycleAssignments,
    staff: staffSnapshots,
    shiftCodes: shiftCodeSnapshots,
    shiftDemands,
    ruleInstances,
    holidayDates: history.holidayDates,
    plannedNonWorkingDays,
    staffWorkloadMonthly: history.staffWorkloadMonthly,
    staffDayOffQuotas,
  };

  const defaultOffKind =
    offKindRows.find((kind) => kind.code === "OFF") ??
    offKindRows.find((kind) => kind.blocksScheduling) ??
    offKindRows[0];

  return {
    cycleId: cycle.id,
    cycleName: cycle.name,
    periodStart,
    periodEnd,
    draftId: draft.id,
    draftVersionId: draftVersion.id,
    optimisticVersion: draft.optimisticVersion,
    timezone,
    grid,
    shiftCodes,
    nonWorkingDayKinds: offKindRows.map((kind) => ({
      id: kind.id,
      code: kind.code,
      displayName: kind.displayName,
      blocksScheduling: kind.blocksScheduling,
    })),
    departments: departmentRows.map((row) => ({
      id: row.id,
      code: row.code,
      displayName: row.displayName,
    })),
    staffGroups,
    engineInput: withLegacyShiftDemandAlias(engineInput),
    defaultOffKindId: defaultOffKind?.id ?? null,
    staffDayOffQuotas,
    defaultDayOffQuota,
  };
}

/** แปลง grid เป็น assignments สำหรับ engine input */
export function gridToEngineAssignments(
  grid: ScheduleCanvasGrid,
  shiftCodeById: ReadonlyMap<string, ShiftCodeOption>,
  timezone: string,
): ScheduleAssignment[] {
  const assignments: ScheduleAssignment[] = [];

  for (const row of grid.rows) {
    if (row.kind !== "staff") {
      continue;
    }

    row.row.cells.forEach((cell, index) => {
      if (!cell.shiftCodeId || cell.isPlannedOff) {
        return;
      }

      const shiftCode = shiftCodeById.get(cell.shiftCodeId);
      if (!shiftCode) {
        return;
      }

      const scheduleDate = grid.dates[index]!;
      const hasTimes = Boolean(shiftCode.startTime && shiftCode.endTime);
      const interval = hasTimes
        ? buildAssignmentInterval(
            {
              startTime: shiftCode.startTime!,
              endTime: shiftCode.endTime!,
            },
            scheduleDate,
            timezone,
          )
        : {
            startAt: localDateTimeToIso(scheduleDate, "00:00", timezone),
            endAt: localDateTimeToIso(scheduleDate, "00:00", timezone),
          };

      assignments.push({
        id: cell.assignmentId ?? `${row.row.staffProfileId}:${scheduleDate}`,
        staffId: row.row.staffProfileId,
        shiftCodeId: cell.shiftCodeId,
        scheduleDate,
        startAt: interval.startAt,
        endAt: interval.endAt,
        plannedOtHours: cell.plannedOtHours,
        isPinned: cell.isPinned,
      });
    });
  }

  return assignments;
}

/** แปลง grid เป็น planned off snapshots */
export function gridToPlannedOff(
  grid: ScheduleCanvasGrid,
  nonWorkingDayKinds: readonly NonWorkingDayKindOption[],
  defaultOffKindId: string | null,
): PlannedNonWorkingDaySnapshot[] {
  const kindByCode = new Map(nonWorkingDayKinds.map((kind) => [kind.code, kind]));
  const defaultKind =
    nonWorkingDayKinds.find((kind) => kind.id === defaultOffKindId) ??
    nonWorkingDayKinds.find((kind) => kind.blocksScheduling) ??
    nonWorkingDayKinds[0];
  const planned: PlannedNonWorkingDaySnapshot[] = [];

  for (const row of grid.rows) {
    if (row.kind !== "staff") {
      continue;
    }

    row.row.cells.forEach((cell, index) => {
      if (!cell.isPlannedOff) {
        return;
      }

      const kind =
        (cell.nonWorkingDayKindCode ? kindByCode.get(cell.nonWorkingDayKindCode) : undefined) ??
        defaultKind;
      if (!kind) {
        return;
      }

      planned.push({
        staffId: row.row.staffProfileId,
        localDate: grid.dates[index]!,
        nonWorkingDayKindId: kind.id,
        blocksScheduling: kind.blocksScheduling,
        locked: cell.plannedOffLocked,
      });
    });
  }

  return planned;
}
