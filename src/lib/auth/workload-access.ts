import { hasPermission } from "@/domain/rbac/check-permission";
import type { OrganizationContext } from "@/domain/tenant/organization-context";

/** ตรวจว่า export CSV workload ได้ */
export function canExportWorkloadStats(ctx: OrganizationContext): boolean {
  return (
    hasPermission(ctx, "schedule:draft:write") ||
    hasPermission(ctx, "schedule:publish") ||
    ctx.role === "SYSTEM_ADMIN"
  );
}
