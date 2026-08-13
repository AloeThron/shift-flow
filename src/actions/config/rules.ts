"use server";

import { revalidatePath } from "next/cache";
import {
  parseDateInput,
  type RuleInstanceFormInput,
  ruleInstanceFormSchema,
} from "@/domain/config/schemas";
import type { ActionResult } from "@/domain/config/types";
import { requirePermission } from "@/domain/rbac/check-permission";
import { getRuleTemplate, validateRuleParams } from "@/domain/rules/registry";
import type { Prisma } from "@/generated/client/client";
import {
  actionErrorMessage,
  requireOrganizationContext,
} from "@/lib/auth/get-organization-context";
import { recordConfigChange } from "@/lib/db/audit";
import { createScopedRepository } from "@/lib/db/scoped-repository";
import { prisma } from "@/lib/prisma";

const REVALIDATE_PATH = "/settings/rules";

/** parse JSON params จากฟอร์ม */
function parseParamsJson(raw: string): { ok: true; data: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, data: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, error: "พารามิเตอร์ JSON ไม่ถูกต้อง" };
  }
}

/** สร้าง rule instance */
export async function createRuleInstanceAction(
  input: RuleInstanceFormInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireOrganizationContext();
    requirePermission(ctx, "org:config:write");

    const parsed = ruleInstanceFormSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }

    const template = getRuleTemplate(parsed.data.ruleTemplateId);
    if (!template) {
      return { ok: false, error: "ไม่พบ rule template" };
    }

    const paramsRaw = parseParamsJson(parsed.data.paramsJson);
    if (!paramsRaw.ok) {
      return { ok: false, error: paramsRaw.error };
    }

    const paramsValidated = validateRuleParams(parsed.data.ruleTemplateId, paramsRaw.data);
    if (!paramsValidated.ok) {
      return { ok: false, error: paramsValidated.error };
    }

    const severity = template.safetyLocked ? template.defaultSeverity : parsed.data.severity;
    const overrideClass = template.safetyLocked
      ? template.defaultOverrideClass
      : parsed.data.overrideClass;

    const repo = createScopedRepository(ctx, prisma);
    const created = await repo.ruleInstance.create({
      ruleTemplateId: parsed.data.ruleTemplateId,
      params: paramsValidated.data as Prisma.InputJsonValue,
      severity,
      weight: severity === "SOFT" ? (parsed.data.weight ?? 100) : null,
      overrideClass,
      enabled: parsed.data.enabled,
      effectiveFrom: parseDateInput(parsed.data.effectiveFrom),
      effectiveTo: parsed.data.effectiveTo ? parseDateInput(parsed.data.effectiveTo) : null,
    });

    await recordConfigChange(repo, ctx, {
      entityType: "RuleInstance",
      entityId: created.id,
      after: created,
      effectiveFrom: parseDateInput(parsed.data.effectiveFrom),
    });

    revalidatePath(REVALIDATE_PATH);
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** อัปเดต rule instance */
export async function updateRuleInstanceAction(
  id: string,
  input: RuleInstanceFormInput,
): Promise<ActionResult> {
  try {
    const ctx = await requireOrganizationContext();
    requirePermission(ctx, "org:config:write");

    const parsed = ruleInstanceFormSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }

    const template = getRuleTemplate(parsed.data.ruleTemplateId);
    if (!template) {
      return { ok: false, error: "ไม่พบ rule template" };
    }

    const paramsRaw = parseParamsJson(parsed.data.paramsJson);
    if (!paramsRaw.ok) {
      return { ok: false, error: paramsRaw.error };
    }

    const paramsValidated = validateRuleParams(parsed.data.ruleTemplateId, paramsRaw.data);
    if (!paramsValidated.ok) {
      return { ok: false, error: paramsValidated.error };
    }

    const repo = createScopedRepository(ctx, prisma);
    const existing = await repo.ruleInstance.findFirst({ where: { id } });
    if (!existing) {
      return { ok: false, error: "ไม่พบ rule instance" };
    }

    const severity = template.safetyLocked ? template.defaultSeverity : parsed.data.severity;
    const overrideClass = template.safetyLocked
      ? template.defaultOverrideClass
      : parsed.data.overrideClass;

    const updated = await repo.ruleInstance.update({
      id,
      data: {
        ruleTemplateId: parsed.data.ruleTemplateId,
        params: paramsValidated.data as Prisma.InputJsonValue,
        severity,
        weight: severity === "SOFT" ? (parsed.data.weight ?? 100) : null,
        overrideClass,
        enabled: parsed.data.enabled,
        effectiveFrom: parseDateInput(parsed.data.effectiveFrom),
        effectiveTo: parsed.data.effectiveTo ? parseDateInput(parsed.data.effectiveTo) : null,
        version: { increment: 1 },
      },
    });

    await recordConfigChange(repo, ctx, {
      entityType: "RuleInstance",
      entityId: id,
      before: existing,
      after: updated,
      effectiveFrom: parseDateInput(parsed.data.effectiveFrom),
    });

    revalidatePath(REVALIDATE_PATH);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** เปิด/ปิด rule instance อย่างรวดเร็ว */
export async function toggleRuleInstanceAction(
  id: string,
  enabled: boolean,
): Promise<ActionResult> {
  try {
    const ctx = await requireOrganizationContext();
    requirePermission(ctx, "org:config:write");

    const repo = createScopedRepository(ctx, prisma);
    const existing = await repo.ruleInstance.findFirst({ where: { id } });
    if (!existing) {
      return { ok: false, error: "ไม่พบ rule instance" };
    }

    const template = getRuleTemplate(existing.ruleTemplateId);
    if (template?.safetyLocked && !enabled) {
      return { ok: false, error: "กฎความปลอดภัยนี้ปิดไม่ได้" };
    }

    const updated = await repo.ruleInstance.update({
      id,
      data: { enabled, version: { increment: 1 } },
    });

    await recordConfigChange(repo, ctx, {
      entityType: "RuleInstance",
      entityId: id,
      before: existing,
      after: updated,
      effectiveFrom: new Date(),
    });

    revalidatePath(REVALIDATE_PATH);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** ดึง rule instances (แปลง Decimal เป็น number ก่อนข้าม RSC boundary) */
export async function listRuleInstancesAction() {
  const ctx = await requireOrganizationContext();
  requirePermission(ctx, "org:config:read");

  const repo = createScopedRepository(ctx, prisma);
  const rows = await repo.ruleInstance.findMany({
    orderBy: [{ enabled: "desc" }, { ruleTemplateId: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    ruleTemplateId: row.ruleTemplateId,
    params: row.params,
    severity: row.severity,
    weight: row.weight !== null ? Number(row.weight) : null,
    overrideClass: row.overrideClass,
    enabled: row.enabled,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}
