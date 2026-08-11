import { analyzeFeasibility } from "@/domain/schedule/feasibility";
import type { BalancePlanInput } from "@/domain/optimize/balance/types";
import { runLagrangianBalance } from "@/domain/optimize/lagrangian/subgradient";
import type { SolverInput, SolverResult } from "@/domain/schedule/types";
import { validateSchedule } from "@/domain/schedule/validate";

export const SOLVER_VERSION = "stage-b-min-cost-flow@1";

/** pipeline: feasibility → Stage B flow → Lagrangian → targeted search → validate */
export function solveSchedule(input: SolverInput): SolverResult {
  const feasibility = analyzeFeasibility(input, input.slots);

  const balanceInput: BalancePlanInput = {
    ...input,
    slots: input.slots,
  };

  const balanced = runLagrangianBalance(balanceInput);
  const validation = validateSchedule({ ...input, assignments: balanced.assignments });

  return {
    assignments: balanced.assignments,
    validation,
    feasibility,
    iterations: balanced.lagrangianIterations + balanced.localSearchIterations,
    solverVersion: SOLVER_VERSION,
  };
}

/** @deprecated ใช้ solveBalance แทน — คง export เพื่อ backward compatibility ใน test */
export { constructSchedule, rankStaffCandidates } from "./construct";

/** @deprecated ใช้ runLagrangianBalance แทน */
export { repairHardViolations } from "./repair";

/** @deprecated ใช้ targeted search ใน lagrangian แทน */
export { localSearchImprove } from "./search";

export { createDeterministicRng } from "./rng";
