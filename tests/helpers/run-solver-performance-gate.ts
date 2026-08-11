import { performance } from "node:perf_hooks";

import { planDayOff } from "@/domain/optimize/day-off";
import { runLagrangianBalance } from "@/domain/optimize/lagrangian/subgradient";

import { buildSolverPerformanceFixture, percentile } from "./solver-performance-fixture";

/** performance gate — draft pipeline p95 ไม่เกิน 2 นาทีบนข้อมูล +25% */
const SCALE_FACTOR = 1.25;
const P95_LIMIT_MS = 120_000;
const MEASURED_RUNS = 5;

const fixture = buildSolverPerformanceFixture(SCALE_FACTOR);

/** รัน Stage A + Stage B ต่อเนื่อง — วัดเวลา draft pipeline */
function runDraftPipelineMs(): number {
  const started = performance.now();
  planDayOff(fixture.dayOffInput);
  runLagrangianBalance(fixture.balanceInput);
  return performance.now() - started;
}

function main(): void {
  if (fixture.staffCount < 20 || fixture.slotCount < 20) {
    throw new Error("fixture ขนาดไม่พอสำหรับ performance gate");
  }

  runDraftPipelineMs();

  const durations = Array.from({ length: MEASURED_RUNS }, () => runDraftPipelineMs()).sort(
    (left, right) => left - right,
  );
  const p95 = percentile(durations, 95);

  if (p95 >= P95_LIMIT_MS) {
    throw new Error(`p95 draft pipeline ${Math.round(p95)}ms เกิน ${P95_LIMIT_MS}ms`);
  }

  console.info(
    `solver performance gate ok: staff=${fixture.staffCount} slots=${fixture.slotCount} p95=${Math.round(p95)}ms`,
  );
}

main();
