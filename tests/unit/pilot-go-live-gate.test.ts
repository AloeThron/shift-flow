import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { evaluateGoLiveGate, parallelPilotReportSchema, shouldRollback } from "@/domain/pilot";

const SHADOW_DIR = join(process.cwd(), "demo/pilot-shadow/reports");

/** โหลดรายงาน JSON */
function loadReport(name: string) {
  const raw = JSON.parse(readFileSync(join(SHADOW_DIR, name), "utf8")) as unknown;
  return parallelPilotReportSchema.parse(raw);
}

describe("parallel pilot go-live gate", () => {
  it("รายงานจำลอง 2 รอบผ่านเกณฑ์ go-live ทั้งหมด", () => {
    const report = loadReport("simulated-passing-pilot.json");
    expect(report.cycles.length).toBeGreaterThanOrEqual(2);

    const decision = evaluateGoLiveGate(report);
    expect(decision.passed).toBe(true);
    expect(decision.recommendRollback).toBe(false);
    expect(shouldRollback(decision)).toBe(false);
    expect(decision.criteria.every((item) => item.passed)).toBe(true);
  });

  it("รายงานจำลองที่ล้ม blocking gate แนะนำ rollback", () => {
    const report = loadReport("simulated-failing-pilot.json");
    const decision = evaluateGoLiveGate(report);

    expect(decision.passed).toBe(false);
    expect(decision.recommendRollback).toBe(true);
    expect(shouldRollback(decision)).toBe(true);
    expect(decision.summaryTh).toContain("source of truth");

    const failedBlocking = decision.criteria.filter(
      (item) => !item.passed && item.blockingOnFailure,
    );
    expect(failedBlocking.length).toBeGreaterThan(0);
    expect(failedBlocking.map((item) => item.criterionId)).toContain("CYCLE-1.hard-safety");
  });

  it("ปฏิเสธรายงานที่มีรอบ shadow น้อยกว่า 2", () => {
    const report = loadReport("simulated-passing-pilot.json");
    const singleCycle = { ...report, cycles: [report.cycles[0]!] };

    expect(() => parallelPilotReportSchema.parse(singleCycle)).toThrow();
  });

  it("ทุกรอบ shadow ต้องเป็น mode shadow เท่านั้น", () => {
    const report = loadReport("simulated-passing-pilot.json");
    for (const cycle of report.cycles) {
      expect(cycle.mode).toBe("shadow");
    }
  });
});

describe("go-live gate fairness evaluation", () => {
  it("fairness ต้องไม่แย่กว่า baseline และดีขึ้นอย่างน้อย 1 metric", () => {
    const report = loadReport("simulated-passing-pilot.json");
    const decision = evaluateGoLiveGate(report);

    const fairnessCriteria = decision.criteria.filter((item) =>
      item.criterionId.endsWith(".fairness"),
    );
    expect(fairnessCriteria.length).toBe(2);
    expect(fairnessCriteria.every((item) => item.passed)).toBe(true);
  });
});

describe("go-live gate scheduling reduction", () => {
  it("CYCLE-1 ลดเวลาจัดตาราง ≥ 30% จาก baseline", () => {
    const report = loadReport("simulated-passing-pilot.json");
    const cycle1 = report.cycles.find((c) => c.cycleId === "CYCLE-1");
    expect(cycle1).toBeDefined();

    const reduction =
      ((cycle1!.baselineSchedulingHoursTotal - cycle1!.schedulingHoursTotal) /
        cycle1!.baselineSchedulingHoursTotal) *
      100;
    expect(reduction).toBeGreaterThanOrEqual(30);
  });
});
