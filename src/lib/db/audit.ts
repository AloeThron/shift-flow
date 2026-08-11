import type { OrganizationContext } from "@/domain/tenant/organization-context";
import type { AuditAction, Prisma } from "@/generated/client/client";
import type { ScopedRepository } from "@/lib/db/scoped-repository";

/** input สำหรับบันทึก audit event */
export type AuditEventInput = {
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  reason?: string;
  correlationId?: string;
  actorStaffProfileId?: string;
};

/** บันทึก audit append-only ผ่าน scoped repository */
export async function recordAuditEvent(
  repo: ScopedRepository,
  ctx: OrganizationContext,
  input: AuditEventInput,
): Promise<void> {
  await repo.auditEvent.create({
    actorUserId: ctx.userId,
    actorStaffProfileId: input.actorStaffProfileId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before,
    after: input.after,
    reason: input.reason,
    correlationId: input.correlationId,
  });
}

/** input สำหรับ config change event */
export type ConfigChangeInput = {
  entityType: string;
  entityId: string;
  field?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  reason?: string;
  effectiveFrom: Date;
};

/** บันทึกการเปลี่ยน config พร้อม audit */
export async function recordConfigChange(
  repo: ScopedRepository,
  ctx: OrganizationContext,
  input: ConfigChangeInput,
): Promise<void> {
  await repo.configChangeEvent.create({
    actorUserId: ctx.userId,
    entityType: input.entityType,
    entityId: input.entityId,
    field: input.field,
    before: input.before,
    after: input.after,
    reason: input.reason,
    effectiveFrom: input.effectiveFrom,
  });

  await recordAuditEvent(repo, ctx, {
    action: "UPDATE",
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before,
    after: input.after,
    reason: input.reason,
  });
}
