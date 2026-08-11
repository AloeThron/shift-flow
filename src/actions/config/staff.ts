"use server";

import { revalidatePath } from "next/cache";

import { staffFormSchema, type StaffFormInput } from "@/domain/config/schemas";
import type { ActionResult } from "@/domain/config/types";
import { requirePermission } from "@/domain/rbac/check-permission";
import {
    actionErrorMessage,
    requireOrganizationContext,
} from "@/lib/auth/get-organization-context";
import { recordConfigChange } from "@/lib/db/audit";
import { createScopedRepository } from "@/lib/db/scoped-repository";
import { prisma } from "@/lib/prisma";

const REVALIDATE_PATH = "/settings/staff";

/** สรุปสิทธิรหัสเวรของบุคลากร */
export type StaffShiftAuthSummary = {
  validCount: number;
  expiringSoon: boolean;
  coversAll: boolean;
};

/** มุมมองบุคลากรสำหรับหน้า admin */
export type StaffProfileView = {
  id: string;
  staffCode: string;
  displayName: string;
  email: string | null;
  staffGradeId: string;
  staffGroupId: string | null;
  staffGroupSection: "RESULT_CAPABLE" | "RESULT_NOT_CAPABLE" | "PART_TIME";
  rowOrder: number;
  active: boolean;
  staffGrade: { id: string; code: string; displayName: string };
  staffGroup: { id: string; code: string; displayName: string } | null;
  employmentContracts: readonly {
    contractType: "FULL_TIME" | "PART_TIME" | "NO_GUARANTEED_HOURS";
    fte: number;
  }[];
  shiftAuthSummary: StaffShiftAuthSummary;
};

/** อัปเดตสัญญาจ้างปัจจุบัน */
async function upsertCurrentEmploymentContract(
  organizationId: string,
  staffProfileId: string,
  contractType: StaffFormInput["contractType"],
  fte: number,
): Promise<void> {
  const existing = await prisma.employmentContract.findFirst({
    where: {
      organizationId,
      staffProfileId,
      effectiveTo: null,
    },
    orderBy: { effectiveFrom: "desc" },
  });

  if (existing) {
    await prisma.employmentContract.update({
      where: { id: existing.id },
      data: { contractType, fte },
    });
    return;
  }

  await prisma.employmentContract.create({
    data: {
      organizationId,
      staffProfileId,
      contractType,
      fte,
      effectiveFrom: new Date(),
    },
  });
}

/** สรุปสิทธิรหัสเวรที่ยังมีผลต่อ staff */
function buildShiftAuthSummaryByStaff(
  authorizations: readonly {
    staffProfileId: string;
    expiresAt: Date | null;
    coversAllShiftCodes: boolean;
  }[],
  activeShiftCodeCount: number,
): Map<string, StaffShiftAuthSummary> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soonThreshold = new Date(today);
  soonThreshold.setDate(soonThreshold.getDate() + 30);

  const summaryByStaff = new Map<string, StaffShiftAuthSummary>();

  for (const auth of authorizations) {
    if (auth.coversAllShiftCodes) {
      if (auth.expiresAt) {
        const expiresAt = new Date(auth.expiresAt);
        expiresAt.setHours(0, 0, 0, 0);
        if (expiresAt < today) {
          continue;
        }

        const current = summaryByStaff.get(auth.staffProfileId) ?? {
          validCount: 0,
          expiringSoon: false,
          coversAll: false,
        };
        current.validCount = activeShiftCodeCount;
        current.coversAll = true;
        if (expiresAt <= soonThreshold) {
          current.expiringSoon = true;
        }
        summaryByStaff.set(auth.staffProfileId, current);
        continue;
      }

      const current = summaryByStaff.get(auth.staffProfileId) ?? {
        validCount: 0,
        expiringSoon: false,
        coversAll: false,
      };
      current.validCount = activeShiftCodeCount;
      current.coversAll = true;
      summaryByStaff.set(auth.staffProfileId, current);
      continue;
    }

    if (auth.expiresAt) {
      const expiresAt = new Date(auth.expiresAt);
      expiresAt.setHours(0, 0, 0, 0);
      if (expiresAt < today) {
        continue;
      }

      const current = summaryByStaff.get(auth.staffProfileId) ?? {
        validCount: 0,
        expiringSoon: false,
        coversAll: false,
      };
      current.validCount += 1;
      if (expiresAt <= soonThreshold) {
        current.expiringSoon = true;
      }
      summaryByStaff.set(auth.staffProfileId, current);
      continue;
    }

    const current = summaryByStaff.get(auth.staffProfileId) ?? {
      validCount: 0,
      expiringSoon: false,
      coversAll: false,
    };
    current.validCount += 1;
    summaryByStaff.set(auth.staffProfileId, current);
  }

  return summaryByStaff;
}

/** ดึงรายการบุคลากร */
export async function listStaffProfilesAction(): Promise<StaffProfileView[]> {
  const ctx = await requireOrganizationContext();
  requirePermission(ctx, "org:config:read");

  const [rows, authorizations, activeShiftCodeCount] = await Promise.all([
    prisma.staffProfile.findMany({
      where: { organizationId: ctx.organizationId },
      include: {
        staffGrade: { select: { id: true, code: true, displayName: true } },
        staffGroup: { select: { id: true, code: true, displayName: true } },
        employmentContracts: {
          where: { effectiveTo: null },
          orderBy: { effectiveFrom: "desc" },
          take: 1,
          select: { contractType: true, fte: true },
        },
      },
      orderBy: [
        { staffGroup: { sortOrder: "asc" } },
        { staffGroupSection: "asc" },
        { rowOrder: "asc" },
        { staffCode: "asc" },
      ],
    }),
    prisma.staffShiftAuthorization.findMany({
      where: { organizationId: ctx.organizationId },
      select: { staffProfileId: true, expiresAt: true, coversAllShiftCodes: true },
    }),
    prisma.shiftCode.count({ where: { organizationId: ctx.organizationId, deprecated: false } }),
  ]);

  const shiftAuthSummaryByStaff = buildShiftAuthSummaryByStaff(
    authorizations,
    activeShiftCodeCount,
  );

  return rows.map((row) => ({
    id: row.id,
    staffCode: row.staffCode,
    displayName: row.displayName,
    email: row.email,
    staffGradeId: row.staffGradeId,
    staffGroupId: row.staffGroupId,
    staffGroupSection: row.staffGroupSection,
    rowOrder: row.rowOrder,
    active: row.active,
    staffGrade: row.staffGrade,
    staffGroup: row.staffGroup,
    employmentContracts: row.employmentContracts.map((contract) => ({
      contractType: contract.contractType,
      fte: Number(contract.fte),
    })),
    shiftAuthSummary: shiftAuthSummaryByStaff.get(row.id) ?? {
      validCount: 0,
      expiringSoon: false,
      coversAll: false,
    },
  }));
}

/** ดึงรายการระดับพนักงาน */
export async function listStaffGradesForStaffAction() {
  const ctx = await requireOrganizationContext();
  requirePermission(ctx, "org:config:read");

  const repo = createScopedRepository(ctx, prisma);
  return repo.staffGrade.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: { id: true, code: true, displayName: true },
  });
}

/** ดึงรายการกลุ่มพนักงาน */
export async function listStaffGroupsForStaffAction() {
  const ctx = await requireOrganizationContext();
  requirePermission(ctx, "org:config:read");

  return prisma.staffGroup.findMany({
    where: { organizationId: ctx.organizationId, active: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: { id: true, code: true, displayName: true },
  });
}

/** สร้างบุคลากรใหม่ */
export async function createStaffProfileAction(
  input: StaffFormInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireOrganizationContext();
    requirePermission(ctx, "org:config:write");

    const parsed = staffFormSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }

    const repo = createScopedRepository(ctx, prisma);
    const data = parsed.data;

    const created = await repo.staffProfile.create({
      staffCode: data.staffCode,
      displayName: data.displayName,
      email: data.email || null,
      staffGradeId: data.staffGradeId,
      staffGroupId: data.staffGroupId,
      staffGroupSection: data.staffGroupSection,
      rowOrder: data.rowOrder,
      active: data.active,
    });

    await upsertCurrentEmploymentContract(
      ctx.organizationId,
      created.id,
      data.contractType,
      data.fte,
    );

    await recordConfigChange(repo, ctx, {
      entityType: "StaffProfile",
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

/** อัปเดตบุคลากร */
export async function updateStaffProfileAction(
  id: string,
  input: StaffFormInput,
): Promise<ActionResult> {
  try {
    const ctx = await requireOrganizationContext();
    requirePermission(ctx, "org:config:write");

    const parsed = staffFormSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }

    const repo = createScopedRepository(ctx, prisma);
    const existing = await repo.staffProfile.findFirst({ where: { id } });
    if (!existing) {
      return { ok: false, error: "ไม่พบบุคลากร" };
    }

    const data = parsed.data;
    const updated = await repo.staffProfile.update({
      id,
      data: {
        staffCode: data.staffCode,
        displayName: data.displayName,
        email: data.email || null,
        staffGradeId: data.staffGradeId,
        staffGroupId: data.staffGroupId,
        staffGroupSection: data.staffGroupSection,
        rowOrder: data.rowOrder,
        active: data.active,
      },
    });

    await upsertCurrentEmploymentContract(
      ctx.organizationId,
      id,
      data.contractType,
      data.fte,
    );

    await recordConfigChange(repo, ctx, {
      entityType: "StaffProfile",
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

/** ปิดใช้งานบุคลากร */
export async function deactivateStaffProfileAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireOrganizationContext();
    requirePermission(ctx, "org:config:write");

    const repo = createScopedRepository(ctx, prisma);
    const existing = await repo.staffProfile.findFirst({ where: { id } });
    if (!existing) {
      return { ok: false, error: "ไม่พบบุคลากร" };
    }

    const updated = await repo.staffProfile.update({
      id,
      data: { active: false },
    });

    await recordConfigChange(repo, ctx, {
      entityType: "StaffProfile",
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
