import { redirect } from "next/navigation";

import { ForbiddenError } from "@/domain/rbac/check-permission";
import {
  createOrganizationContext,
  type OrganizationContext,
} from "@/domain/tenant/organization-context";
import type { OrganizationRole } from "@/generated/client/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** ข้อผิดพลาดเมื่อไม่มี session หรือ membership */
export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED" as const;

  constructor(message = "ต้องเข้าสู่ระบบก่อน") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** ดึง organization context จาก session + ตรวจ membership ใน DB */
export async function getOrganizationContext(): Promise<OrganizationContext | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.organizationId || !session.user.role) {
    return null;
  }

  const membership = await prisma.organizationMembership.findFirst({
    where: {
      userId: session.user.id,
      organizationId: session.user.organizationId,
      status: "ACTIVE",
    },
    select: { role: true },
  });

  if (!membership) {
    return null;
  }

  return createOrganizationContext({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    role: membership.role,
  });
}

/** บังคับ login และ membership — redirect ไป /login เมื่อไม่มี session */
export async function requireOrganizationContext(): Promise<OrganizationContext> {
  const ctx = await getOrganizationContext();
  if (!ctx) {
    redirect("/login");
  }
  return ctx;
}

/** แปลง role string จาก session เป็น enum (ใช้กับ UI เท่านั้น) */
export function parseOrganizationRole(role: string | null): OrganizationRole | null {
  const roles: OrganizationRole[] = ["SYSTEM_ADMIN", "SCHEDULER"];
  return roles.find((item) => item === role) ?? null;
}

/** คืน error message สำหรับ action result */
export function actionErrorMessage(error: unknown): string {
  if (error instanceof ForbiddenError) {
    return error.message;
  }
  if (error instanceof UnauthorizedError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
}
