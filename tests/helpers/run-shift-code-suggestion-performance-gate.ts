import { performance } from "node:perf_hooks";

import { buildSuggestionBaseline, rankShiftCodeCandidates } from "@/domain/schedule/suggest";

import { buildShiftCodeSuggestionPerformanceFixture } from "./shift-code-suggestion-performance-fixture";

/** performance gate — จัดอันดับหนึ่งเซลล์ไม่เกิน ~150ms บนข้อมูล +25% */
const SCALE_FACTOR = 1.25;
const P95_LIMIT_MS = 150;
const MEASURED_RUNS = 7;

const fixture = buildShiftCodeSuggestionPerformanceFixture(SCALE_FACTOR);

/** รัน rank หนึ่งเซลล์ — วัดเวลา pure domain */
function runSuggestionRankMs(): number {
  const started = performance.now();
  const baseline = buildSuggestionBaseline(fixture.input, fixture.staffId, fixture.localDate);
  rankShiftCodeCandidates(fixture.input, {
    staffId: fixture.staffId,
    localDate: fixture.localDate,
    baseline,
    nonWorkingDayKinds: fixture.nonWorkingDayKinds,
    defaultOffKindId: fixture.defaultOffKindId,
  });
  return performance.now() - started;
}

/** คำนวณ percentile จากตัวอย่างที่เรียงแล้ว */
function percentile(sortedValues: readonly number[], p: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }
  const rank = Math.ceil((p / 100) * sortedValues.length) - 1;
  const index = Math.min(Math.max(rank, 0), sortedValues.length - 1);
  return sortedValues[index] ?? 0;
}

function main(): void {
  if (fixture.staffCount < 20 || fixture.shiftCodeCount < 10) {
    throw new Error("fixture ขนาดไม่พอสำหรับ shift-code suggestion performance gate");
  }

  runSuggestionRankMs();

  const durations = Array.from({ length: MEASURED_RUNS }, () => runSuggestionRankMs()).sort(
    (left, right) => left - right,
  );
  const p95 = percentile(durations, 95);

  if (p95 >= P95_LIMIT_MS) {
    throw new Error(
      `p95 shift-code suggestion rank ${Math.round(p95)}ms เกิน ${P95_LIMIT_MS}ms (staff=${fixture.staffCount} codes=${fixture.shiftCodeCount})`,
    );
  }

  console.info(
    `shift-code suggestion performance gate ok: staff=${fixture.staffCount} codes=${fixture.shiftCodeCount} p95=${Math.round(p95)}ms`,
  );
}

main();
