import { describe, expect, it } from "vitest";
import {
  ForbiddenError,
  hasPermission,
  PERMISSIONS,
  permissionsForRole,
  requirePermission,
  roleHasPermission,
} from "@/domain/rbac";
import {
  canTransitionScheduleVersion,
  isEditableScheduleVersion,
  isImmutableScheduleVersion,
} from "@/domain/schedule";
import type { OrganizationRole } from "@/generated/client/client";
import { tenantData, tenantWhere } from "@/lib/db/scoped-repository";

const TWO_ROLES = ["SYSTEM_ADMIN", "SCHEDULER"] as const satisfies readonly OrganizationRole[];

/** ทดสอบ RBAC permission matrix — สองบทบาทเท่านั้น */
describe("RBAC", () => {
  const ctx = {
    organizationId: "org-1",
    userId: "user-1",
    role: "SCHEDULER" as const,
  };

  it("มี permission ครบ 6 ค่าในระบบ", () => {
    expect(PERMISSIONS).toHaveLength(6);
  });

  it("matrix รองรับเฉพาะ SYSTEM_ADMIN และ SCHEDULER", () => {
    for (const role of TWO_ROLES) {
      expect(permissionsForRole(role).length).toBeGreaterThan(0);
    }
  });

  it("SCHEDULER มีสิทธิ schedule:draft:write, publish และ share", () => {
    expect(hasPermission(ctx, "schedule:draft:write")).toBe(true);
    expect(hasPermission(ctx, "schedule:publish")).toBe(true);
    expect(hasPermission(ctx, "schedule:share")).toBe(true);
  });

  it("SCHEDULER ไม่มีสิทธิ org:config:write", () => {
    expect(hasPermission(ctx, "org:config:write")).toBe(false);
  });

  it("SYSTEM_ADMIN มีสิทธิครบทุก permission", () => {
    const all = permissionsForRole("SYSTEM_ADMIN");
    expect(all).toEqual(PERMISSIONS);
    expect(roleHasPermission("SYSTEM_ADMIN", "org:config:write")).toBe(true);
  });

  it("requirePermission throw ForbiddenError เมื่อไม่มีสิทธิ์", () => {
    expect(() => requirePermission(ctx, "org:config:write")).toThrow(ForbiddenError);
  });
});

/** ทดสอบ schedule lifecycle transitions */
describe("schedule lifecycle", () => {
  it("อนุญาต DRAFT → VALIDATED → PUBLISHED และ PUBLISHED → SUPERSEDED", () => {
    expect(canTransitionScheduleVersion("DRAFT", "VALIDATED")).toBe(true);
    expect(canTransitionScheduleVersion("VALIDATED", "PUBLISHED")).toBe(true);
    expect(canTransitionScheduleVersion("PUBLISHED", "SUPERSEDED")).toBe(true);
  });

  it("ห้าม PUBLISHED → DRAFT", () => {
    expect(canTransitionScheduleVersion("PUBLISHED", "DRAFT")).toBe(false);
  });

  it("PUBLISHED, LOCKED และ SUPERSEDED เป็น immutable", () => {
    expect(isImmutableScheduleVersion("PUBLISHED")).toBe(true);
    expect(isImmutableScheduleVersion("LOCKED")).toBe(true);
    expect(isImmutableScheduleVersion("SUPERSEDED")).toBe(true);
    expect(isEditableScheduleVersion("DRAFT")).toBe(true);
  });
});

/** ทดสอบ tenant where/data helpers */
describe("tenant scoping helpers", () => {
  const ctx = {
    organizationId: "org-abc",
    userId: "user-1",
    role: "SCHEDULER" as const,
  };

  it("tenantWhere inject organizationId", () => {
    expect(tenantWhere(ctx, { active: true })).toEqual({
      active: true,
      organizationId: "org-abc",
    });
  });

  it("tenantData inject organizationId", () => {
    expect(tenantData(ctx, { code: "MI" })).toEqual({
      code: "MI",
      organizationId: "org-abc",
    });
  });
});
