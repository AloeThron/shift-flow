/**
 * สร้าง golden/fairness_metrics.json จาก validation dataset
 * รันหลัง export_validation_fixtures.py
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  aggregateStaffWorkloadMonthly,
  buildFairnessSnapshot,
  buildValidationScheduleInput,
} from "@/domain/optimize/fairness";
import { lookbackYearMonths } from "@/domain/rules/helpers/schedule-metrics";

const DATASET = join(process.cwd(), "demo/validation-dataset");
const OUT = join(DATASET, "golden/fairness_metrics.json");

const CYCLE_START = "2026-06-01";
const CYCLE_END = "2026-06-30";
const LOOKBACK_MONTHS = 6;

/** สร้าง golden fairness metrics */
function main(): void {
  const { input, allAssignments, shiftCodes } = buildValidationScheduleInput({
    cycleStartDate: CYCLE_START,
    cycleEndDate: CYCLE_END,
    includeHistoricalAssignments: true,
  });

  const lookbackMonths = lookbackYearMonths(CYCLE_START, LOOKBACK_MONTHS);
  const historicalAssignments = allAssignments.filter(
    (assignment) => assignment.scheduleDate < CYCLE_START,
  );

  const staffWorkloadMonthly = aggregateStaffWorkloadMonthly(
    {
      staff: input.staff,
      shiftCodes,
      assignments: historicalAssignments,
      holidayDates: input.holidayDates,
    },
    lookbackMonths,
  );

  const engineInput = {
    ...input,
    staffWorkloadMonthly,
  };

  const totalHoursSnapshot = buildFairnessSnapshot(engineInput, {
    dimension: "TOTAL_HOURS",
    scope: "GROUP",
    lookbackMonths: LOOKBACK_MONTHS,
    normalizeByFte: true,
  });

  const otHoursSnapshot = buildFairnessSnapshot(engineInput, {
    dimension: "OT_HOURS",
    scope: "GROUP",
    lookbackMonths: LOOKBACK_MONTHS,
    normalizeByFte: true,
  });

  const payload = {
    generated_at: new Date().toISOString(),
    source: "demo/validation-dataset + src/domain/optimize/fairness",
    cycle_start_date: CYCLE_START,
    cycle_end_date: CYCLE_END,
    lookback_months: LOOKBACK_MONTHS,
    workload_row_count: staffWorkloadMonthly.length,
    snapshots: {
      TOTAL_HOURS: totalHoursSnapshot,
      OT_HOURS: otHoursSnapshot,
    },
  };

  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    `fairness golden: ${staffWorkloadMonthly.length} workload rows, ` +
      `${Object.keys(totalHoursSnapshot.groups).length} groups → ${OUT}`,
  );
}

main();
