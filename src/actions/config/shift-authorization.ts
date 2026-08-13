"use server";

import { revalidatePath } from "next/cache";

import {
  parseDateInput,
  type StaffShiftAuthorizationFormInput,
  staffShiftAuthorizationFormSchema,
} from "@/domain/config/schemas";
import type { ActionResult } from "@/domain/config/types";
import { requirePermission } from "@/domain/rbac/check-permission";
import {
  actionErrorMessage,
  requireOrganizationContext,
} from "@/lib/auth/get-organization-context";
import { recordConfigChange } from "@/lib/db/audit";
import { createScopedRepository } from "@/lib/db/scoped-repository";
import { prisma } from "@/lib/prisma";

const STAFF_REVALIDATE_PATH = "/settings/staff";

type AuthorizationRow = {
  id: string;
  staffProfileId?: string;
  shiftCodeId: string | null;
  coversAllShiftCodes: boolean;
  level: string | null;
  assessedAt: Date;
  expiresAt: Date | null;
  authorizedByStaffId: string | null;
  requiresSupervision: boolean;
  shiftCode: { canonicalCode: string } | null;
  authorizedByStaff: { displayName: string } | null;
};

/** มุมมองสิทธิปฏิบัติงานต่อรหัสเวร */
export type StaffShiftAuthorizationView = {
  id: string;
  shiftCodeId: string | null;
  coversAllShiftCodes: boolean;
  shiftCode: string;
  level: string | null;
  assessedAt: Date;
  expiresAt: Date | null;
  authorizedByStaffId: string | null;
  authorizedByDisplayName: string | null;
  requiresSupervision: boolean;
};

/** แปลงวันหมดอายุจาก input — ไม่ส่ง = null (ไม่หมดอายุ) */
function resolveExpiresAt(
  assessedAt: Date,
  expiresAtInput?: string,
): { expiresAt: Date | null } | { error: string } {
  if (!expiresAtInput) {
    return { expiresAt: null };
  }

  const expiresAt = parseDateInput(expiresAtInput);
  if (expiresAt < assessedAt) {
    return { error: "วันหมดอายุต้องไม่ก่อนวันอนุมัติ" };
  }
  return { expiresAt };
}

/** map แถว DB → view */
function mapAuthorizationRow(row: AuthorizationRow): StaffShiftAuthorizationView {
  return {
    id: row.id,
    shiftCodeId: row.shiftCodeId,
    coversAllShiftCodes: row.coversAllShiftCodes,
    shiftCode: row.coversAllShiftCodes ? "ALL" : (row.shiftCode?.canonicalCode ?? ""),
    level: row.level,
    assessedAt: row.assessedAt,
    expiresAt: row.expiresAt,
    authorizedByStaffId: row.authorizedByStaffId,
    authorizedByDisplayName: row.authorizedByStaff?.displayName ?? null,
    requiresSupervision: row.requiresSupervision,
  };
}

/** ดึงสิทธิปฏิบัติงานทั้ง org (สำหรับหน้า staff) */
export async function listStaffShiftAuthorizationsByOrgAction(): Promise<
  (StaffShiftAuthorizationView & { staffProfileId: string })[]
> {
  const ctx = await requireOrganizationContext();
  requirePermission(ctx, "org:config:read");

  const rows = await prisma.staffShiftAuthorization.findMany({
    where: { organizationId: ctx.organizationId },
    include: {
      shiftCode: { select: { canonicalCode: true } },
      authorizedByStaff: { select: { displayName: true } },
    },
    orderBy: [{ staffProfileId: "asc" }, { coversAllShiftCodes: "desc" }, { expiresAt: "desc" }],
  });

  return rows.map((row) => ({
    staffProfileId: row.staffProfileId,
    ...mapAuthorizationRow(row),
  }));
}

/** ดึงสิทธิปฏิบัติงานของบุคลากร */
export async function listStaffShiftAuthorizationsAction(
  staffProfileId: string,
): Promise<StaffShiftAuthorizationView[]> {
  const ctx = await requireOrganizationContext();
  requirePermission(ctx, "org:config:read");

  const repo = createScopedRepository(ctx, prisma);
  const staff = await repo.staffProfile.findFirst({ where: { id: staffProfileId } });
  if (!staff) {
    return [];
  }

  const rows = await prisma.staffShiftAuthorization.findMany({
    where: { organizationId: ctx.organizationId, staffProfileId },
    include: {
      shiftCode: { select: { canonicalCode: true } },
      authorizedByStaff: { select: { displayName: true } },
    },
    orderBy: [{ coversAllShiftCodes: "desc" }, { expiresAt: "desc" }, { assessedAt: "desc" }],
  });

  return rows.map((row) => mapAuthorizationRow(row));
}

/** sync สิทธิปฏิบัติงานจาก checkbox (+ ทุกรหัสเวร) */
export async function syncStaffShiftAuthorizationsAction(
  staffProfileId: string,
  input: StaffShiftAuthorizationFormInput,
): Promise<ActionResult> {
  try {
    const ctx = await requireOrganizationContext();
    requirePermission(ctx, "org:config:write");

    const parsed = staffShiftAuthorizationFormSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }

    const repo = createScopedRepository(ctx, prisma);
    const staff = await repo.staffProfile.findFirst({ where: { id: staffProfileId } });
    if (!staff) {
      return { ok: false, error: "ไม่พบบุคลากร" };
    }

    const data = parsed.data;
    const assessedAt = parseDateInput(data.assessedAt);
    const expiresResult = resolveExpiresAt(assessedAt, data.expiresAt);
    if ("error" in expiresResult) {
      return { ok: false, error: expiresResult.error };
    }

    if (data.authorizedByStaffId) {
      const authorizer = await repo.staffProfile.findFirst({
        where: { id: data.authorizedByStaffId },
      });
      if (!authorizer) {
        return { ok: false, error: "ไม่พบผู้อนุมัติที่เลือก" };
      }
    }

    const activeShiftCodes = await repo.shiftCode.findMany({
      where: { deprecated: false },
      select: { id: true },
    });
    const shiftCodeById = new Map(activeShiftCodes.map((item) => [item.id, item]));
    const selectedIds = data.coversAll
      ? []
      : data.shiftCodeIds.filter((id) => shiftCodeById.has(id));

    if (!data.coversAll) {
      const invalidId = data.shiftCodeIds.find((id) => !shiftCodeById.has(id));
      if (invalidId) {
        return { ok: false, error: "มีรหัสเวรที่เลือกไม่ถูกต้องหรือถูกปิดใช้งาน" };
      }
    }

    const existing = await prisma.staffShiftAuthorization.findMany({
      where: { organizationId: ctx.organizationId, staffProfileId },
    });

    const sharedFields = {
      level: data.level || null,
      authorizedByStaffId: data.authorizedByStaffId || null,
      assessedAt,
      expiresAt: expiresResult.expiresAt,
    };

    await prisma.$transaction(async (tx) => {
      if (data.coversAll) {
        for (const row of existing) {
          await tx.staffShiftAuthorization.delete({ where: { id: row.id } });
        }

        await tx.staffShiftAuthorization.create({
          data: {
            organizationId: ctx.organizationId,
            staffProfileId,
            shiftCodeId: null,
            coversAllShiftCodes: true,
            ...sharedFields,
            requiresSupervision: false,
          },
        });
        return;
      }

      const coversAllRows = existing.filter((row) => row.coversAllShiftCodes);
      for (const row of coversAllRows) {
        await tx.staffShiftAuthorization.delete({ where: { id: row.id } });
      }

      const selectedSet = new Set(selectedIds);
      for (const row of existing) {
        if (row.coversAllShiftCodes || !row.shiftCodeId) {
          continue;
        }
        if (!selectedSet.has(row.shiftCodeId)) {
          await tx.staffShiftAuthorization.delete({ where: { id: row.id } });
        }
      }

      for (const shiftCodeId of selectedIds) {
        if (!shiftCodeById.has(shiftCodeId)) {
          continue;
        }

        const current = existing.find((row) => row.shiftCodeId === shiftCodeId);
        if (current) {
          await tx.staffShiftAuthorization.update({
            where: { id: current.id },
            data: sharedFields,
          });
          continue;
        }

        await tx.staffShiftAuthorization.create({
          data: {
            organizationId: ctx.organizationId,
            staffProfileId,
            shiftCodeId,
            coversAllShiftCodes: false,
            ...sharedFields,
            requiresSupervision: false,
          },
        });
      }
    });

    await recordConfigChange(repo, ctx, {
      entityType: "StaffShiftAuthorization",
      entityId: staffProfileId,
      after: { coversAll: data.coversAll, shiftCodeIds: selectedIds, ...sharedFields },
      effectiveFrom: assessedAt,
    });

    revalidatePath(STAFF_REVALIDATE_PATH);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** ลบสิทธิปฏิบัติงานทั้งหมดของบุคลากร */
export async function clearStaffShiftAuthorizationsAction(
  staffProfileId: string,
): Promise<ActionResult> {
  try {
    const ctx = await requireOrganizationContext();
    requirePermission(ctx, "org:config:write");

    const repo = createScopedRepository(ctx, prisma);
    const staff = await repo.staffProfile.findFirst({ where: { id: staffProfileId } });
    if (!staff) {
      return { ok: false, error: "ไม่พบบุคลากร" };
    }

    const existing = await prisma.staffShiftAuthorization.findMany({
      where: { organizationId: ctx.organizationId, staffProfileId },
    });

    if (existing.length === 0) {
      return { ok: true, data: undefined };
    }

    await prisma.staffShiftAuthorization.deleteMany({
      where: { organizationId: ctx.organizationId, staffProfileId },
    });

    await recordConfigChange(repo, ctx, {
      entityType: "StaffShiftAuthorization",
      entityId: staffProfileId,
      before: existing,
      effectiveFrom: new Date(),
    });

    revalidatePath(STAFF_REVALIDATE_PATH);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}
