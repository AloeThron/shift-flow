import type { PlannedNonWorkingDayPlan } from "@/domain/optimize/day-off";
import { buildAssignmentInterval } from "@/domain/schedule/time";
import type { ScheduleAssignment, ShiftCodeSnapshot } from "@/domain/schedule/types";
import type { Prisma, PrismaClient } from "@/generated/client/client";

type PersistDbClient = Pick<
  PrismaClient,
  "assignment" | "plannedNonWorkingDay" | "staffProfile" | "draftStaffDayOffQuota"
>;

/** ข้อมูล shift code สำหรับ persist */
export type PersistShiftCode = {
  readonly id: string;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly otHours: number;
};

/** แปลง assignment domain → prisma create data */
function toAssignmentCreateData(args: {
  organizationId: string;
  scheduleVersionId: string;
  assignment: ScheduleAssignment;
  shiftCode: PersistShiftCode;
  timezone: string;
  isManualOverride: boolean;
}): Prisma.AssignmentUncheckedCreateInput {
  const hasTimes = Boolean(args.shiftCode.startTime && args.shiftCode.endTime);
  const interval = hasTimes
    ? buildAssignmentInterval(
        {
          startTime: args.shiftCode.startTime!,
          endTime: args.shiftCode.endTime!,
        },
        args.assignment.scheduleDate,
        args.timezone,
      )
    : {
        startAt: args.assignment.startAt,
        endAt: args.assignment.endAt,
      };

  return {
    organizationId: args.organizationId,
    scheduleVersionId: args.scheduleVersionId,
    staffProfileId: args.assignment.staffId,
    shiftCodeId: args.assignment.shiftCodeId,
    localDate: new Date(args.assignment.scheduleDate),
    startsAt: new Date(interval.startAt ?? args.assignment.startAt),
    endsAt: new Date(interval.endAt ?? args.assignment.endAt),
    plannedOtHours: args.assignment.plannedOtHours ?? args.shiftCode.otHours,
    isPinned: args.assignment.isPinned ?? false,
    isManualOverride: args.isManualOverride,
  };
}

/** บันทึกผล Stage B — คง pinned และแทนที่ non-pinned ในรอบ */
export async function persistBalanceAssignments(
  db: PersistDbClient,
  args: {
    organizationId: string;
    scheduleVersionId: string;
    periodStart: string;
    periodEnd: string;
    timezone: string;
    shiftCodes: readonly PersistShiftCode[];
    solverAssignments: readonly ScheduleAssignment[];
  },
): Promise<{ created: number; removed: number }> {
  const shiftById = new Map(args.shiftCodes.map((code) => [code.id, code]));

  const existing = await db.assignment.findMany({
    where: {
      organizationId: args.organizationId,
      scheduleVersionId: args.scheduleVersionId,
      localDate: {
        gte: new Date(args.periodStart),
        lte: new Date(args.periodEnd),
      },
    },
    select: { id: true, isPinned: true },
  });

  const removableIds = existing.filter((row) => !row.isPinned).map((row) => row.id);
  if (removableIds.length > 0) {
    await db.assignment.deleteMany({
      where: {
        organizationId: args.organizationId,
        id: { in: removableIds },
      },
    });
  }

  let created = 0;
  for (const assignment of args.solverAssignments) {
    if (assignment.isPinned) {
      continue;
    }

    const shiftCode = shiftById.get(assignment.shiftCodeId);
    if (!shiftCode) {
      continue;
    }

    await db.assignment.create({
      data: toAssignmentCreateData({
        organizationId: args.organizationId,
        scheduleVersionId: args.scheduleVersionId,
        assignment,
        shiftCode,
        timezone: args.timezone,
        isManualOverride: false,
      }),
    });
    created += 1;
  }

  return { created, removed: removableIds.length };
}

/** บันทึกผล Stage A — คง locked และแทนที่ non-locked ในรอบ */
export async function persistDayOffPlan(
  db: PersistDbClient,
  args: {
    organizationId: string;
    scheduleDraftId: string;
    periodStart: string;
    periodEnd: string;
    plannedDays: readonly PlannedNonWorkingDayPlan[];
  },
): Promise<{ upserted: number; removed: number }> {
  const existing = await db.plannedNonWorkingDay.findMany({
    where: {
      organizationId: args.organizationId,
      scheduleDraftId: args.scheduleDraftId,
      localDate: {
        gte: new Date(args.periodStart),
        lte: new Date(args.periodEnd),
      },
    },
    select: { id: true, locked: true },
  });

  const removableIds = existing.filter((row) => !row.locked).map((row) => row.id);
  if (removableIds.length > 0) {
    await db.plannedNonWorkingDay.deleteMany({
      where: {
        organizationId: args.organizationId,
        id: { in: removableIds },
      },
    });
  }

  let upserted = 0;
  for (const planned of args.plannedDays) {
    await db.plannedNonWorkingDay.upsert({
      where: {
        scheduleDraftId_staffProfileId_localDate: {
          scheduleDraftId: args.scheduleDraftId,
          staffProfileId: planned.staffId,
          localDate: new Date(planned.localDate),
        },
      },
      create: {
        organizationId: args.organizationId,
        scheduleDraftId: args.scheduleDraftId,
        staffProfileId: planned.staffId,
        localDate: new Date(planned.localDate),
        nonWorkingDayKindId: planned.nonWorkingDayKindId,
        source: planned.source,
        locked: planned.locked,
      },
      update: {
        nonWorkingDayKindId: planned.nonWorkingDayKindId,
        source: planned.source,
        locked: planned.locked,
      },
    });
    upserted += 1;
  }

  return { upserted, removed: removableIds.length };
}

/** อัปเดตลำดับแถว staff ในกลุ่ม */
export async function persistStaffRowOrders(
  db: PersistDbClient,
  organizationId: string,
  rows: readonly { staffProfileId: string; staffGroupId: string | null; rowOrder: number }[],
): Promise<number> {
  let updated = 0;

  for (const row of rows) {
    const result = await db.staffProfile.updateMany({
      where: {
        id: row.staffProfileId,
        organizationId,
      },
      data: {
        staffGroupId: row.staffGroupId,
        rowOrder: row.rowOrder,
      },
    });
    updated += result.count;
  }

  return updated;
}

const DRAFT_STAFF_DAY_OFF_QUOTA_UNAVAILABLE =
  "ยังบันทึกโควตา OFF ไม่ได้ — รัน pnpm prisma generate && pnpm prisma migrate deploy แล้ว restart dev server";

/** คืน delegate โควตา OFF — แจ้งข้อความชัดเจนถ้า client/migration ยังไม่พร้อม */
function requireDraftStaffDayOffQuotaDb(db: PersistDbClient) {
  const delegate = db.draftStaffDayOffQuota;
  if (!delegate?.upsert) {
    throw new Error(DRAFT_STAFF_DAY_OFF_QUOTA_UNAVAILABLE);
  }
  return delegate;
}

/** บันทึกโควตาวันหยุดต่อคนใน draft */
export async function persistStaffDayOffQuotas(
  db: PersistDbClient,
  organizationId: string,
  scheduleDraftId: string,
  rows: readonly { staffProfileId: string; daysOffQuota: number }[],
): Promise<number> {
  const quotaDb = requireDraftStaffDayOffQuotaDb(db);
  let upserted = 0;

  for (const row of rows) {
    try {
      await quotaDb.upsert({
        where: {
          scheduleDraftId_staffProfileId: {
            scheduleDraftId,
            staffProfileId: row.staffProfileId,
          },
        },
        create: {
          organizationId,
          scheduleDraftId,
          staffProfileId: row.staffProfileId,
          daysOffQuota: row.daysOffQuota,
        },
        update: {
          daysOffQuota: row.daysOffQuota,
        },
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2021"
      ) {
        throw new Error(DRAFT_STAFF_DAY_OFF_QUOTA_UNAVAILABLE);
      }
      throw error;
    }
    upserted += 1;
  }

  return upserted;
}

/** map shift snapshot สำหรับ persist */
export function toPersistShiftCodes(shiftCodes: readonly ShiftCodeSnapshot[]): PersistShiftCode[] {
  return shiftCodes.map((code) => ({
    id: code.id,
    startTime: code.startTime,
    endTime: code.endTime,
    otHours: code.otHours ?? 0,
  }));
}
