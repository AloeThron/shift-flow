"use server";

import type { ActionResult } from "@/domain/action-result";
import {
  type CommitCanvasChangesInput,
  commitCanvasChangesSchema,
} from "@/domain/schedule/schemas";
import { validateIncremental } from "@/domain/schedule/validate";
import { actionErrorMessage } from "@/lib/auth/get-organization-context";
import {
  canWriteScheduleDraft,
  getOrganizationTimezone,
  requireScheduleDraftWriteAccess,
  requireScheduleReadAccess,
} from "@/lib/auth/schedule-access";
import { recordAuditEvent } from "@/lib/db/audit";
import { createScopedRepository } from "@/lib/db/scoped-repository";
import { prisma } from "@/lib/prisma";
import {
  applyCanvasCellChange,
  applyCanvasPlannedOffChange,
  mergeCellChangesIntoEngineInput,
  mergePlannedOffChanges,
  resolveBlockingNewHardViolations,
  resolveShiftCodeInput,
  summarizeCommitAudit,
} from "@/lib/scheduling/apply-canvas-changes";
import { assertOptimisticVersion, bumpOptimisticVersion } from "@/lib/scheduling/draft-concurrency";
import { ensurePlanningCycles } from "@/lib/scheduling/ensure-planning-cycles";
import {
  type CanvasDraftSnapshot,
  loadCanvasDraftSnapshot,
} from "@/lib/scheduling/load-canvas-draft";
import { persistStaffDayOffQuotas, persistStaffRowOrders } from "@/lib/scheduling/persist-draft";
import { isDateInCycle } from "@/lib/scheduling/solver-input";

/** ผลลัพธ์ canvas พร้อมสิทธิ์แก้ไข */
export type ScheduleCanvasPayload = CanvasDraftSnapshot & {
  readonly canWrite: boolean;
};

/** โหลด canvas สำหรับรอบที่กำหนด */
export async function getScheduleCanvasAction(
  cycleId: string,
): Promise<ActionResult<ScheduleCanvasPayload>> {
  try {
    const ctx = await requireScheduleReadAccess();

    let snapshot = await loadCanvasDraftSnapshot(prisma, {
      organizationId: ctx.organizationId,
      cycleId,
    });

    if (!snapshot) {
      await ensurePlanningCycles(prisma, { organizationId: ctx.organizationId });
      snapshot = await loadCanvasDraftSnapshot(prisma, {
        organizationId: ctx.organizationId,
        cycleId,
      });
    }

    if (!snapshot) {
      return { ok: false, error: "ไม่พบรอบตารางหรือ draft ที่แก้ได้" };
    }

    return {
      ok: true,
      data: {
        ...snapshot,
        canWrite: canWriteScheduleDraft(ctx),
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** commit การแก้ canvas แบบ bulk พร้อม validate hard constraints */
export async function commitCanvasChangesAction(
  input: CommitCanvasChangesInput,
): Promise<ActionResult<{ optimisticVersion: number }>> {
  try {
    const ctx = await requireScheduleDraftWriteAccess();

    const parsed = commitCanvasChangesSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }

    const data = parsed.data;
    const cellChanges = data.cellChanges ?? [];
    const plannedOffChanges = data.plannedOffChanges ?? [];
    const staffRowOrders = data.staffRowOrders ?? [];
    const staffDayOffQuotas = data.staffDayOffQuotas ?? [];

    if (
      cellChanges.length === 0 &&
      plannedOffChanges.length === 0 &&
      staffRowOrders.length === 0 &&
      staffDayOffQuotas.length === 0
    ) {
      return { ok: false, error: "ไม่มีการเปลี่ยนแปลงที่จะบันทึก" };
    }

    const snapshot = await loadCanvasDraftSnapshot(prisma, {
      organizationId: ctx.organizationId,
      cycleId: data.cycleId,
    });

    if (!snapshot || snapshot.draftId !== data.draftId) {
      return { ok: false, error: "ไม่พบ draft ที่ตรงกับรอบ" };
    }

    if (snapshot.draftVersionId !== data.draftVersionId) {
      return { ok: false, error: "draft version ไม่ตรงกับ snapshot ปัจจุบัน" };
    }

    for (const change of cellChanges) {
      if (!isDateInCycle(snapshot.engineInput, change.localDate)) {
        return { ok: false, error: `วันที่ ${change.localDate} อยู่นอกรอบที่แก้ได้` };
      }

      const normalized = change.shiftCodeText.trim();
      if (normalized && !resolveShiftCodeInput(normalized, snapshot.shiftCodes)) {
        return { ok: false, error: `ไม่พบรหัสเวร "${normalized}"` };
      }
    }

    for (const change of plannedOffChanges) {
      if (!isDateInCycle(snapshot.engineInput, change.localDate)) {
        return { ok: false, error: `วันที่ ${change.localDate} อยู่นอกรอบที่แก้ได้` };
      }
    }

    const timezone = await getOrganizationTimezone(ctx);
    if (!snapshot.defaultOffKindId) {
      return { ok: false, error: "ไม่พบชนิดวันหยุดในระบบ" };
    }

    const hasScheduleChanges = cellChanges.length > 0 || plannedOffChanges.length > 0;

    let mergedEngineInput = snapshot.engineInput;
    let beforeValidation = validateIncremental(snapshot.engineInput, {
      changedStaffIds: [],
      changedDates: [],
    });
    let afterValidation = beforeValidation;
    let newHardViolations: typeof beforeValidation.hardViolations = [];

    if (hasScheduleChanges) {
      mergedEngineInput = mergeCellChangesIntoEngineInput(
        snapshot.engineInput,
        cellChanges,
        snapshot.shiftCodes,
        timezone,
      );
      mergedEngineInput = mergePlannedOffChanges(
        mergedEngineInput,
        plannedOffChanges,
        (kindId) =>
          snapshot.nonWorkingDayKinds.find((kind) => kind.id === kindId) ?? {
            blocksScheduling: true,
          },
        snapshot.defaultOffKindId,
      );

      const changedStaffIds = [
        ...new Set([
          ...cellChanges.map((change) => change.staffProfileId),
          ...plannedOffChanges.map((change) => change.staffProfileId),
        ]),
      ];
      const changedDates = [
        ...new Set([
          ...cellChanges.map((change) => change.localDate),
          ...plannedOffChanges.map((change) => change.localDate),
        ]),
      ];

      const validationScope = { changedStaffIds, changedDates };
      beforeValidation = validateIncremental(snapshot.engineInput, validationScope);
      afterValidation = validateIncremental(mergedEngineInput, validationScope);

      const violationKey = (violation: (typeof afterValidation.hardViolations)[number]): string =>
        JSON.stringify({
          code: violation.code,
          staffId: violation.staffId ?? null,
          assignmentId: violation.assignmentId ?? null,
          scheduleDate: violation.scheduleDate ?? null,
          departmentId: violation.departmentId ?? null,
          details: violation.details ?? null,
        });

      const beforeKeys = new Set(beforeValidation.hardViolations.map(violationKey));
      newHardViolations = afterValidation.hardViolations.filter(
        (violation) => !beforeKeys.has(violationKey(violation)),
      );
    }

    const blockingNewHardViolations = hasScheduleChanges
      ? resolveBlockingNewHardViolations(newHardViolations, {
          cellChangeCount: cellChanges.length,
          plannedOffChangeCount: plannedOffChanges.length,
          staffRowOrderCount: staffRowOrders.length,
        })
      : [];

    const overrideReason = data.override?.reason?.trim();
    const usingOverride = Boolean(overrideReason);

    if (blockingNewHardViolations.length > 0 && !usingOverride) {
      const first = blockingNewHardViolations[0];
      return {
        ok: false,
        error: first?.messageTh ?? "ตารางมี hard constraint ที่ละเมิด — แก้ก่อนบันทึก",
      };
    }

    await assertOptimisticVersion(prisma, data.draftId, data.optimisticVersion, ctx.organizationId);

    await prisma.$transaction(async (tx) => {
      for (const change of cellChanges) {
        await applyCanvasCellChange(tx, {
          organizationId: ctx.organizationId,
          draftId: data.draftId,
          draftVersionId: data.draftVersionId,
          timezone,
          shiftCodes: snapshot.shiftCodes,
          change,
          overrideReason: usingOverride ? overrideReason : undefined,
        });
      }

      for (const change of plannedOffChanges) {
        await applyCanvasPlannedOffChange(tx, {
          organizationId: ctx.organizationId,
          draftId: data.draftId,
          draftVersionId: data.draftVersionId,
          defaultOffKindId: snapshot.defaultOffKindId!,
          resolveKindBlocksScheduling: (kindId) =>
            snapshot.nonWorkingDayKinds.find((kind) => kind.id === kindId)?.blocksScheduling ??
            true,
          change,
        });
      }

      if (staffRowOrders.length > 0) {
        await persistStaffRowOrders(tx, ctx.organizationId, staffRowOrders);
      }

      if (staffDayOffQuotas.length > 0) {
        await persistStaffDayOffQuotas(tx, ctx.organizationId, data.draftId, staffDayOffQuotas);
      }
    });

    const optimisticVersion = await bumpOptimisticVersion(prisma, data.draftId, ctx.organizationId);

    const repo = createScopedRepository(ctx, prisma);
    const auditSummary = summarizeCommitAudit({
      cellChanges,
      plannedOffChanges,
      staffRowOrders,
      staffDayOffQuotas,
      overrideReason: usingOverride ? overrideReason : undefined,
      acceptedHardViolationCount: usingOverride ? newHardViolations.length : undefined,
    });

    if (usingOverride && newHardViolations.length > 0) {
      await recordAuditEvent(repo, ctx, {
        action: "OVERRIDE",
        entityType: "ScheduleDraft",
        entityId: data.draftId,
        after: {
          cellChangeCount: cellChanges.length,
          plannedOffChangeCount: plannedOffChanges.length,
          staffRowOrderCount: staffRowOrders.length,
          staffDayOffQuotaCount: staffDayOffQuotas.length,
          overrideReason,
          acceptedHardViolationCount: newHardViolations.length,
          acceptedHardViolations: newHardViolations.map((violation) => ({
            code: violation.code,
            messageTh: violation.messageTh,
            staffId: violation.staffId ?? null,
            scheduleDate: violation.scheduleDate ?? null,
          })),
        },
        reason: overrideReason,
        correlationId: `canvas-override:${data.draftId}:${optimisticVersion}`,
      });
    } else {
      await recordAuditEvent(repo, ctx, {
        action: "UPDATE",
        entityType: "ScheduleDraft",
        entityId: data.draftId,
        after: auditSummary,
        correlationId: `canvas-commit:${data.draftId}:${optimisticVersion}`,
      });
    }

    return { ok: true, data: { optimisticVersion } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** อัปเดตเซลล์ด้วยรหัสเวรที่พิมพ์ */
export async function updateCanvasCellAction(input: {
  cycleId: string;
  draftId: string;
  draftVersionId: string;
  optimisticVersion: number;
  staffProfileId: string;
  localDate: string;
  shiftCodeText: string;
}): Promise<ActionResult<{ optimisticVersion: number }>> {
  return commitCanvasChangesAction({
    cycleId: input.cycleId,
    draftId: input.draftId,
    draftVersionId: input.draftVersionId,
    optimisticVersion: input.optimisticVersion,
    cellChanges: [
      {
        staffProfileId: input.staffProfileId,
        localDate: input.localDate,
        shiftCodeText: input.shiftCodeText,
      },
    ],
  });
}

/** สลับสถานะล็อกเซลล์ */
export async function toggleCanvasCellPinAction(input: {
  draftId: string;
  optimisticVersion: number;
  staffProfileId: string;
  localDate: string;
  draftVersionId: string;
  pinned: boolean;
}): Promise<ActionResult<{ optimisticVersion: number }>> {
  try {
    const ctx = await requireScheduleDraftWriteAccess();
    await assertOptimisticVersion(
      prisma,
      input.draftId,
      input.optimisticVersion,
      ctx.organizationId,
    );

    const assignment = await prisma.assignment.findFirst({
      where: {
        organizationId: ctx.organizationId,
        scheduleVersionId: input.draftVersionId,
        staffProfileId: input.staffProfileId,
        localDate: new Date(input.localDate),
      },
    });

    if (!assignment) {
      return { ok: false, error: "ไม่มี assignment ในเซลล์นี้ — ล็อกได้เมื่อมีรหัสเวรแล้ว" };
    }

    await prisma.assignment.update({
      where: { id: assignment.id },
      data: { isPinned: input.pinned },
    });

    const optimisticVersion = await bumpOptimisticVersion(
      prisma,
      input.draftId,
      ctx.organizationId,
    );
    return { ok: true, data: { optimisticVersion } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** ลงวันหยุดที่วางแผน (Stage A manual) */
export async function setCanvasPlannedDayOffAction(input: {
  cycleId: string;
  draftId: string;
  optimisticVersion: number;
  staffProfileId: string;
  localDate: string;
  nonWorkingDayKindId?: string;
  locked?: boolean;
}): Promise<ActionResult<{ optimisticVersion: number }>> {
  try {
    const ctx = await requireScheduleDraftWriteAccess();
    const snapshot = await loadCanvasDraftSnapshot(prisma, {
      organizationId: ctx.organizationId,
      cycleId: input.cycleId,
    });

    if (!snapshot || snapshot.draftId !== input.draftId) {
      return { ok: false, error: "ไม่พบ draft ที่ตรงกับรอบ" };
    }

    return commitCanvasChangesAction({
      cycleId: input.cycleId,
      draftId: input.draftId,
      draftVersionId: snapshot.draftVersionId,
      optimisticVersion: input.optimisticVersion,
      plannedOffChanges: [
        {
          staffProfileId: input.staffProfileId,
          localDate: input.localDate,
          action: "set",
          nonWorkingDayKindId: input.nonWorkingDayKindId,
          locked: input.locked,
        },
      ],
    });
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** ลบวันหยุดที่วางแผน */
export async function clearCanvasPlannedDayOffAction(input: {
  draftId: string;
  optimisticVersion: number;
  staffProfileId: string;
  localDate: string;
}): Promise<ActionResult<{ optimisticVersion: number }>> {
  try {
    const ctx = await requireScheduleDraftWriteAccess();

    const draft = await prisma.scheduleDraft.findFirst({
      where: {
        id: input.draftId,
        organizationId: ctx.organizationId,
      },
      select: { scheduleCycleId: true },
    });
    if (!draft) {
      return { ok: false, error: "ไม่พบ draft" };
    }

    const snapshot = await loadCanvasDraftSnapshot(prisma, {
      organizationId: ctx.organizationId,
      cycleId: draft.scheduleCycleId,
    });
    if (!snapshot) {
      return { ok: false, error: "ไม่พบ draft" };
    }

    return commitCanvasChangesAction({
      cycleId: snapshot.cycleId,
      draftId: input.draftId,
      draftVersionId: snapshot.draftVersionId,
      optimisticVersion: input.optimisticVersion,
      plannedOffChanges: [
        {
          staffProfileId: input.staffProfileId,
          localDate: input.localDate,
          action: "clear",
        },
      ],
    });
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}
