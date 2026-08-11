import type { OrganizationRole } from "@/generated/client/client";

/** รหัสผ่านร่วมของบัญชี demo — ใช้ใน seed และ dev login picker */
export const DEV_DEMO_PASSWORD = "demo-change-me";

/** บัญชี demo สำหรับ local development */
export type DevDemoAccount = {
  username: string;
  displayName: string;
  email: string;
  role: OrganizationRole;
};

/** รายชื่อบัญชี seed — sync กับ prisma/seed.ts */
export const DEV_DEMO_ACCOUNTS: readonly DevDemoAccount[] = [
  {
    username: "admin.demo",
    displayName: "ผู้ดูแลระบบ (สังเคราะห์)",
    email: "admin.demo@example.invalid",
    role: "SYSTEM_ADMIN",
  },
  {
    username: "scheduler.demo",
    displayName: "ผู้จัดเวร (สังเคราะห์)",
    email: "scheduler.demo@example.invalid",
    role: "SCHEDULER",
  },
] as const;

/** ป้าย role สำหรับแสดงในตาราง dev login */
export const DEV_DEMO_ROLE_LABELS: Readonly<Record<OrganizationRole, string>> = {
  SYSTEM_ADMIN: "ผู้ดูแลระบบ",
  SCHEDULER: "ผู้จัดเวร",
};
