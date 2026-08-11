import { hasPermission } from "@/domain/rbac/check-permission";
import { requireOrganizationContext } from "@/lib/auth/get-organization-context";
import { redirectAccessDenied } from "@/lib/auth/landing-path";

/** ตรวจสิทธิ์ org:config:read สำหรับหน้า settings */
export async function requireConfigReadAccess() {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "org:config:read")) {
    redirectAccessDenied(ctx, "config-forbidden");
  }
  return ctx;
}

/** คืนค่าว่า user มีสิทธิ์แก้ config หรือไม่ */
export async function getConfigWriteAccess() {
  const ctx = await requireConfigReadAccess();
  return {
    ctx,
    canWrite: hasPermission(ctx, "org:config:write"),
  };
}
