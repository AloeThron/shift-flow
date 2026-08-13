"use server";

import { revalidatePath } from "next/cache";

import {
  parseDateInput,
  type ShiftCodeDemandFormInput,
  type ShiftCodeDepartmentFormInput,
  type ShiftCodeFormInput,
  shiftCodeDemandFormSchema,
  shiftCodeDepartmentFormSchema,
  shiftCodeFormSchema,
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

const REVALIDATE_PATH = "/settings/shift-codes";

/** ตรวจว่า grade codes ที่เลือกอยู่ใน StaffGrade active ของ org */
async function validateAllowedGradeCodes(
  repo: ReturnType<typeof createScopedRepository>,
  allowedGradeCodes: readonly string[],
): Promise<string | null> {
  const activeGrades = await repo.staffGrade.findMany({
    where: { active: true },
    select: { code: true },
  });
  const activeCodes = new Set(activeGrades.map((grade) => grade.code));
  const invalid = allowedGradeCodes.filter((code) => !activeCodes.has(code));
  if (invalid.length > 0) {
    return `ระดับพนักงานไม่ถูกต้อง: ${invalid.join(", ")}`;
  }
  return null;
}

/** สร้าง shift code */
export async function createShiftCodeAction(
  input: ShiftCodeFormInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireOrganizationContext();
    requirePermission(ctx, "org:config:write");

    const parsed = shiftCodeFormSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }

    const repo = createScopedRepository(ctx, prisma);
    const data = parsed.data;

    const gradeError = await validateAllowedGradeCodes(repo, data.allowedGradeCodes);
    if (gradeError) {
      return { ok: false, error: gradeError };
    }

    const created = await repo.shiftCode.create({
      canonicalCode: data.canonicalCode,
      departmentId: data.departmentId || null,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      standardHours: data.standardHours ?? null,
      allowedGradeCodes: [...data.allowedGradeCodes],
      needsConfirmation: data.needsConfirmation,
      deprecated: data.deprecated,
    });

    await recordConfigChange(repo, ctx, {
      entityType: "ShiftCode",
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

/** อัปเดต shift code */
export async function updateShiftCodeAction(
  id: string,
  input: ShiftCodeFormInput,
): Promise<ActionResult> {
  try {
    const ctx = await requireOrganizationContext();
    requirePermission(ctx, "org:config:write");

    const parsed = shiftCodeFormSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }

    const repo = createScopedRepository(ctx, prisma);
    const existing = await repo.shiftCode.findFirst({ where: { id } });
    if (!existing) {
      return { ok: false, error: "ไม่พบรหัสเวร" };
    }

    const data = parsed.data;

    const gradeError = await validateAllowedGradeCodes(repo, data.allowedGradeCodes);
    if (gradeError) {
      return { ok: false, error: gradeError };
    }

    const updated = await repo.shiftCode.update({
      id,
      data: {
        canonicalCode: data.canonicalCode,
        departmentId: data.departmentId || null,
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        standardHours: data.standardHours ?? null,
        allowedGradeCodes: [...data.allowedGradeCodes],
        needsConfirmation: data.needsConfirmation,
        deprecated: data.deprecated,
      },
    });

    await recordConfigChange(repo, ctx, {
      entityType: "ShiftCode",
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

/** อัปเดตแผนกของรหัสเวร (popover ในแถว) */
export async function updateShiftCodeDepartmentAction(
  id: string,
  input: ShiftCodeDepartmentFormInput,
): Promise<ActionResult> {
  try {
    const ctx = await requireOrganizationContext();
    requirePermission(ctx, "org:config:write");

    const parsed = shiftCodeDepartmentFormSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }

    const repo = createScopedRepository(ctx, prisma);
    const existing = await repo.shiftCode.findFirst({ where: { id } });
    if (!existing) {
      return { ok: false, error: "ไม่พบรหัสเวร" };
    }

    const departmentId = parsed.data.departmentId || null;
    const updated = await repo.shiftCode.update({
      id,
      data: { departmentId },
    });

    await recordConfigChange(repo, ctx, {
      entityType: "ShiftCode",
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

/** สร้าง shift code demand */
export async function createShiftCodeDemandAction(
  input: ShiftCodeDemandFormInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireOrganizationContext();
    requirePermission(ctx, "org:config:write");

    const parsed = shiftCodeDemandFormSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }

    const repo = createScopedRepository(ctx, prisma);
    const data = parsed.data;

    const created = await repo.shiftCodeDemand.create({
      shiftCodeId: data.shiftCodeId,
      name: data.name,
      minHeadcount: data.minHeadcount,
      requiresLead: data.requiresLead,
      weekdayMask: data.weekdayMask,
      appliesOnHolidays: data.appliesOnHolidays,
      effectiveFrom: parseDateInput(data.effectiveFrom),
      effectiveTo: data.effectiveTo ? parseDateInput(data.effectiveTo) : null,
      active: data.active,
    });

    await recordConfigChange(repo, ctx, {
      entityType: "ShiftCodeDemand",
      entityId: created.id,
      after: created,
      effectiveFrom: parseDateInput(data.effectiveFrom),
    });

    revalidatePath(REVALIDATE_PATH);
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** อัปเดต shift code demand */
export async function updateShiftCodeDemandAction(
  id: string,
  input: ShiftCodeDemandFormInput,
): Promise<ActionResult> {
  try {
    const ctx = await requireOrganizationContext();
    requirePermission(ctx, "org:config:write");

    const parsed = shiftCodeDemandFormSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }

    const repo = createScopedRepository(ctx, prisma);
    const existing = await repo.shiftCodeDemand.findFirst({ where: { id } });
    if (!existing) {
      return { ok: false, error: "ไม่พบความต้องการกำลังคน" };
    }

    const data = parsed.data;
    const updated = await repo.shiftCodeDemand.update({
      id,
      data: {
        shiftCodeId: data.shiftCodeId,
        name: data.name,
        minHeadcount: data.minHeadcount,
        requiresLead: data.requiresLead,
        weekdayMask: data.weekdayMask,
        appliesOnHolidays: data.appliesOnHolidays,
        effectiveFrom: parseDateInput(data.effectiveFrom),
        effectiveTo: data.effectiveTo ? parseDateInput(data.effectiveTo) : null,
        active: data.active,
      },
    });

    await recordConfigChange(repo, ctx, {
      entityType: "ShiftCodeDemand",
      entityId: id,
      before: existing,
      after: updated,
      effectiveFrom: parseDateInput(data.effectiveFrom),
    });

    revalidatePath(REVALIDATE_PATH);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** ลบ shift code demand */
export async function deleteShiftCodeDemandAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireOrganizationContext();
    requirePermission(ctx, "org:config:write");

    const repo = createScopedRepository(ctx, prisma);
    const existing = await repo.shiftCodeDemand.findFirst({ where: { id } });
    if (!existing) {
      return { ok: false, error: "ไม่พบความต้องการกำลังคน" };
    }

    await repo.shiftCodeDemand.delete({ id });

    await recordConfigChange(repo, ctx, {
      entityType: "ShiftCodeDemand",
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

/** ดึง shift codes พร้อมแผนก */
export async function listShiftCodesAction() {
  const ctx = await requireOrganizationContext();
  requirePermission(ctx, "org:config:read");

  const rows = await prisma.shiftCode.findMany({
    where: { organizationId: ctx.organizationId },
    select: {
      id: true,
      canonicalCode: true,
      departmentId: true,
      startTime: true,
      endTime: true,
      standardHours: true,
      allowedGradeCodes: true,
      needsConfirmation: true,
      deprecated: true,
      department: { select: { code: true } },
      shiftCodeDemands: {
        where: { active: true },
        select: { minHeadcount: true },
      },
    },
    orderBy: [{ deprecated: "asc" }, { canonicalCode: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    canonicalCode: row.canonicalCode,
    departmentId: row.departmentId,
    startTime: row.startTime,
    endTime: row.endTime,
    standardHours: row.standardHours !== null ? Number(row.standardHours) : null,
    allowedGradeCodes: row.allowedGradeCodes,
    needsConfirmation: row.needsConfirmation,
    deprecated: row.deprecated,
    department: row.department,
    minHeadcountTotal: row.shiftCodeDemands.reduce((sum, demand) => sum + demand.minHeadcount, 0),
  }));
}

/** ดึง demands ของรหัสเวร */
export async function listShiftCodeDemandsAction(shiftCodeId: string) {
  const ctx = await requireOrganizationContext();
  requirePermission(ctx, "org:config:read");

  return prisma.shiftCodeDemand.findMany({
    where: { organizationId: ctx.organizationId, shiftCodeId },
    orderBy: [{ active: "desc" }, { effectiveFrom: "desc" }],
  });
}

/** ดึง staff grades สำหรับ hint */
export async function listStaffGradesAction() {
  const ctx = await requireOrganizationContext();
  requirePermission(ctx, "org:config:read");

  const repo = createScopedRepository(ctx, prisma);
  return repo.staffGrade.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: { code: true, displayName: true },
  });
}
