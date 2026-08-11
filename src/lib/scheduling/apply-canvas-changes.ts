import type { CanvasCellChangeInput, CanvasPlannedOffChangeInput } from "@/domain/schedule/schemas";
import { buildAssignmentInterval, localDateTimeToIso } from "@/domain/schedule/time";
import type { ConstraintViolation, ScheduleEngineInput } from "@/domain/schedule/types";
import type { Prisma, PrismaClient } from "@/generated/client/client";
import type { ShiftCodeOption } from "@/lib/scheduling/load-canvas-draft";

type CanvasMutationDb = Pick<PrismaClient, "assignment" | "plannedNonWorkingDay">;

/** hard rule ที่ manual planned off ยอมให้ชั่วคราว — เกลี่ยเองแล้วค่อยลบ */
const DEFERRABLE_MANUAL_PLANNED_OFF_CODES = new Set<string>([
  "DAY_OFF_QUOTA",
  "MAX_STAFF_OFF_PER_DAY",
]);

/** กรอง violation ที่ยังบล็อก commit — ยกเว้นโควตา/เพดานต่อวันเมื่อ commit เฉพาะ planned off */
export function resolveBlockingNewHardViolations(
  newHardViolations: readonly ConstraintViolation[],
  input: {
    readonly cellChangeCount: number;
    readonly plannedOffChangeCount: number;
    readonly staffRowOrderCount: number;
  },
): readonly ConstraintViolation[] {
  const plannedOffOnly =
    input.plannedOffChangeCount > 0 &&
    input.cellChangeCount === 0 &&
    input.staffRowOrderCount === 0;

  if (!plannedOffOnly) {
    return newHardViolations;
  }

  return newHardViolations.filter(
    (violation) => !DEFERRABLE_MANUAL_PLANNED_OFF_CODES.has(violation.code),
  );
}

/** หา shift code จากข้อความที่พิมพ์ */
export function resolveShiftCodeInput(
  text: string,
  shiftCodes: readonly ShiftCodeOption[],
): ShiftCodeOption | null {
  const normalized = text.trim();
  if (!normalized) {
    return null;
  }

  return shiftCodes.find((code) => code.code.toLowerCase() === normalized.toLowerCase()) ?? null;
}

/** สร้างช่วงเวลา assignment */
export function buildIntervalForShift(
  shiftCode: ShiftCodeOption,
  localDate: string,
  timezone: string,
): { startsAt: Date; endsAt: Date } {
  const hasTimes = Boolean(shiftCode.startTime && shiftCode.endTime);
  const interval = hasTimes
    ? buildAssignmentInterval(
        {
          startTime: shiftCode.startTime!,
          endTime: shiftCode.endTime!,
        },
        localDate,
        timezone,
      )
    : {
        startAt: localDateTimeToIso(localDate, "00:00", timezone),
        endAt: localDateTimeToIso(localDate, "00:00", timezone),
      };

  return {
    startsAt: new Date(interval.startAt),
    endsAt: new Date(interval.endAt),
  };
}

/** ใช้การเปลี่ยนเซลล์ assignment ลง draft version */
export async function applyCanvasCellChange(
  db: CanvasMutationDb,
  args: {
    organizationId: string;
    draftId: string;
    draftVersionId: string;
    timezone: string;
    shiftCodes: readonly ShiftCodeOption[];
    change: CanvasCellChangeInput;
    overrideReason?: string;
  },
): Promise<void> {
  const { change } = args;
  const normalized = change.shiftCodeText.trim();

  const existing = await db.assignment.findFirst({
    where: {
      organizationId: args.organizationId,
      scheduleVersionId: args.draftVersionId,
      staffProfileId: change.staffProfileId,
      localDate: new Date(change.localDate),
    },
  });

  if (existing?.isPinned && change.isPinned !== false) {
    throw new Error("เซลล์นี้ถูกล็อก — ปลดล็อกก่อนแก้ไข");
  }

  const lockedOff = await db.plannedNonWorkingDay.findFirst({
    where: {
      organizationId: args.organizationId,
      scheduleDraftId: args.draftId,
      staffProfileId: change.staffProfileId,
      localDate: new Date(change.localDate),
      locked: true,
    },
  });

  if (lockedOff) {
    throw new Error("วันหยุดนี้ถูกล็อก — ปลดล็อกก่อนแก้ไข");
  }

  if (!normalized) {
    if (existing) {
      await db.assignment.delete({ where: { id: existing.id } });
    }
    return;
  }

  const shiftCode = resolveShiftCodeInput(normalized, args.shiftCodes);
  if (!shiftCode) {
    throw new Error(`ไม่พบรหัสเวร "${normalized}"`);
  }

  const interval = buildIntervalForShift(shiftCode, change.localDate, args.timezone);
  const plannedOtHours = change.plannedOtHours ?? shiftCode.otHours;

  if (existing) {
    await db.assignment.update({
      where: { id: existing.id },
      data: {
        shiftCodeId: shiftCode.id,
        startsAt: interval.startsAt,
        endsAt: interval.endsAt,
        plannedOtHours,
        isPinned: change.isPinned ?? existing.isPinned,
        isManualOverride: true,
        overrideReason: args.overrideReason ?? existing.overrideReason,
      },
    });
    return;
  }

  await db.assignment.create({
    data: {
      organizationId: args.organizationId,
      scheduleVersionId: args.draftVersionId,
      staffProfileId: change.staffProfileId,
      shiftCodeId: shiftCode.id,
      localDate: new Date(change.localDate),
      startsAt: interval.startsAt,
      endsAt: interval.endsAt,
      plannedOtHours,
      isPinned: change.isPinned ?? false,
      isManualOverride: true,
      overrideReason: args.overrideReason ?? null,
    },
  });
}

/** ลบ assignment ในเซลล์เมื่อลงวันหยุดที่บล็อกการจัดเวร */
async function clearAssignmentForPlannedOffSet(
  db: CanvasMutationDb,
  args: {
    organizationId: string;
    draftVersionId: string;
    staffProfileId: string;
    localDate: string;
  },
): Promise<void> {
  const existing = await db.assignment.findFirst({
    where: {
      organizationId: args.organizationId,
      scheduleVersionId: args.draftVersionId,
      staffProfileId: args.staffProfileId,
      localDate: new Date(args.localDate),
    },
  });

  if (!existing) {
    return;
  }

  if (existing.isPinned) {
    throw new Error("เซลล์นี้ถูกล็อก — ปลดล็อกก่อนลงวันหยุด");
  }

  await db.assignment.delete({ where: { id: existing.id } });
}

/** ใช้การเปลี่ยนวันหยุดที่วางแผน */
export async function applyCanvasPlannedOffChange(
  db: CanvasMutationDb,
  args: {
    organizationId: string;
    draftId: string;
    draftVersionId: string;
    defaultOffKindId: string;
    resolveKindBlocksScheduling: (kindId: string) => boolean;
    change: CanvasPlannedOffChangeInput;
  },
): Promise<void> {
  const { change } = args;

  if (change.action === "clear") {
    const existing = await db.plannedNonWorkingDay.findFirst({
      where: {
        organizationId: args.organizationId,
        scheduleDraftId: args.draftId,
        staffProfileId: change.staffProfileId,
        localDate: new Date(change.localDate),
      },
    });

    if (existing?.locked) {
      throw new Error("วันหยุดนี้ถูกล็อก — ปลดล็อกก่อนลบ");
    }

    if (existing) {
      await db.plannedNonWorkingDay.delete({ where: { id: existing.id } });
    }
    return;
  }

  const kindId = change.nonWorkingDayKindId ?? args.defaultOffKindId;
  const blocksScheduling = args.resolveKindBlocksScheduling(kindId);

  if (blocksScheduling) {
    await clearAssignmentForPlannedOffSet(db, {
      organizationId: args.organizationId,
      draftVersionId: args.draftVersionId,
      staffProfileId: change.staffProfileId,
      localDate: change.localDate,
    });
  }

  await db.plannedNonWorkingDay.upsert({
    where: {
      scheduleDraftId_staffProfileId_localDate: {
        scheduleDraftId: args.draftId,
        staffProfileId: change.staffProfileId,
        localDate: new Date(change.localDate),
      },
    },
    create: {
      organizationId: args.organizationId,
      scheduleDraftId: args.draftId,
      staffProfileId: change.staffProfileId,
      localDate: new Date(change.localDate),
      nonWorkingDayKindId: kindId,
      source: "MANUAL",
      locked: change.locked ?? false,
    },
    update: {
      nonWorkingDayKindId: kindId,
      locked: change.locked ?? false,
    },
  });
}

/** สร้าง engine input หลัง apply changes สำหรับ validate */
export function mergeCellChangesIntoEngineInput(
  base: ScheduleEngineInput,
  cellChanges: readonly CanvasCellChangeInput[],
  shiftCodes: readonly ShiftCodeOption[],
  timezone: string,
): ScheduleEngineInput {
  if (cellChanges.length === 0) {
    return base;
  }

  const changedKeys = new Set(
    cellChanges.map((change) => `${change.staffProfileId}:${change.localDate}`),
  );

  let assignments = base.assignments.filter(
    (assignment) => !changedKeys.has(`${assignment.staffId}:${assignment.scheduleDate}`),
  );

  for (const change of cellChanges) {
    const shiftCode = resolveShiftCodeInput(change.shiftCodeText, shiftCodes);
    if (!shiftCode) {
      continue;
    }

    const interval = buildIntervalForShift(shiftCode, change.localDate, timezone);
    assignments = [
      ...assignments,
      {
        id: `${change.staffProfileId}:${change.localDate}`,
        staffId: change.staffProfileId,
        shiftCodeId: shiftCode.id,
        scheduleDate: change.localDate,
        startAt: interval.startsAt.toISOString(),
        endAt: interval.endsAt.toISOString(),
        plannedOtHours: change.plannedOtHours ?? shiftCode.otHours,
        isPinned: change.isPinned ?? false,
      },
    ];
  }

  return {
    ...base,
    assignments,
  };
}

/** สร้าง planned off หลัง apply changes */
export function mergePlannedOffChanges(
  base: ScheduleEngineInput,
  plannedOffChanges: readonly CanvasPlannedOffChangeInput[],
  resolveKind: (kindId: string) => { readonly blocksScheduling: boolean },
  defaultOffKindId: string,
): ScheduleEngineInput {
  if (plannedOffChanges.length === 0) {
    return base;
  }

  const changedKeys = new Set(
    plannedOffChanges.map((change) => `${change.staffProfileId}:${change.localDate}`),
  );

  let plannedNonWorkingDays = base.plannedNonWorkingDays.filter(
    (entry) => !changedKeys.has(`${entry.staffId}:${entry.localDate}`),
  );
  let assignments = base.assignments;

  for (const change of plannedOffChanges) {
    if (change.action === "clear") {
      continue;
    }
    const kindId = change.nonWorkingDayKindId ?? defaultOffKindId;
    const blocksScheduling = resolveKind(kindId).blocksScheduling;
    if (blocksScheduling) {
      assignments = assignments.filter(
        (assignment) =>
          !(
            assignment.staffId === change.staffProfileId &&
            assignment.scheduleDate === change.localDate
          ),
      );
    }
    plannedNonWorkingDays = [
      ...plannedNonWorkingDays,
      {
        staffId: change.staffProfileId,
        localDate: change.localDate,
        nonWorkingDayKindId: kindId,
        blocksScheduling,
        locked: change.locked ?? false,
      },
    ];
  }

  return {
    ...base,
    assignments,
    plannedNonWorkingDays,
  };
}

/** สรุป audit after state แบบย่อ */
export function summarizeCommitAudit(args: {
  cellChanges: readonly CanvasCellChangeInput[];
  plannedOffChanges: readonly CanvasPlannedOffChangeInput[];
  staffRowOrders: readonly {
    staffProfileId: string;
    staffGroupId: string | null;
    rowOrder: number;
  }[];
  staffDayOffQuotas?: readonly { staffProfileId: string; daysOffQuota: number }[];
  overrideReason?: string;
  acceptedHardViolationCount?: number;
}): Prisma.InputJsonValue {
  return {
    cellChangeCount: args.cellChanges.length,
    plannedOffChangeCount: args.plannedOffChanges.length,
    staffRowOrderCount: args.staffRowOrders.length,
    staffDayOffQuotaCount: args.staffDayOffQuotas?.length ?? 0,
    ...(args.overrideReason
      ? {
          overrideReason: args.overrideReason,
          acceptedHardViolationCount: args.acceptedHardViolationCount ?? 0,
        }
      : {}),
  };
}
