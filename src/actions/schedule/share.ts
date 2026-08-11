"use server";

import type { ActionResult } from "@/domain/action-result";
import {
    createShareLinkSchema,
    revokeShareLinkSchema,
    type CreateShareLinkInput,
    type RevokeShareLinkInput,
} from "@/domain/schedule/schemas";
import { createShareToken, hashShareToken } from "@/domain/schedule/share/token";
import { env } from "@/env";
import { actionErrorMessage } from "@/lib/auth/get-organization-context";
import { requireScheduleShareAccess } from "@/lib/auth/schedule-access";
import { recordAuditEvent } from "@/lib/db/audit";
import { createScopedRepository } from "@/lib/db/scoped-repository";
import { prisma } from "@/lib/prisma";
import { loadShareLinksForCycle, type ShareLinkView } from "@/lib/scheduling/load-share-links";

/** ผลลัพธ์สร้างลิงก์ — token แสดงครั้งเดียว */
export type CreateShareLinkResult = {
  readonly linkId: string;
  readonly shareUrl: string;
  readonly shareToken: string;
};

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

/** สร้างลิงก์แชร์สำหรับ schedule version ที่ publish แล้ว */
export async function createShareLinkAction(
  input: CreateShareLinkInput,
): Promise<ActionResult<CreateShareLinkResult>> {
  try {
    const ctx = await requireScheduleShareAccess();

    const parsed = createShareLinkSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }

    const data = parsed.data;
    const version = await prisma.scheduleVersion.findFirst({
      where: {
        id: data.scheduleVersionId,
        organizationId: ctx.organizationId,
        status: { in: ["PUBLISHED", "LOCKED"] },
      },
    });

    if (!version) {
      return { ok: false, error: "ไม่พบ schedule version ที่เผยแพร่แล้ว" };
    }

    const shareToken = createShareToken();
    const tokenHash = hashShareToken(shareToken);
    const repo = createScopedRepository(ctx, prisma);

    const created = await repo.scheduleShareLink.create({
      scheduleVersionId: version.id,
      tokenHash,
      expiresAt: shareLinkExpiresAt(data.expiresInDays),
      createdByUserId: ctx.userId,
    });

    await recordAuditEvent(repo, ctx, {
      action: "CREATE",
      entityType: "ScheduleShareLink",
      entityId: created.id,
      after: {
        scheduleVersionId: version.id,
        expiresAt: created.expiresAt.toISOString(),
      },
      correlationId: `share-link:create:${created.id}`,
    });

    return {
      ok: true,
      data: {
        linkId: created.id,
        shareUrl: buildShareUrl(shareToken),
        shareToken,
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** เพิกถอนลิงก์แชร์ */
export async function revokeShareLinkAction(
  input: RevokeShareLinkInput,
): Promise<ActionResult<void>> {
  try {
    const ctx = await requireScheduleShareAccess();

    const parsed = revokeShareLinkSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }

    const repo = createScopedRepository(ctx, prisma);
    const existing = await repo.scheduleShareLink.findFirst({
      where: { id: parsed.data.linkId },
    });

    if (!existing) {
      return { ok: false, error: "ไม่พบลิงก์แชร์" };
    }

    if (existing.revokedAt) {
      return { ok: true, data: undefined };
    }

    const revokedAt = new Date();
    await repo.scheduleShareLink.update({
      id: existing.id,
      data: { revokedAt },
    });

    await recordAuditEvent(repo, ctx, {
      action: "UPDATE",
      entityType: "ScheduleShareLink",
      entityId: existing.id,
      before: { revokedAt: null },
      after: { revokedAt: revokedAt.toISOString() },
      correlationId: `share-link:revoke:${existing.id}`,
    });

    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** รายการลิงก์แชร์ของรอบตาราง */
export async function listShareLinksAction(
  cycleId: string,
): Promise<ActionResult<ShareLinkView[]>> {
  try {
    const ctx = await requireScheduleShareAccess();
    const data = await loadShareLinksForCycle(ctx.organizationId, cycleId);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}
