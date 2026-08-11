"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/domain/config/types";
import { requirePermission } from "@/domain/rbac/check-permission";
import { loadStarterPack, loadStarterPackManifest } from "@/domain/starter-pack";
import {
  actionErrorMessage,
  requireOrganizationContext,
} from "@/lib/auth/get-organization-context";
import { prisma } from "@/lib/prisma";
import { applyStarterPack } from "@/lib/starter-pack/apply-pack";

const REVALIDATE_PATHS = ["/settings", "/schedule", "/schedule/workload"] as const;

/** รายการ starter pack สำหรับ onboarding */
export async function listStarterPacksAction(): Promise<
  ActionResult<
    {
      id: string;
      slug: string;
      displayNameTh: string;
      displayNameEn: string;
      complexity: string;
      disclaimer: string;
      requiresReview?: boolean;
    }[]
  >
> {
  try {
    await requireOrganizationContext();
    const manifest = loadStarterPackManifest();

    return {
      ok: true,
      data: manifest.packs.map((pack) => ({
        id: pack.id,
        slug: pack.slug,
        displayNameTh: pack.displayNameTh,
        displayNameEn: pack.displayNameEn,
        complexity: pack.complexity,
        disclaimer: pack.disclaimer,
        requiresReview: pack.requiresReview,
      })),
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** apply starter pack เข้าองค์กรปัจจุบัน */
export async function applyStarterPackAction(input: {
  packId: string;
  includeStaff?: boolean;
  includeHolidays?: boolean;
  includeDemoRoster?: boolean;
}): Promise<
  ActionResult<{
    packId: string;
    departments: number;
    shiftCodes: number;
    shiftCodeDemands: number;
    staffProfiles: number;
    ruleInstances: number;
    rosterAssignments: number;
  }>
> {
  try {
    const ctx = await requireOrganizationContext();
    requirePermission(ctx, "org:config:write");

    const snapshot = loadStarterPack(input.packId);
    const stats = await applyStarterPack(prisma, {
      organizationId: ctx.organizationId,
      snapshot,
      actorUserId: ctx.userId,
      includeStaff: input.includeStaff ?? true,
      includeHolidays: input.includeHolidays ?? true,
      includeDemoRoster: input.includeDemoRoster ?? true,
      replaceExisting: true,
    });

    for (const path of REVALIDATE_PATHS) {
      revalidatePath(path);
    }

    return {
      ok: true,
      data: {
        packId: snapshot.packId,
        departments: stats.departments,
        shiftCodes: stats.shiftCodes,
        shiftCodeDemands: stats.shiftCodeDemands,
        staffProfiles: stats.staffProfiles,
        ruleInstances: stats.ruleInstances,
        rosterAssignments: stats.rosterAssignments,
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}
