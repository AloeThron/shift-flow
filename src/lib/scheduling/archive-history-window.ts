import {
  aggregateStaffWorkloadMonthly,
  type WorkloadMonthlyInput,
} from "@/domain/optimize/fairness/workload-monthly";
import { yearMonthFromDate } from "@/domain/rules/helpers/schedule-metrics";
import type {
  PlannedNonWorkingDaySnapshot,
  ScheduleAssignment,
  ShiftCodeSnapshot,
  StaffSnapshot,
} from "@/domain/schedule/types";
import type { SchedulingPolicySnapshot } from "@/domain/scheduling/policy";
import {
  buildDefaultSchedulingPolicySnapshot,
  resolveEffectiveSchedulingPolicy,
} from "@/domain/scheduling/policy";
import { computeHistoryWindow, yearMonthsBeforeWindow } from "@/domain/scheduling/window";
import type { PrismaClient } from "@/generated/client/client";

import {
  loadHistoryWindowSnapshot,
  staffWorkloadMonthlyUpsertData,
} from "@/lib/scheduling/load-history-window";

/** ผล archive job */
export type ArchiveHistoryWindowResult = {
  readonly policy: SchedulingPolicySnapshot;
  readonly windowStart: string;
  readonly archivedMonths: readonly string[];
  readonly upsertedRows: number;
  readonly deletedAssignmentIds: readonly string[];
};

/** ตัวเลือก archive — ไม่ลบรายละเอียดโดย default ตาม data policy */
export type ArchiveHistoryWindowOptions = {
  readonly organizationId: string;
  readonly asOfDate?: string;
  readonly deleteDetailedData?: boolean;
};

type ArchiveDbClient = Pick<
  PrismaClient,
  | "schedulingPolicy"
  | "organization"
  | "staffProfile"
  | "shiftCode"
  | "assignment"
  | "scheduleVersion"
  | "plannedNonWorkingDay"
  | "staffWorkloadMonthly"
  | "holidayDate"
  | "holidayCalendar"
  | "staffShiftAuthorization"
  | "employmentContract"
>;

/** แปลง Date เป็น YYYY-MM-DD */
function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** โหลด policy ที่มีผล */
async function loadEffectivePolicy(
  db: ArchiveDbClient,
  organizationId: string,
  asOfDate: string,
): Promise<SchedulingPolicySnapshot> {
  const policies = await db.schedulingPolicy.findMany({
    where: { organizationId },
    orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }],
  });

  const mapped: SchedulingPolicySnapshot[] = policies.map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    historyWindowMonths: row.historyWindowMonths,
    fairnessLookbackMonths: row.fairnessLookbackMonths,
    planningHorizonMonths: row.planningHorizonMonths,
    publishLeadDays: row.publishLeadDays,
    otDerivationMode: row.otDerivationMode,
    effectiveFrom: formatDateInput(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? formatDateInput(row.effectiveTo) : null,
    version: row.version,
  }));

  return (
    resolveEffectiveSchedulingPolicy(mapped, asOfDate) ??
    buildDefaultSchedulingPolicySnapshot(organizationId, asOfDate)
  );
}

/** สร้าง WorkloadMonthlyInput จาก assignment ที่จะ archive */
function buildArchiveWorkloadInput(
  staff: readonly StaffSnapshot[],
  shiftCodes: readonly ShiftCodeSnapshot[],
  assignments: readonly ScheduleAssignment[],
  plannedNonWorkingDays: readonly PlannedNonWorkingDaySnapshot[],
  holidayDates: readonly string[],
): WorkloadMonthlyInput {
  return {
    staff,
    shiftCodes,
    assignments,
    holidayDates,
    plannedNonWorkingDays,
  };
}

/** สรุปเดือนที่เก่ากว่าหน้าต่างเป็น StaffWorkloadMonthly และลบรายละเอียดเมื่ออนุญาต */
export async function archiveHistoryWindow(
  db: ArchiveDbClient,
  options: ArchiveHistoryWindowOptions,
): Promise<ArchiveHistoryWindowResult> {
  const asOfDate = options.asOfDate ?? formatDateInput(new Date());
  const deleteDetailedData = options.deleteDetailedData ?? false;
  const policy = await loadEffectivePolicy(db, options.organizationId, asOfDate);
  const { windowStart } = computeHistoryWindow(asOfDate, policy.historyWindowMonths);

  const publishedVersions = await db.scheduleVersion.findMany({
    where: {
      organizationId: options.organizationId,
      status: { in: ["PUBLISHED", "LOCKED"] },
      scheduleCycle: {
        periodEnd: { lt: new Date(windowStart) },
      },
    },
    select: { id: true },
  });

  const versionIds = publishedVersions.map((version) => version.id);
  if (versionIds.length === 0) {
    return {
      policy,
      windowStart,
      archivedMonths: [],
      upsertedRows: 0,
      deletedAssignmentIds: [],
    };
  }

  const assignmentRows = await db.assignment.findMany({
    where: {
      organizationId: options.organizationId,
      scheduleVersionId: { in: versionIds },
      localDate: { lt: new Date(windowStart) },
    },
  });

  if (assignmentRows.length === 0) {
    return {
      policy,
      windowStart,
      archivedMonths: [],
      upsertedRows: 0,
      deletedAssignmentIds: [],
    };
  }

  const snapshot = await loadHistoryWindowSnapshot(db, {
    organizationId: options.organizationId,
    asOfDate,
  });

  const candidateMonths = [
    ...new Set(assignmentRows.map((row) => yearMonthFromDate(formatDateInput(row.localDate)))),
  ];
  const archivedMonths = yearMonthsBeforeWindow(windowStart, candidateMonths);

  if (archivedMonths.length === 0) {
    return {
      policy,
      windowStart,
      archivedMonths: [],
      upsertedRows: 0,
      deletedAssignmentIds: [],
    };
  }

  const archiveAssignments: ScheduleAssignment[] = assignmentRows.map((row) => ({
    id: row.id,
    staffId: row.staffProfileId,
    shiftCodeId: row.shiftCodeId ?? "",
    scheduleDate: formatDateInput(row.localDate),
    startAt: row.startsAt.toISOString(),
    endAt: row.endsAt.toISOString(),
    plannedOtHours: Number(row.plannedOtHours),
    isPinned: row.isPinned,
  }));

  const archivePlannedOff = snapshot.plannedNonWorkingDays.filter((entry) =>
    archivedMonths.includes(yearMonthFromDate(entry.localDate)),
  );

  const workloadInput = buildArchiveWorkloadInput(
    snapshot.staff,
    snapshot.shiftCodes,
    archiveAssignments,
    archivePlannedOff,
    snapshot.holidayDates,
  );

  const aggregated = aggregateStaffWorkloadMonthly(workloadInput, archivedMonths);
  let upsertedRows = 0;

  for (const row of aggregated) {
    const data = staffWorkloadMonthlyUpsertData(options.organizationId, row);
    await db.staffWorkloadMonthly.upsert({
      where: {
        organizationId_staffProfileId_yearMonth: {
          organizationId: options.organizationId,
          staffProfileId: row.staffId,
          yearMonth: row.yearMonth,
        },
      },
      create: data,
      update: {
        staffGroupId: data.staffGroupId,
        plannedHours: data.plannedHours,
        otHours: data.otHours,
        nightCount: data.nightCount,
        weekendCount: data.weekendCount,
        holidayCount: data.holidayCount,
        workedDays: data.workedDays,
        daysOff: data.daysOff,
        fteAtPeriod: data.fteAtPeriod,
        computedAt: data.computedAt,
      },
    });
    upsertedRows += 1;
  }

  const deletedAssignmentIds: string[] = [];
  if (deleteDetailedData) {
    const assignmentIds = assignmentRows.map((row) => row.id);
    await db.assignment.deleteMany({
      where: {
        organizationId: options.organizationId,
        id: { in: assignmentIds },
      },
    });
    deletedAssignmentIds.push(...assignmentIds);
  }

  return {
    policy,
    windowStart,
    archivedMonths,
    upsertedRows,
    deletedAssignmentIds,
  };
}

/** รัน archive ทุก org — ใช้จาก scheduled job */
export async function archiveHistoryWindowForAllOrganizations(
  db: PrismaClient,
  options?: {
    readonly asOfDate?: string;
    readonly deleteDetailedData?: boolean;
  },
): Promise<readonly ArchiveHistoryWindowResult[]> {
  const organizations = await db.organization.findMany({ select: { id: true } });
  const results: ArchiveHistoryWindowResult[] = [];

  for (const organization of organizations) {
    const result = await archiveHistoryWindow(db, {
      organizationId: organization.id,
      asOfDate: options?.asOfDate,
      deleteDetailedData: options?.deleteDetailedData,
    });
    results.push(result);
  }

  return results;
}
