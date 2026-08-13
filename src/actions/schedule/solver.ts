"use server";

import type { ActionResult } from "@/domain/action-result";
import { planDayOff } from "@/domain/optimize/day-off";
import { runLagrangianBalance } from "@/domain/optimize/lagrangian/subgradient";
import { analyzeFeasibility } from "@/domain/schedule/feasibility";
import { type RunScheduleSolverInput, runScheduleSolverSchema } from "@/domain/schedule/schemas";
import { validateSchedule } from "@/domain/schedule/validate";
import type { Prisma } from "@/generated/client/client";
import { actionErrorMessage } from "@/lib/auth/get-organization-context";
import { requireScheduleDraftWriteAccess } from "@/lib/auth/schedule-access";
import { recordAuditEvent } from "@/lib/db/audit";
import { createScopedRepository } from "@/lib/db/scoped-repository";
import { prisma } from "@/lib/prisma";
import { assertOptimisticVersion, bumpOptimisticVersion } from "@/lib/scheduling/draft-concurrency";
import { buildDeterministicSeed, buildInputChecksum } from "@/lib/scheduling/input-checksum";
import { loadCanvasDraftSnapshot } from "@/lib/scheduling/load-canvas-draft";
import { loadHistoryWindowSnapshot } from "@/lib/scheduling/load-history-window";
import {
  persistBalanceAssignments,
  persistDayOffPlan,
  toPersistShiftCodes,
} from "@/lib/scheduling/persist-draft";
import {
  balanceChecksumInput,
  buildBalancePlanInput,
  buildDayOffPlanInput,
  dayOffChecksumInput,
  loadRuleSetVersionId,
  nextScheduleRunAttempt,
} from "@/lib/scheduling/solver-input";

/** ผลลัพธ์ solver แต่ละระยะ */
export type ScheduleSolverRunResult = {
  readonly scheduleRunId: string;
  readonly optimisticVersion: number;
  readonly feasible: boolean;
  readonly solverVersion: string;
  readonly messageTh?: string;
  readonly resultSummary: Record<string, unknown>;
};

/** สร้าง ScheduleRun และอัปเดตสถานะ */
async function withScheduleRun<T>(args: {
  organizationId: string;
  scheduleDraftId: string;
  ruleSetVersionId: string;
  stage: "DAY_OFF" | "BALANCE";
  inputChecksum: string;
  solverVersion: string;
  correlationId: string;
  run: () => Promise<{
    feasible: boolean;
    messageTh?: string;
    resultSummary: Record<string, unknown>;
    data: T;
  }>;
}): Promise<{
  scheduleRunId: string;
  attemptNumber: number;
  randomSeed: string;
  result: Awaited<ReturnType<typeof args.run>>;
}> {
  const attemptNumber = await nextScheduleRunAttempt({
    organizationId: args.organizationId,
    scheduleDraftId: args.scheduleDraftId,
    stage: args.stage,
  });
  const randomSeed = buildDeterministicSeed(args.inputChecksum, attemptNumber);

  const run = await prisma.scheduleRun.create({
    data: {
      organizationId: args.organizationId,
      scheduleDraftId: args.scheduleDraftId,
      ruleSetVersionId: args.ruleSetVersionId,
      stage: args.stage,
      status: "RUNNING",
      inputChecksum: args.inputChecksum,
      solverVersion: args.solverVersion,
      randomSeed,
      attemptNumber,
      startedAt: new Date(),
    },
  });

  try {
    const outcome = await args.run();

    await prisma.scheduleRun.update({
      where: { id: run.id },
      data: {
        status: outcome.feasible ? "COMPLETED" : "FAILED",
        completedAt: new Date(),
        errorMessage: outcome.feasible ? null : (outcome.messageTh ?? "solver ไม่ feasible"),
        resultSummary: outcome.resultSummary as Prisma.InputJsonValue,
      },
    });

    return { scheduleRunId: run.id, attemptNumber, randomSeed, result: outcome };
  } catch (error) {
    await prisma.scheduleRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "solver ล้มเหลว",
      },
    });
    throw error;
  }
}

/** Stage A — ลงวันหยุดด้วย min-cost flow */
export async function runDayOffSolverAction(
  input: RunScheduleSolverInput,
): Promise<ActionResult<ScheduleSolverRunResult>> {
  try {
    const ctx = await requireScheduleDraftWriteAccess();

    const parsed = runScheduleSolverSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }

    const data = parsed.data;
    await assertOptimisticVersion(prisma, data.draftId, data.optimisticVersion, ctx.organizationId);

    const snapshot = await loadCanvasDraftSnapshot(prisma, {
      organizationId: ctx.organizationId,
      cycleId: data.cycleId,
    });
    if (!snapshot || snapshot.draftId !== data.draftId) {
      return { ok: false, error: "ไม่พบ draft ที่ตรงกับรอบ" };
    }

    const history = await loadHistoryWindowSnapshot(prisma, {
      organizationId: ctx.organizationId,
      asOfDate: snapshot.periodStart,
    });

    const checksum = buildInputChecksum(dayOffChecksumInput(snapshot, history));
    const ruleSetVersionId = await loadRuleSetVersionId(ctx.organizationId, data.draftVersionId);

    const {
      scheduleRunId,
      attemptNumber,
      result: solverOutcome,
    } = await withScheduleRun({
      organizationId: ctx.organizationId,
      scheduleDraftId: data.draftId,
      ruleSetVersionId,
      stage: "DAY_OFF",
      inputChecksum: checksum,
      solverVersion: "stage-a-sequential-spacing@1",
      correlationId: `day-off:${data.draftId}`,
      run: async () => {
        const planInput = buildDayOffPlanInput(snapshot, history);
        const solved = planDayOff(planInput);

        if (!solved.feasible) {
          return {
            feasible: false,
            messageTh: solved.messageTh ?? "Stage A ไม่ feasible",
            resultSummary: {
              plannedDaysOff: 0,
              totalCost: solved.totalCost,
            },
            data: solved,
          };
        }

        const persistStats = await persistDayOffPlan(prisma, {
          organizationId: ctx.organizationId,
          scheduleDraftId: data.draftId,
          periodStart: planInput.cycleStartDate,
          periodEnd: planInput.cycleEndDate,
          plannedDays: solved.plannedNonWorkingDays,
        });

        return {
          feasible: true,
          resultSummary: {
            plannedDaysOff: solved.plannedNonWorkingDays.length,
            removed: persistStats.removed,
            upserted: persistStats.upserted,
            totalCost: solved.totalCost,
          },
          data: solved,
        };
      },
    });

    if (!solverOutcome.feasible) {
      return {
        ok: false,
        error: solverOutcome.messageTh ?? "Stage A ไม่ feasible",
      };
    }

    const optimisticVersion = await bumpOptimisticVersion(prisma, data.draftId, ctx.organizationId);

    const repo = createScopedRepository(ctx, prisma);
    await recordAuditEvent(repo, ctx, {
      action: "UPDATE",
      entityType: "ScheduleDraft",
      entityId: data.draftId,
      after: {
        stage: "DAY_OFF",
        scheduleRunId,
        attemptNumber,
        resultSummary: solverOutcome.resultSummary,
      } as Prisma.InputJsonValue,
      correlationId: `day-off:${data.draftId}:${attemptNumber}`,
    });

    return {
      ok: true,
      data: {
        scheduleRunId,
        optimisticVersion,
        feasible: true,
        solverVersion: solverOutcome.data.solverVersion,
        resultSummary: solverOutcome.resultSummary,
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** Stage B — เกลี่ยงานด้วย min-cost flow + Lagrangian repair */
export async function runBalanceSolverAction(
  input: RunScheduleSolverInput,
): Promise<ActionResult<ScheduleSolverRunResult>> {
  try {
    const ctx = await requireScheduleDraftWriteAccess();

    const parsed = runScheduleSolverSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }

    const data = parsed.data;
    await assertOptimisticVersion(prisma, data.draftId, data.optimisticVersion, ctx.organizationId);

    const snapshot = await loadCanvasDraftSnapshot(prisma, {
      organizationId: ctx.organizationId,
      cycleId: data.cycleId,
    });
    if (!snapshot || snapshot.draftId !== data.draftId) {
      return { ok: false, error: "ไม่พบ draft ที่ตรงกับรอบ" };
    }

    const checksum = buildInputChecksum(balanceChecksumInput(snapshot));
    const ruleSetVersionId = await loadRuleSetVersionId(ctx.organizationId, data.draftVersionId);

    const {
      scheduleRunId,
      attemptNumber,
      result: solverOutcome,
    } = await withScheduleRun({
      organizationId: ctx.organizationId,
      scheduleDraftId: data.draftId,
      ruleSetVersionId,
      stage: "BALANCE",
      inputChecksum: checksum,
      solverVersion: "stage-b-min-cost-flow@1",
      correlationId: `balance:${data.draftId}`,
      run: async () => {
        const planInput = buildBalancePlanInput(snapshot);
        const feasibility = analyzeFeasibility(planInput, planInput.slots);
        const blockingIssues = feasibility.issues
          .filter(
            (issue) =>
              issue.kind === "INSUFFICIENT_STAFF" ||
              issue.kind === "MISSING_SHIFT_AUTH" ||
              issue.kind === "UNCONFIRMED_CODE",
          )
          .map((issue) => ({
            kind: issue.kind,
            messageTh: issue.messageTh,
            scheduleDate: issue.scheduleDate,
            shiftCodeId: issue.shiftCodeId,
          }));

        if (planInput.slots.length === 0 && planInput.fillEveryAvailableCell === false) {
          return {
            feasible: false,
            messageTh: "ไม่มี demand และปิดโหมดเติมเวร — ไม่สามารถเกลี่ยงานได้",
            resultSummary: {
              unfilledMandatorySlots: 0,
              filledCells: 0,
              skippedCells: 0,
              blockingIssues,
            },
            data: {
              feasible: false,
              assignments: planInput.assignments,
              unfilledMandatorySlotIds: [] as readonly string[],
              filledCellCount: 0,
              skippedFillSlotCount: 0,
              totalCost: 0,
              solverVersion: "stage-b-min-cost-flow@1",
              lagrangianIterations: 0,
              localSearchIterations: 0,
            },
          };
        }

        const solved = runLagrangianBalance(planInput);
        const validation = validateSchedule({
          ...planInput,
          assignments: solved.assignments,
        });

        const baseSummary = {
          filledCells: solved.filledCellCount,
          skippedCells: solved.skippedFillSlotCount,
          unfilledMandatorySlots: solved.unfilledMandatorySlotIds.length,
          blockingIssues,
        };

        if (!solved.feasible) {
          const messageTh = blockingIssues.some((issue) => issue.kind === "MISSING_SHIFT_AUTH")
            ? (solved.messageTh ?? "Stage B ไม่ feasible — สิทธิรหัสเวรหมดอายุหรือไม่มีคนผ่าน")
            : blockingIssues.some((issue) => issue.kind === "UNCONFIRMED_CODE")
              ? (solved.messageTh ?? "Stage B ไม่ feasible — มีรหัสเวรที่ยังไม่ยืนยัน")
              : (solved.messageTh ?? "Stage B ไม่ feasible");

          if (solved.filledCellCount > 0) {
            const persistStats = await persistBalanceAssignments(prisma, {
              organizationId: ctx.organizationId,
              scheduleVersionId: data.draftVersionId,
              periodStart: planInput.cycleStartDate,
              periodEnd: planInput.cycleEndDate,
              timezone: snapshot.timezone,
              shiftCodes: toPersistShiftCodes(snapshot.engineInput.shiftCodes),
              solverAssignments: solved.assignments,
            });

            return {
              feasible: false,
              messageTh,
              resultSummary: {
                ...baseSummary,
                hardViolations: validation.hardViolations.length,
                partialPersist: true,
                created: persistStats.created,
                removed: persistStats.removed,
              },
              data: solved,
            };
          }

          return {
            feasible: false,
            messageTh,
            resultSummary: {
              ...baseSummary,
              hardViolations: validation.hardViolations.length,
            },
            data: solved,
          };
        }

        const persistStats = await persistBalanceAssignments(prisma, {
          organizationId: ctx.organizationId,
          scheduleVersionId: data.draftVersionId,
          periodStart: planInput.cycleStartDate,
          periodEnd: planInput.cycleEndDate,
          timezone: snapshot.timezone,
          shiftCodes: toPersistShiftCodes(snapshot.engineInput.shiftCodes),
          solverAssignments: solved.assignments,
        });

        return {
          feasible: validation.isValid,
          messageTh: validation.isValid
            ? undefined
            : `Stage B มี hard violation ${validation.hardViolations.length} รายการ`,
          resultSummary: {
            assignmentCount: solved.assignments.length,
            created: persistStats.created,
            removed: persistStats.removed,
            ...baseSummary,
            hardViolations: validation.hardViolations.length,
            softViolations: validation.softViolations.length,
            lagrangianIterations: solved.lagrangianIterations,
            localSearchIterations: solved.localSearchIterations,
            totalCost: solved.totalCost,
          },
          data: solved,
        };
      },
    });

    if (!solverOutcome.feasible) {
      const partialPersist = solverOutcome.resultSummary.partialPersist === true;
      if (partialPersist) {
        const optimisticVersion = await bumpOptimisticVersion(
          prisma,
          data.draftId,
          ctx.organizationId,
        );

        const repo = createScopedRepository(ctx, prisma);
        await recordAuditEvent(repo, ctx, {
          action: "UPDATE",
          entityType: "ScheduleDraft",
          entityId: data.draftId,
          after: {
            stage: "BALANCE",
            scheduleRunId,
            attemptNumber,
            partialPersist: true,
            resultSummary: solverOutcome.resultSummary,
          } as Prisma.InputJsonValue,
          correlationId: `balance:${data.draftId}:${attemptNumber}`,
        });

        return {
          ok: true,
          data: {
            scheduleRunId,
            optimisticVersion,
            feasible: false,
            solverVersion: solverOutcome.data.solverVersion,
            messageTh: solverOutcome.messageTh,
            resultSummary: solverOutcome.resultSummary,
          },
        };
      }

      return {
        ok: false,
        error: solverOutcome.messageTh ?? "Stage B ไม่ feasible",
      };
    }

    const optimisticVersion = await bumpOptimisticVersion(prisma, data.draftId, ctx.organizationId);

    const repo = createScopedRepository(ctx, prisma);
    await recordAuditEvent(repo, ctx, {
      action: "UPDATE",
      entityType: "ScheduleDraft",
      entityId: data.draftId,
      after: {
        stage: "BALANCE",
        scheduleRunId,
        attemptNumber,
        resultSummary: solverOutcome.resultSummary,
      } as Prisma.InputJsonValue,
      correlationId: `balance:${data.draftId}:${attemptNumber}`,
    });

    return {
      ok: true,
      data: {
        scheduleRunId,
        optimisticVersion,
        feasible: true,
        solverVersion: solverOutcome.data.solverVersion,
        resultSummary: solverOutcome.resultSummary,
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}
