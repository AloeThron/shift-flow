import { describe, expect, it } from "vitest";

import {
  computeRequiredPlanningCycles,
  missingPlanningCycles,
} from "@/domain/scheduling/cycle-planning";
import {
  buildDefaultSchedulingPolicySnapshot,
  DEFAULT_SCHEDULING_POLICY,
  resolveEffectiveSchedulingPolicy,
  validateSchedulingPolicyValues,
} from "@/domain/scheduling/policy";
import type { SchedulingPolicySnapshot } from "@/domain/scheduling/policy";
import {
  computeHistoryWindow,
  computePublishDeadline,
  fairnessLookbackYearMonths,
  firstDayOfMonth,
  lastDayOfMonth,
  planningCycleYearMonths,
  yearMonthsBeforeWindow,
} from "@/domain/scheduling/window";

describe("scheduling policy defaults", () => {
  it("ค่า default starter pack ตรงกับเอกสาร", () => {
    expect(DEFAULT_SCHEDULING_POLICY.historyWindowMonths).toBe(6);
    expect(DEFAULT_SCHEDULING_POLICY.fairnessLookbackMonths).toBe(6);
    expect(DEFAULT_SCHEDULING_POLICY.planningHorizonMonths).toBe(1);
  });

  it("validateSchedulingPolicyValues ปฏิเสธ lookback เกินหน้าต่าง", () => {
    const errors = validateSchedulingPolicyValues({
      historyWindowMonths: 6,
      fairnessLookbackMonths: 7,
      planningHorizonMonths: 1,
      publishLeadDays: 7,
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it("resolveEffectiveSchedulingPolicy เลือกเวอร์ชันล่าสุดที่มีผล", () => {
    const policies: SchedulingPolicySnapshot[] = [
      {
        id: "old",
        organizationId: "org-1",
        historyWindowMonths: 3,
        fairnessLookbackMonths: 3,
        planningHorizonMonths: 1,
        publishLeadDays: 5,
        otDerivationMode: "SHIFT_CODE_ONLY",
        effectiveFrom: "2026-01-01",
        effectiveTo: "2026-06-30",
        version: 1,
      },
      {
        id: "current",
        organizationId: "org-1",
        historyWindowMonths: 6,
        fairnessLookbackMonths: 6,
        planningHorizonMonths: 1,
        publishLeadDays: 7,
        otDerivationMode: "PLANNED_OVERRIDE_ALLOWED",
        effectiveFrom: "2026-07-01",
        effectiveTo: null,
        version: 2,
      },
    ];

    const resolved = resolveEffectiveSchedulingPolicy(policies, "2026-08-15");
    expect(resolved?.id).toBe("current");
  });

  it("buildDefaultSchedulingPolicySnapshot ใช้เมื่อ org ยังไม่มี policy", () => {
    const snapshot = buildDefaultSchedulingPolicySnapshot("org-1", "2026-08-01");
    expect(snapshot.organizationId).toBe("org-1");
    expect(snapshot.historyWindowMonths).toBe(6);
  });
});

describe("history window", () => {
  it("computeHistoryWindow ครอบ 6 เดือนปฏิทินจาก asOf", () => {
    const window = computeHistoryWindow("2026-08-15", 6);

    expect(window.windowStart).toBe("2026-03-01");
    expect(window.windowEnd).toBe("2026-08-31");
  });

  it("fairnessLookbackYearMonths รวม 6 เดือนย้อนหลัง", () => {
    const months = fairnessLookbackYearMonths("2026-08-15", 6);

    expect(months).toEqual(["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"]);
  });

  it("yearMonthsBeforeWindow กรองเฉพาะเดือนก่อนหน้าต่าง", () => {
    const archived = yearMonthsBeforeWindow("2026-03-01", [
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
    ]);

    expect(archived).toEqual(["2026-01", "2026-02"]);
  });

  it("firstDayOfMonth และ lastDayOfMonth รองรับเดือนกุมภ", () => {
    expect(firstDayOfMonth("2026-02")).toBe("2026-02-01");
    expect(lastDayOfMonth("2026-02")).toBe("2026-02-28");
  });

  it("computePublishDeadline ถอย publishLeadDays จาก periodStart", () => {
    expect(computePublishDeadline("2026-09-01", 7)).toBe("2026-08-25");
  });
});

describe("planning cycles", () => {
  it("planningCycleYearMonths เปิดเฉพาะรอบล่วงหน้า 1 เดือน", () => {
    expect(planningCycleYearMonths("2026-08-15", 1)).toEqual(["2026-09"]);
  });

  it("computeRequiredPlanningCycles สร้างช่วงรายเดือน", () => {
    const cycles = computeRequiredPlanningCycles("2026-08-15", 1);

    expect(cycles).toEqual([
      {
        yearMonth: "2026-09",
        name: "2026-09",
        periodStart: "2026-09-01",
        periodEnd: "2026-09-30",
      },
    ]);
  });

  it("missingPlanningCycles คืนเฉพาะรอบที่ยังไม่มี", () => {
    const required = computeRequiredPlanningCycles("2026-08-15", 2);
    const missing = missingPlanningCycles(required, [
      {
        periodStart: "2026-09-01",
        periodEnd: "2026-09-30",
      },
    ]);

    expect(missing).toEqual([
      {
        yearMonth: "2026-10",
        name: "2026-10",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-31",
      },
    ]);
  });
});
