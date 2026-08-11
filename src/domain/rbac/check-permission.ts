import type { Permission } from "@/domain/rbac/permissions";
import { roleHasPermission } from "@/domain/rbac/permissions";
import type { OrganizationContext } from "@/domain/tenant/organization-context";

/** ข้อผิดพลาดเมื่อไม่มีสิทธิ์ */
export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN" as const;

  constructor(message = "ไม่มีสิทธิ์ดำเนินการนี้") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** ตรวจสิทธิ์จาก organization context */
export function hasPermission(ctx: OrganizationContext, permission: Permission): boolean {
  return roleHasPermission(ctx.role, permission);
}

/** throw ForbiddenError เมื่อไม่มีสิทธิ์ */
export function requirePermission(ctx: OrganizationContext, permission: Permission): void {
  if (!hasPermission(ctx, permission)) {
    throw new ForbiddenError();
  }
}
