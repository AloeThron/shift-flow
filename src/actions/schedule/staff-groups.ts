"use server";

import type { ActionResult } from "@/domain/action-result";
import {
  reorderStaffGroupsSchema,
  type StaffGroupFormInput,
  staffGroupFormSchema,
  staffRowOrderSchema,
} from "@/domain/schedule/schemas";
import { actionErrorMessage } from "@/lib/auth/get-organization-context";
import {
  requireScheduleDraftWriteAccess,
  requireScheduleReadAccess,
} from "@/lib/auth/schedule-access";
import { recordAuditEvent } from "@/lib/db/audit";
import { createScopedRepository } from "@/lib/db/scoped-repository";
import { prisma } from "@/lib/prisma";
import { persistStaffRowOrders } from "@/lib/scheduling/persist-draft";

/** มุมมอง StaffGroup สำหรับ canvas */
export type StaffGroupView = {
  readonly id: string;
  readonly code: string;
  readonly displayName: string;
  readonly sortOrder: number;
  readonly active: boolean;
};

/** รายการกลุ่ม staff */
export async function listStaffGroupsAction(): Promise<ActionResult<StaffGroupView[]>> {
  try {
    const ctx = await requireScheduleReadAccess();

    const rows = await prisma.staffGroup.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });

    return {
      ok: true,
      data: rows.map((row) => ({
        id: row.id,
        code: row.code,
        displayName: row.displayName,
        sortOrder: row.sortOrder,
        active: row.active,
      })),
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** สร้างกลุ่ม staff ใหม่ */
export async function createStaffGroupAction(
  input: StaffGroupFormInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireScheduleDraftWriteAccess();

    const parsed = staffGroupFormSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }

    const data = parsed.data;
    const duplicate = await prisma.staffGroup.findFirst({
      where: {
        organizationId: ctx.organizationId,
        code: data.code,
      },
    });
    if (duplicate) {
      return { ok: false, error: `มีรหัสกลุ่ม "${data.code}" อยู่แล้ว` };
    }

    const created = await prisma.staffGroup.create({
      data: {
        organizationId: ctx.organizationId,
        code: data.code,
        displayName: data.displayName,
        sortOrder: data.sortOrder,
        active: data.active ?? true,
      },
    });

    const repo = createScopedRepository(ctx, prisma);
    await recordAuditEvent(repo, ctx, {
      action: "CREATE",
      entityType: "StaffGroup",
      entityId: created.id,
      after: created,
    });

    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** อัปเดตกลุ่ม staff */
export async function updateStaffGroupAction(
  groupId: string,
  input: StaffGroupFormInput,
): Promise<ActionResult<void>> {
  try {
    const ctx = await requireScheduleDraftWriteAccess();

    const parsed = staffGroupFormSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }

    const existing = await prisma.staffGroup.findFirst({
      where: {
        id: groupId,
        organizationId: ctx.organizationId,
      },
    });
    if (!existing) {
      return { ok: false, error: "ไม่พบกลุ่มที่ต้องการแก้ไข" };
    }

    const data = parsed.data;
    if (data.code !== existing.code) {
      const duplicate = await prisma.staffGroup.findFirst({
        where: {
          organizationId: ctx.organizationId,
          code: data.code,
          id: { not: groupId },
        },
      });
      if (duplicate) {
        return { ok: false, error: `มีรหัสกลุ่ม "${data.code}" อยู่แล้ว` };
      }
    }

    const updated = await prisma.staffGroup.update({
      where: { id: groupId },
      data: {
        code: data.code,
        displayName: data.displayName,
        sortOrder: data.sortOrder,
        active: data.active ?? existing.active,
      },
    });

    const repo = createScopedRepository(ctx, prisma);
    await recordAuditEvent(repo, ctx, {
      action: "UPDATE",
      entityType: "StaffGroup",
      entityId: groupId,
      before: existing,
      after: updated,
    });

    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** เปลี่ยนชื่อกลุ่มจาก canvas — alias ของ update ที่แก้เฉพาะ displayName */
export async function updateStaffGroupDisplayNameAction(input: {
  groupId: string;
  displayName: string;
}): Promise<ActionResult<void>> {
  try {
    const ctx = await requireScheduleDraftWriteAccess();

    const trimmed = input.displayName.trim();
    if (!trimmed) {
      return { ok: false, error: "ชื่อกลุ่มต้องไม่ว่าง" };
    }

    const existing = await prisma.staffGroup.findFirst({
      where: {
        id: input.groupId,
        organizationId: ctx.organizationId,
      },
    });
    if (!existing) {
      return { ok: false, error: "ไม่พบกลุ่มที่ต้องการแก้ไข" };
    }

    return updateStaffGroupAction(input.groupId, {
      code: existing.code,
      displayName: trimmed,
      sortOrder: existing.sortOrder,
      active: existing.active,
    });
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** ปิดใช้งานกลุ่ม (soft delete) */
export async function deactivateStaffGroupAction(groupId: string): Promise<ActionResult<void>> {
  try {
    const ctx = await requireScheduleDraftWriteAccess();

    const existing = await prisma.staffGroup.findFirst({
      where: {
        id: groupId,
        organizationId: ctx.organizationId,
      },
    });
    if (!existing) {
      return { ok: false, error: "ไม่พบกลุ่มที่ต้องการลบ" };
    }

    const memberCount = await prisma.staffProfile.count({
      where: {
        organizationId: ctx.organizationId,
        staffGroupId: groupId,
        active: true,
      },
    });
    if (memberCount > 0) {
      return {
        ok: false,
        error: "ยังมีพนักงานในกลุ่ม — ย้ายออกก่อนปิดใช้งานกลุ่ม",
      };
    }

    const updated = await prisma.staffGroup.update({
      where: { id: groupId },
      data: { active: false },
    });

    const repo = createScopedRepository(ctx, prisma);
    await recordAuditEvent(repo, ctx, {
      action: "DELETE",
      entityType: "StaffGroup",
      entityId: groupId,
      before: existing,
      after: updated,
      reason: "deactivate",
    });

    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** เรียงลำดับกลุ่มใหม่ */
export async function reorderStaffGroupsAction(input: {
  orderedGroupIds: readonly string[];
}): Promise<ActionResult<void>> {
  try {
    const ctx = await requireScheduleDraftWriteAccess();

    const parsed = reorderStaffGroupsSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }

    const groups = await prisma.staffGroup.findMany({
      where: {
        organizationId: ctx.organizationId,
        id: { in: [...parsed.data.orderedGroupIds] },
      },
    });

    if (groups.length !== parsed.data.orderedGroupIds.length) {
      return { ok: false, error: "มีกลุ่มที่ไม่พบในองค์กร" };
    }

    await prisma.$transaction(
      parsed.data.orderedGroupIds.map((groupId, index) =>
        prisma.staffGroup.updateMany({
          where: {
            id: groupId,
            organizationId: ctx.organizationId,
          },
          data: { sortOrder: index },
        }),
      ),
    );

    const repo = createScopedRepository(ctx, prisma);
    await recordAuditEvent(repo, ctx, {
      action: "UPDATE",
      entityType: "StaffGroup",
      entityId: ctx.organizationId,
      after: { orderedGroupIds: parsed.data.orderedGroupIds },
      reason: "reorder",
    });

    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** ย้าย staff ไปกลุ่มและจัดลำดับแถว */
export async function updateStaffRowOrderAction(input: {
  staffProfileId: string;
  staffGroupId: string | null;
  rowOrder: number;
}): Promise<ActionResult<void>> {
  try {
    const ctx = await requireScheduleDraftWriteAccess();

    const parsed = staffRowOrderSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }

    if (parsed.data.staffGroupId) {
      const group = await prisma.staffGroup.findFirst({
        where: {
          id: parsed.data.staffGroupId,
          organizationId: ctx.organizationId,
          active: true,
        },
      });
      if (!group) {
        return { ok: false, error: "ไม่พบกลุ่มปลายทาง" };
      }
    }

    const before = await prisma.staffProfile.findFirst({
      where: {
        id: parsed.data.staffProfileId,
        organizationId: ctx.organizationId,
      },
    });
    if (!before) {
      return { ok: false, error: "ไม่พบพนักงาน" };
    }

    await persistStaffRowOrders(prisma, ctx.organizationId, [parsed.data]);

    const after = await prisma.staffProfile.findFirstOrThrow({
      where: {
        id: parsed.data.staffProfileId,
        organizationId: ctx.organizationId,
      },
    });

    const repo = createScopedRepository(ctx, prisma);
    await recordAuditEvent(repo, ctx, {
      action: "UPDATE",
      entityType: "StaffProfile",
      entityId: parsed.data.staffProfileId,
      before,
      after,
      reason: "canvas-row-order",
    });

    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}
