"use server";

import { revalidatePath } from "next/cache";

import { type DepartmentFormInput, departmentFormSchema } from "@/domain/config/schemas";
import type { ActionResult } from "@/domain/config/types";
import { requirePermission } from "@/domain/rbac/check-permission";
import {
  actionErrorMessage,
  requireOrganizationContext,
} from "@/lib/auth/get-organization-context";
import { recordConfigChange } from "@/lib/db/audit";
import { createScopedRepository } from "@/lib/db/scoped-repository";
import { prisma } from "@/lib/prisma";

const REVALIDATE_PATH = "/settings/shift-codes";

/** สร้างแผนกใหม่ */
export async function createDepartmentAction(
  input: DepartmentFormInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireOrganizationContext();
    requirePermission(ctx, "org:config:write");

    const parsed = departmentFormSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }

    const repo = createScopedRepository(ctx, prisma);
    const data = parsed.data;

    const created = await repo.department.create({
      code: data.code,
      displayName: data.displayName,
      sortOrder: data.sortOrder,
      active: data.active,
    });

    await recordConfigChange(repo, ctx, {
      entityType: "Department",
      entityId: created.id,
      after: created,
      effectiveFrom: new Date(),
    });

    revalidatePath(REVALIDATE_PATH);
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** อัปเดตแผนก */
export async function updateDepartmentAction(
  id: string,
  input: DepartmentFormInput,
): Promise<ActionResult> {
  try {
    const ctx = await requireOrganizationContext();
    requirePermission(ctx, "org:config:write");

    const parsed = departmentFormSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }

    const repo = createScopedRepository(ctx, prisma);
    const existing = await repo.department.findFirst({ where: { id } });
    if (!existing) {
      return { ok: false, error: "ไม่พบแผนก" };
    }

    const data = parsed.data;
    const updated = await repo.department.update({
      id,
      data: {
        code: data.code,
        displayName: data.displayName,
        sortOrder: data.sortOrder,
        active: data.active,
      },
    });

    await recordConfigChange(repo, ctx, {
      entityType: "Department",
      entityId: id,
      before: existing,
      after: updated,
      effectiveFrom: new Date(),
    });

    revalidatePath(REVALIDATE_PATH);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** ลบแผนก — รหัสเวรที่ผูกจะได้ departmentId = null จาก onDelete SetNull */
export async function deleteDepartmentAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireOrganizationContext();
    requirePermission(ctx, "org:config:write");

    const repo = createScopedRepository(ctx, prisma);
    const existing = await repo.department.findFirst({ where: { id } });
    if (!existing) {
      return { ok: false, error: "ไม่พบแผนก" };
    }

    await repo.department.delete({ id });

    await recordConfigChange(repo, ctx, {
      entityType: "Department",
      entityId: id,
      before: existing,
      effectiveFrom: new Date(),
    });

    revalidatePath(REVALIDATE_PATH);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** ดึงรายการแผนกสำหรับหน้า admin */
export async function listDepartmentsAction() {
  const ctx = await requireOrganizationContext();
  requirePermission(ctx, "org:config:read");

  const repo = createScopedRepository(ctx, prisma);
  return repo.department.findMany({
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
}

/** ดึงแผนกสำหรับ select */
export async function listDepartmentsForSelectAction() {
  const ctx = await requireOrganizationContext();
  requirePermission(ctx, "org:config:read");

  const repo = createScopedRepository(ctx, prisma);
  return repo.department.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: { id: true, code: true, displayName: true },
  });
}
