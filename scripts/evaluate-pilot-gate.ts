#!/usr/bin/env tsx
/**
 * ประเมิน go-live gate จากรายงาน parallel pilot (JSON)
 * ใช้: pnpm pilot:evaluate <path-to-report.json>
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { evaluateGoLiveGate, parallelPilotReportSchema } from "@/domain/pilot";

const reportPath = process.argv[2];

if (!reportPath) {
  console.error("Usage: pnpm pilot:evaluate <report.json>");
  process.exit(1);
}

const absolutePath = resolve(reportPath);
const raw = JSON.parse(readFileSync(absolutePath, "utf8")) as unknown;
const parsed = parallelPilotReportSchema.safeParse(raw);

if (!parsed.success) {
  console.error("Schema validation failed:");
  console.error(parsed.error.format());
  process.exit(1);
}

const decision = evaluateGoLiveGate(parsed.data);

console.log(`\n=== Go-live Gate: ${parsed.data.pilotId} ===\n`);
console.log(`รอบ shadow: ${parsed.data.cycles.length}`);
console.log(`สรุป: ${decision.summaryTh}\n`);

for (const item of decision.criteria) {
  const mark = item.passed ? "✓" : "✗";
  const block = item.blockingOnFailure ? " [blocking]" : "";
  console.log(`${mark} ${item.nameTh}${block}`);
  console.log(`    actual: ${item.actual} | threshold: ${item.threshold}`);
}

console.log(`\nผลรวม: ${decision.passed ? "PASS" : "FAIL"}`);
if (decision.recommendRollback) {
  console.log(
    "Rollback: ใช้ตารางเดิม (Excel/กระดาษ) เป็น source of truth — เริ่ม shadow cycle ใหม่หลังแก้ไข",
  );
}

process.exit(decision.passed ? 0 : 1);
