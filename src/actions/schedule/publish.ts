"use server";

import type { ActionResult } from "@/domain/action-result";
import { canTransitionScheduleVersion } from "@/domain/schedule/lifecycle";
import { type PublishScheduleInput, publishScheduleSchema } from "@/domain/schedule/schemas";
import { createShareToken, hashShareToken } from "@/domain/schedule/share/token";
import { validateSchedule } from "@/domain/schedule/validate";
import { env } from "@/env";
import { actionErrorMessage } from "@/lib/auth/get-organization-context";
import { requireSchedulePublishAccess } from "@/lib/auth/schedule-access";
import { recordAuditEvent } from "@/lib/db/audit";
import { createScopedRepository } from "@/lib/db/scoped-repository";
import { prisma } from "@/lib/prisma";
import { buildInputChecksum } from "@/lib/scheduling/input-checksum";
import { loadCanvasDraftSnapshot } from "@/lib/scheduling/load-canvas-draft";

/** อายุลิงก์แชร์เริ่มต้นหลัง publish (วัน) */
const DEFAULT_SHARE_LINK_TTL_DAYS = 90;

/** ผลลัพธ์หลัง publish — token แสดงครั้งเดียว */
export type PublishScheduleResult = {
  readonly scheduleVersionId: string;
  readonly versionNumber: number;
  readonly shareUrl: string;
  readonly shareToken: string;
};

/** แปลง Date เป็น YYYY-MM-DD */
function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** สร้าง URL ลิงก์แชร์สาธารณะ */
function buildShareUrl(token: string): string {
  const base = env.NEXTAUTH_URL.replace(/\/$/, "");
  return `${base}/s/${token}`;
}

/** คำนวณวันหมดอายุลิงก์แชร์ */
function shareLinkExpiresAt(days: number): Date {
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + days);
  return expiresAt;
}

/** เผยแพร่ draft เป็น schedule version ใหม่ พร้อมลิงก์แชร์ */
export async function publishScheduleAction(
  input: PublishScheduleInput,
): Promise<ActionResult<PublishScheduleResult>> {
  try {
    const ctx = await requireSchedulePublishAccess();

    const parsed = publishScheduleSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }

    const data = parsed.data;
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

    const validation = validateSchedule(snapshot.engineInput);
    const overrideReason = data.override?.reason?.trim();
    const usingOverride = Boolean(overrideReason);

    if (validation.hardViolations.length > 0 && !usingOverride) {
      const first = validation.hardViolations[0];
      return {
        ok: false,
        error: first?.messageTh ?? "ตารางมี hard constraint ที่ละเมิด — แก้ก่อนเผยแพร่",
      };
    }

    const draftVersion = await prisma.scheduleVersion.findFirst({
      where: {
        id: snapshot.draftVersionId,
        organizationId: ctx.organizationId,
      },
      select: { ruleSetVersionId: true },
    });

    if (!draftVersion) {
      return { ok: false, error: "ไม่พบ draft version สำหรับ publish" };
    }

    const draftAssignments = await prisma.assignment.findMany({
      where: {
        organizationId: ctx.organizationId,
        scheduleVersionId: snapshot.draftVersionId,
        localDate: {
          gte: new Date(snapshot.periodStart),
          lte: new Date(snapshot.periodEnd),
        },
      },
      orderBy: [{ staffProfileId: "asc" }, { localDate: "asc" }],
    });

    const checksum = buildInputChecksum({
      cycleId: data.cycleId,
      draftId: data.draftId,
      draftVersionId: data.draftVersionId,
      assignments: draftAssignments.map((row) => ({
        staffProfileId: row.staffProfileId,
        localDate: formatDateInput(row.localDate),
        shiftCodeId: row.shiftCodeId,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        plannedOtHours: Number(row.plannedOtHours),
        isPinned: row.isPinned,
      })),
    });

    const shareToken = createShareToken();
    const tokenHash = hashShareToken(shareToken);
    const publishedAt = new Date();
    const publishReason =
      data.publishReason?.trim() ||
      (usingOverride ? `Override: ${overrideReason}` : "เผยแพร่จาก canvas");

    const result = await prisma.$transaction(async (tx) => {
      const previousPublished = await tx.scheduleVersion.findFirst({
        where: {
          organizationId: ctx.organizationId,
          scheduleCycleId: data.cycleId,
          status: { in: ["PUBLISHED", "LOCKED"] },
        },
        orderBy: { versionNumber: "desc" },
      });

      const latestInCycle = await tx.scheduleVersion.findFirst({
        where: {
          organizationId: ctx.organizationId,
          scheduleCycleId: data.cycleId,
        },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });

      const versionNumber = (latestInCycle?.versionNumber ?? 0) + 1;

      const publishedVersion = await tx.scheduleVersion.create({
        data: {
          organizationId: ctx.organizationId,
          scheduleCycleId: data.cycleId,
          scheduleDraftId: data.draftId,
          versionNumber,
          status: "PUBLISHED",
          ruleSetVersionId: draftVersion.ruleSetVersionId,
          publishedAt,
          publishedByUserId: ctx.userId,
          publishReason,
          checksum,
        },
      });

      if (draftAssignments.length > 0) {
        await tx.assignment.createMany({
          data: draftAssignments.map((row) => ({
            organizationId: ctx.organizationId,
            scheduleVersionId: publishedVersion.id,
            staffProfileId: row.staffProfileId,
            shiftCodeId: row.shiftCodeId,
            shiftInstanceId: row.shiftInstanceId,
            localDate: row.localDate,
            startsAt: row.startsAt,
            endsAt: row.endsAt,
            plannedOtHours: row.plannedOtHours,
            isPinned: row.isPinned,
            isManualOverride: row.isManualOverride,
            overrideReason: usingOverride ? overrideReason : row.overrideReason,
            overrideApprovedByUserId: usingOverride ? ctx.userId : row.overrideApprovedByUserId,
          })),
        });
      }

      if (
        previousPublished &&
        canTransitionScheduleVersion(previousPublished.status, "SUPERSEDED")
      ) {
        await tx.scheduleVersion.update({
          where: { id: previousPublished.id },
          data: {
            status: "SUPERSEDED",
            supersededAt: publishedAt,
            supersededByVersionId: publishedVersion.id,
          },
        });
      }

      await tx.scheduleShareLink.create({
        data: {
          organizationId: ctx.organizationId,
          scheduleVersionId: publishedVersion.id,
          tokenHash,
          expiresAt: shareLinkExpiresAt(DEFAULT_SHARE_LINK_TTL_DAYS),
          createdByUserId: ctx.userId,
        },
      });

      return {
        scheduleVersionId: publishedVersion.id,
        versionNumber: publishedVersion.versionNumber,
      };
    });

    const repo = createScopedRepository(ctx, prisma);
    await recordAuditEvent(repo, ctx, {
      action: "PUBLISH",
      entityType: "ScheduleVersion",
      entityId: result.scheduleVersionId,
      after: {
        cycleId: data.cycleId,
        versionNumber: result.versionNumber,
        checksum,
        override: usingOverride ? overrideReason : undefined,
      },
      reason: publishReason,
      correlationId: `publish:${data.cycleId}:${result.versionNumber}`,
    });

    return {
      ok: true,
      data: {
        scheduleVersionId: result.scheduleVersionId,
        versionNumber: result.versionNumber,
        shareUrl: buildShareUrl(shareToken),
        shareToken,
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}
