import type {
  PlannedNonWorkingDaySnapshot,
  ScheduleAssignment,
  ShiftCodeSnapshot,
  StaffSnapshot,
  StaffWorkloadMonthlySnapshot,
} from "@/domain/schedule/types";
import type { SchedulingPolicySnapshot } from "@/domain/scheduling/policy";
import {
  buildDefaultSchedulingPolicySnapshot,
  resolveEffectiveSchedulingPolicy,
} from "@/domain/scheduling/policy";
import { computeHistoryWindow, fairnessLookbackYearMonths } from "@/domain/scheduling/window";
import type { Prisma, PrismaClient } from "@/generated/client/client";

/** ข้อมูลปฏิบัติการในหน้าต่าง history window */
export type HistoryWindowSnapshot = {
  readonly policy: SchedulingPolicySnapshot;
  readonly asOfDate: string;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly fairnessLookbackMonths: readonly string[];
  readonly assignments: readonly ScheduleAssignment[];
  readonly plannedNonWorkingDays: readonly PlannedNonWorkingDaySnapshot[];
  readonly staffWorkloadMonthly: readonly StaffWorkloadMonthlySnapshot[];
  readonly staff: readonly StaffSnapshot[];
  readonly shiftCodes: readonly ShiftCodeSnapshot[];
  readonly holidayDates: readonly string[];
};

/** ตัวเลือกโหลดหน้าต่างปฏิบัติการ */
export type LoadHistoryWindowOptions = {
  readonly organizationId: string;
  readonly asOfDate?: string;
};

type HistoryWindowDbClient = Pick<
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

/** แปลง SchedulingPolicy จาก Prisma */
function mapSchedulingPolicy(row: {
  id: string;
  organizationId: string;
  historyWindowMonths: number;
  fairnessLookbackMonths: number;
  planningHorizonMonths: number;
  publishLeadDays: number;
  otDerivationMode: SchedulingPolicySnapshot["otDerivationMode"];
  effectiveFrom: Date;
  effectiveTo: Date | null;
  version: number;
}): SchedulingPolicySnapshot {
  return {
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
  };
}

/** โหลด policy ที่มีผล ณ asOf */
async function loadEffectivePolicy(
  db: HistoryWindowDbClient,
  organizationId: string,
  asOfDate: string,
): Promise<SchedulingPolicySnapshot> {
  const policies = await db.schedulingPolicy.findMany({
    where: { organizationId },
    orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }],
  });

  const mapped = policies.map(mapSchedulingPolicy);
  return (
    resolveEffectiveSchedulingPolicy(mapped, asOfDate) ??
    buildDefaultSchedulingPolicySnapshot(organizationId, asOfDate)
  );
}

/** โหลดข้อมูลรายละเอียดเต็มเฉพาะในหน้าต่าง history window */
export async function loadHistoryWindowSnapshot(
  db: HistoryWindowDbClient,
  options: LoadHistoryWindowOptions,
): Promise<HistoryWindowSnapshot> {
  const asOfDate = options.asOfDate ?? formatDateInput(new Date());
  const policy = await loadEffectivePolicy(db, options.organizationId, asOfDate);
  const { windowStart, windowEnd } = computeHistoryWindow(asOfDate, policy.historyWindowMonths);
  const lookbackMonths = fairnessLookbackYearMonths(asOfDate, policy.fairnessLookbackMonths);

  const [staffRows, shiftCodeRows, publishedVersions, plannedOffRows, workloadRows, holidayRows] =
    await Promise.all([
      db.staffProfile.findMany({
        where: { organizationId: options.organizationId, active: true },
        include: {
          shiftAuthorizations: true,
          employmentContracts: {
            where: {
              effectiveFrom: { lte: new Date(windowEnd) },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date(windowStart) } }],
            },
            orderBy: { effectiveFrom: "desc" },
            take: 1,
          },
        },
        orderBy: [{ staffGroupId: "asc" }, { rowOrder: "asc" }],
      }),
      db.shiftCode.findMany({
        where: { organizationId: options.organizationId, deprecated: false },
      }),
      db.scheduleVersion.findMany({
        where: {
          organizationId: options.organizationId,
          status: { in: ["PUBLISHED", "LOCKED"] },
          scheduleCycle: {
            periodEnd: { gte: new Date(windowStart) },
            periodStart: { lte: new Date(windowEnd) },
          },
        },
        select: { id: true },
      }),
      db.plannedNonWorkingDay.findMany({
        where: {
          organizationId: options.organizationId,
          localDate: {
            gte: new Date(windowStart),
            lte: new Date(windowEnd),
          },
        },
        include: { nonWorkingDayKind: true },
      }),
      db.staffWorkloadMonthly.findMany({
        where: {
          organizationId: options.organizationId,
          yearMonth: { in: [...lookbackMonths] },
        },
      }),
      db.holidayDate.findMany({
        where: {
          holidayCalendar: { organizationId: options.organizationId },
          localDate: {
            gte: new Date(windowStart),
            lte: new Date(windowEnd),
          },
        },
      }),
    ]);

  const versionIds = publishedVersions.map((version) => version.id);
  const assignmentRows =
    versionIds.length === 0
      ? []
      : await db.assignment.findMany({
          where: {
            organizationId: options.organizationId,
            scheduleVersionId: { in: versionIds },
            localDate: {
              gte: new Date(windowStart),
              lte: new Date(windowEnd),
            },
          },
        });

  const shiftCodes: ShiftCodeSnapshot[] = shiftCodeRows.map((row) => ({
    id: row.id,
    code: row.canonicalCode,
    departmentId: row.departmentId ?? undefined,
    startTime: row.startTime ?? "00:00",
    endTime: row.endTime ?? "00:00",
    standardHours: row.standardHours ? Number(row.standardHours) : 0,
    otHours: Number(row.otHours),
    isNightShift: row.isNightShift,
    allowedGradeIds: [...row.allowedGradeCodes],
    needsConfirmation: row.needsConfirmation,
    active: !row.deprecated,
  }));

  const staff: StaffSnapshot[] = staffRows.map((row) => ({
    id: row.id,
    gradeId: row.staffGradeId,
    staffGroupId: row.staffGroupId ?? undefined,
    fte: row.employmentContracts[0] ? Number(row.employmentContracts[0].fte) : 1,
    shiftAuthorizations: row.shiftAuthorizations.map((entry) => ({
      shiftCodeId: entry.shiftCodeId,
      coversAllShiftCodes: entry.coversAllShiftCodes,
      validFrom: formatDateInput(entry.assessedAt),
      validTo: entry.expiresAt ? formatDateInput(entry.expiresAt) : null,
    })),
  }));

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

  const staffWorkloadMonthly: StaffWorkloadMonthlySnapshot[] = workloadRows.map((row) => ({
    staffId: row.staffProfileId,
    yearMonth: row.yearMonth,
    staffGroupId: row.staffGroupId ?? undefined,
    plannedHours: Number(row.plannedHours),
    otHours: Number(row.otHours),
    nightCount: row.nightCount,
    weekendCount: row.weekendCount,
    holidayCount: row.holidayCount,
    workedDays: row.workedDays,
    daysOff: row.daysOff,
    fteAtPeriod: Number(row.fteAtPeriod),
  }));

  return {
    policy,
    asOfDate,
    windowStart,
    windowEnd,
    fairnessLookbackMonths: lookbackMonths,
    assignments,
    plannedNonWorkingDays,
    staffWorkloadMonthly,
    staff,
    shiftCodes,
    holidayDates: holidayRows.map((row) => formatDateInput(row.localDate)).sort(),
  };
}

/** แปลง Prisma Decimal row เป็น number สำหรับ aggregate upsert */
export function staffWorkloadMonthlyUpsertData(
  organizationId: string,
  row: StaffWorkloadMonthlySnapshot,
): Prisma.StaffWorkloadMonthlyUpsertArgs["create"] {
  return {
    organizationId,
    staffProfileId: row.staffId,
    yearMonth: row.yearMonth,
    staffGroupId: row.staffGroupId ?? null,
    plannedHours: row.plannedHours,
    otHours: row.otHours,
    nightCount: row.nightCount,
    weekendCount: row.weekendCount,
    holidayCount: row.holidayCount,
    workedDays: row.workedDays,
    daysOff: row.daysOff,
    fteAtPeriod: row.fteAtPeriod,
    computedAt: new Date(),
  };
}
