import { hasPermission, requirePermission } from "@/domain/rbac/check-permission";
import type { OrganizationContext } from "@/domain/tenant/organization-context";
import { requireOrganizationContext } from "@/lib/auth/get-organization-context";
import { redirectAccessDenied } from "@/lib/auth/landing-path";
import { prisma } from "@/lib/prisma";

/** ตรวจสิทธิ์ schedule:read สำหรับหน้าจัดเวร */
export async function requireScheduleReadAccess(): Promise<OrganizationContext> {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "schedule:read")) {
    redirectAccessDenied(ctx, "schedule-forbidden");
  }
  return ctx;
}

/** ดึง timezone ขององค์กร */
export async function getOrganizationTimezone(ctx: OrganizationContext): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { id: ctx.organizationId },
    select: { timezone: true },
  });
  return org?.timezone ?? "Asia/Bangkok";
}

/** ตรวจว่าแก้ draft ตารางเวรได้ */
export function canWriteScheduleDraft(ctx: OrganizationContext): boolean {
  return hasPermission(ctx, "schedule:draft:write");
}

/** บังคับสิทธิ์ schedule:draft:write */
export async function requireScheduleDraftWriteAccess(): Promise<OrganizationContext> {
  const ctx = await requireScheduleReadAccess();
  if (!canWriteScheduleDraft(ctx)) {
    redirectAccessDenied(ctx, "schedule-forbidden");
  }
  return ctx;
}

/** ตรวจว่าเผยแพร่ตารางเวรได้ */
export function canPublishSchedule(ctx: OrganizationContext): boolean {
  return hasPermission(ctx, "schedule:publish");
}

/** บังคับสิทธิ์ schedule:publish */
export async function requireSchedulePublishAccess(): Promise<OrganizationContext> {
  const ctx = await requireScheduleReadAccess();
  requirePermission(ctx, "schedule:publish");
  return ctx;
}

/** ตรวจว่าสร้าง/จัดการลิงก์แชร์ได้ */
export function canShareSchedule(ctx: OrganizationContext): boolean {
  return hasPermission(ctx, "schedule:share");
}

/** บังคับสิทธิ์ schedule:share */
export async function requireScheduleShareAccess(): Promise<OrganizationContext> {
  const ctx = await requireScheduleReadAccess();
  requirePermission(ctx, "schedule:share");
  return ctx;
}
