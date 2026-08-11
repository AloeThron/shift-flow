import type { OrganizationRole } from "@/generated/client/client";

/** บริบท tenant ที่ใช้กับ repository และ RBAC */
export type OrganizationContext = {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
};

/** สร้าง context หลังตรวจ membership จาก DB แล้ว */
export function createOrganizationContext(input: OrganizationContext): OrganizationContext {
  return {
    organizationId: input.organizationId,
    userId: input.userId,
    role: input.role,
  };
}
