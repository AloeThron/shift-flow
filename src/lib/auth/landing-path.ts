import { redirect } from "next/navigation";

import { hasPermission } from "@/domain/rbac/check-permission";
import type { OrganizationContext } from "@/domain/tenant/organization-context";

/** ข้อความเมื่อเข้าหน้าที่ไม่มีสิทธิ์ */
export const ACCESS_DENIED_MESSAGES: Readonly<Record<string, string>> = {
  "config-forbidden": "ไม่มีสิทธิ์เข้าถึงหน้าตั้งค่าอองค์กร",
  "schedule-forbidden": "ไม่มีสิทธิ์เข้าถึงหน้าจัดเวร",
};

/** หา path หลักที่ user เข้าได้ตามสิทธิ์ */
export function landingPathForContext(ctx: OrganizationContext): string {
  if (hasPermission(ctx, "schedule:read")) {
    return "/schedule";
  }

  if (hasPermission(ctx, "org:config:read")) {
    return "/settings";
  }

  return "/";
}

/** redirect ไปหน้าที่เข้าได้พร้อม error code */
export function redirectAccessDenied(ctx: OrganizationContext, error: string): never {
  redirect(`${landingPathForContext(ctx)}?error=${error}`);
}
