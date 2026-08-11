import {
    buildWorkloadStatsSnapshot,
    type StaffDisplayMeta,
    type StaffGroupLabel,
    type WorkloadStatsSnapshot,
} from "@/domain/optimize/fairness/workload-stats";
import { yearMonthFromDate } from "@/domain/rules/helpers/schedule-metrics";
import type {
    PlannedNonWorkingDaySnapshot,
    RuleInstanceSnapshot,
    ScheduleAssignment,
    ScheduleEngineInput,
} from "@/domain/schedule/types";
import type { PrismaClient } from "@/generated/client/client";
import { loadHistoryWindowSnapshot } from "@/lib/scheduling/load-history-window";

/** ตัวเลือกโหลด workload stats */
export type LoadWorkloadStatsOptions = {
  readonly organizationId: string;
  readonly asOfDate?: string;
  readonly timezone?: string;
};

type WorkloadStatsDbClient = Pick<
  PrismaClient,
  | "staffProfile"
  | "staffGroup"
  | "ruleInstance"
  | "scheduleDraft"
  | "scheduleVersion"
  | "assignment"
  | "plannedNonWorkingDay"
  | "organization"
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

/** โหลด draft ที่กำลังแก้และ assignments สด */
async function loadCurrentCycleDraft(
  db: WorkloadStatsDbClient,
  organizationId: string,
): Promise<
  | {
      cycleId: string;
      draftId: string;
      cycleName: string;
      periodStart: string;
      periodEnd: string;
      yearMonth: string;
      assignments: ScheduleAssignment[];
      plannedNonWorkingDays: PlannedNonWorkingDaySnapshot[];
    }
  | undefined
> {
  const draft = await db.scheduleDraft.findFirst({
    where: {
      organizationId,
      status: "EDITING",
    },
    orderBy: { updatedAt: "desc" },
    include: { scheduleCycle: true },
  });

  if (!draft) {
    return undefined;
  }

  const periodStart = formatDateInput(draft.scheduleCycle.periodStart);
  const periodEnd = formatDateInput(draft.scheduleCycle.periodEnd);

  const draftVersion = await db.scheduleVersion.findFirst({
    where: {
      organizationId,
      scheduleDraftId: draft.id,
      status: { in: ["DRAFT", "VALIDATED"] },
    },
    orderBy: { versionNumber: "desc" },
  });

  const publishedInCycle = await db.scheduleVersion.findFirst({
    where: {
      organizationId,
      scheduleCycleId: draft.scheduleCycleId,
      status: { in: ["PUBLISHED", "LOCKED"] },
    },
    orderBy: { versionNumber: "desc" },
  });

  const versionId = draftVersion?.id ?? publishedInCycle?.id;
  const assignmentRows =
    versionId === undefined
      ? []
      : await db.assignment.findMany({
          where: {
            organizationId,
            scheduleVersionId: versionId,
            localDate: {
              gte: new Date(periodStart),
              lte: new Date(periodEnd),
            },
          },
        });

  const plannedOffRows = await db.plannedNonWorkingDay.findMany({
    where: {
      organizationId,
      scheduleDraftId: draft.id,
      localDate: {
        gte: new Date(periodStart),
        lte: new Date(periodEnd),
      },
    },
    include: { nonWorkingDayKind: true },
  });

  const assignments: ScheduleAssignment[] = assignmentRows.map((row) => ({
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

  return {
    cycleId: draft.scheduleCycleId,
    draftId: draft.id,
    cycleName: draft.scheduleCycle.name,
    periodStart,
    periodEnd,
    yearMonth: yearMonthFromDate(periodStart),
    assignments,
    plannedNonWorkingDays,
  };
}

/** โหลด workload stats จาก DB */
export async function loadWorkloadStatsSnapshot(
  db: WorkloadStatsDbClient,
  options: LoadWorkloadStatsOptions,
): Promise<WorkloadStatsSnapshot> {
  const asOfDate = options.asOfDate ?? formatDateInput(new Date());

  const [history, staffRows, groupRows, ruleRows, currentCycle, organization] = await Promise.all([
    loadHistoryWindowSnapshot(db, {
      organizationId: options.organizationId,
      asOfDate,
    }),
    db.staffProfile.findMany({
      where: { organizationId: options.organizationId, active: true },
      include: {
        staffGroup: true,
        employmentContracts: {
          where: {
            effectiveFrom: { lte: new Date(asOfDate) },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date(asOfDate) } }],
          },
          orderBy: { effectiveFrom: "desc" },
          take: 1,
        },
      },
      orderBy: [{ staffGroup: { sortOrder: "asc" } }, { rowOrder: "asc" }],
    }),
    db.staffGroup.findMany({
      where: { organizationId: options.organizationId, active: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.ruleInstance.findMany({
      where: { organizationId: options.organizationId, enabled: true },
    }),
    loadCurrentCycleDraft(db, options.organizationId),
    db.organization.findUnique({
      where: { id: options.organizationId },
      select: { timezone: true },
    }),
  ]);

  const timezone = options.timezone ?? organization?.timezone ?? "Asia/Bangkok";
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

  const staffMeta: StaffDisplayMeta[] = staffRows.map((row) => ({
    staffId: row.id,
    staffCode: row.staffCode,
    displayName: row.displayName,
    staffGroupId: row.staffGroupId ?? undefined,
    staffGroupName: row.staffGroup?.displayName,
    fte: row.employmentContracts[0] ? Number(row.employmentContracts[0].fte) : 1,
    targetHoursPerMonth: row.employmentContracts[0]?.targetHoursPerMonth
      ? Number(row.employmentContracts[0].targetHoursPerMonth)
      : undefined,
  }));

  const staffGroups: StaffGroupLabel[] = groupRows.map((group) => ({
    id: group.id,
    code: group.code,
    displayName: group.displayName,
  }));

  const cycleStartDate = currentCycle?.periodStart ?? history.windowStart;
  const cycleEndDate = currentCycle?.periodEnd ?? history.windowEnd;

  const engineInput: ScheduleEngineInput = {
    organizationId: options.organizationId,
    timezone,
    cycleStartDate,
    cycleEndDate,
    assignments: history.assignments,
    staff: history.staff,
    shiftCodes: history.shiftCodes,
    shiftDemands: [],
    ruleInstances,
    holidayDates: history.holidayDates,
    plannedNonWorkingDays: history.plannedNonWorkingDays,
    staffWorkloadMonthly: history.staffWorkloadMonthly,
  };

  return buildWorkloadStatsSnapshot({
    asOfDate,
    fairnessLookbackMonths: history.fairnessLookbackMonths,
    staffMeta,
    staffGroups,
    engineInput,
    currentCycle: currentCycle
      ? {
          cycleId: currentCycle.cycleId,
          draftId: currentCycle.draftId,
          cycleName: currentCycle.cycleName,
          periodStart: currentCycle.periodStart,
          periodEnd: currentCycle.periodEnd,
          yearMonth: currentCycle.yearMonth,
        }
      : undefined,
    currentCycleAssignments: currentCycle?.assignments,
    currentCyclePlannedOff: currentCycle?.plannedNonWorkingDays,
  });
}
