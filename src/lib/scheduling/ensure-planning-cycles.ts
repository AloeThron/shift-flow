import {
  computeRequiredPlanningCycles,
  missingPlanningCycles,
} from "@/domain/scheduling/cycle-planning";
import {
  buildDefaultSchedulingPolicySnapshot,
  resolveEffectiveSchedulingPolicy,
} from "@/domain/scheduling/policy";
import type { SchedulingPolicySnapshot } from "@/domain/scheduling/policy";
import type { PrismaClient } from "@/generated/client/client";

/** ผลการสร้างรอบล่วงหน้า */
export type EnsurePlanningCyclesResult = {
  readonly policy: SchedulingPolicySnapshot;
  readonly createdCycleIds: readonly string[];
  readonly createdDraftIds: readonly string[];
  readonly skippedExisting: number;
};

type EnsurePlanningDbClient = Pick<
  PrismaClient,
  "schedulingPolicy" | "scheduleCycle" | "scheduleDraft"
>;

/** แปลง Date เป็น YYYY-MM-DD */
function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** โหลด policy ที่มีผล */
async function loadEffectivePolicy(
  db: EnsurePlanningDbClient,
  organizationId: string,
  asOfDate: string,
): Promise<SchedulingPolicySnapshot> {
  const policies = await db.schedulingPolicy.findMany({
    where: { organizationId },
    orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }],
  });

  const mapped: SchedulingPolicySnapshot[] = policies.map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    historyWindowMonths: row.historyWindowMonths,
    fairnessLookbackMonths: row.fairnessLookbackMonths,
    planningHorizonMonths: row.planningHorizonMonths,
    publishLeadDays: row.publishLeadDays,
    otDerivationMode: row.otDerivationMode,
    effectiveFrom: formatDateInput(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? formatDateInput(row.effectiveTo) : null,
    version: row.version,
  }));

  return (
    resolveEffectiveSchedulingPolicy(mapped, asOfDate) ??
    buildDefaultSchedulingPolicySnapshot(organizationId, asOfDate)
  );
}

/** สร้าง ScheduleCycle + ScheduleDraft สำหรับรอบล่วงหน้าตาม planningHorizonMonths */
export async function ensurePlanningCycles(
  db: EnsurePlanningDbClient,
  options: {
    readonly organizationId: string;
    readonly asOfDate?: string;
  },
): Promise<EnsurePlanningCyclesResult> {
  const asOfDate = options.asOfDate ?? formatDateInput(new Date());
  const policy = await loadEffectivePolicy(db, options.organizationId, asOfDate);
  const required = computeRequiredPlanningCycles(asOfDate, policy.planningHorizonMonths);

  const existingCycles = await db.scheduleCycle.findMany({
    where: {
      organizationId: options.organizationId,
      OR: required.map((planned) => ({
        periodStart: new Date(planned.periodStart),
        periodEnd: new Date(planned.periodEnd),
      })),
    },
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
    },
  });

  const existingMapped = existingCycles.map((cycle) => ({
    periodStart: formatDateInput(cycle.periodStart),
    periodEnd: formatDateInput(cycle.periodEnd),
  }));

  const toCreate = missingPlanningCycles(required, existingMapped);
  const createdCycleIds: string[] = [];
  const createdDraftIds: string[] = [];

  for (const planned of toCreate) {
    const cycle = await db.scheduleCycle.create({
      data: {
        organizationId: options.organizationId,
        name: planned.name,
        periodStart: new Date(planned.periodStart),
        periodEnd: new Date(planned.periodEnd),
      },
    });

    const draftCount = await db.scheduleDraft.count({
      where: {
        organizationId: options.organizationId,
        scheduleCycleId: cycle.id,
      },
    });

    const draft = await db.scheduleDraft.create({
      data: {
        organizationId: options.organizationId,
        scheduleCycleId: cycle.id,
        draftNumber: draftCount + 1,
        status: "EDITING",
      },
    });

    createdCycleIds.push(cycle.id);
    createdDraftIds.push(draft.id);
  }

  return {
    policy,
    createdCycleIds,
    createdDraftIds,
    skippedExisting: required.length - toCreate.length,
  };
}
