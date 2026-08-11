import type { OrganizationRole } from "@/generated/client/client";

/** สิทธิ์ที่ระบบรู้จัก — ตรงกับ docs/security/rbac.md */
export const PERMISSIONS = [
  "org:config:read",
  "org:config:write",
  "schedule:read",
  "schedule:draft:write",
  "schedule:publish",
  "schedule:share",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** matrix บทบาท → สิทธิ์ */
const ROLE_PERMISSIONS: Readonly<Record<OrganizationRole, readonly Permission[]>> = {
  SYSTEM_ADMIN: PERMISSIONS,
  SCHEDULER: [
    "org:config:read",
    "schedule:read",
    "schedule:draft:write",
    "schedule:publish",
    "schedule:share",
  ],
};

/** คืนรายการสิทธิ์ของบทบาท */
export function permissionsForRole(role: OrganizationRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

/** ตรวจว่าบทบาทมีสิทธิ์หรือไม่ */
export function roleHasPermission(role: OrganizationRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
