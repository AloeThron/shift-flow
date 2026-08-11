import { describe, expect, it } from "vitest";

import {
    isValidDayOffQuotaValue,
    mergeStaffDayOffQuotas,
    resolveDefaultDayOffQuota,
    serializeStaffDayOffQuotas,
    staffDayOffQuotasForSolver,
    validateStaffDayOffQuotasComplete,
} from "@/domain/schedule/day-off-quota-draft";
import type { RuleInstanceSnapshot } from "@/domain/schedule/types";

/** rule instance สำหรับทดสอบโควตา */
function dayOffQuotaRule(params: Record<string, unknown>): RuleInstanceSnapshot {
  return {
    id: "rule-day-off",
    ruleTemplateId: "DAY_OFF_QUOTA",
    params,
    severity: "HARD",
    weight: null,
    overrideClass: "APPROVER_REQUIRED",
    enabled: true,
  };
}

describe("resolveDefaultDayOffQuota", () => {
  it("อ่าน daysOffPerCycle จาก rule", () => {
    expect(
      resolveDefaultDayOffQuota("2026-03-01", "2026-03-31", [
        dayOffQuotaRule({ daysOffPerCycle: 8 }),
      ]),
    ).toBe(8);
  });

  it("คำนวณจาก daysOffPerWeek", () => {
    expect(
      resolveDefaultDayOffQuota("2026-03-01", "2026-03-07", [
        dayOffQuotaRule({ daysOffPerWeek: 2 }),
      ]),
    ).toBe(2);
  });

  it("คืน 0 เมื่อไม่มี rule", () => {
    expect(resolveDefaultDayOffQuota("2026-03-01", "2026-03-31", [])).toBe(0);
  });
});

describe("mergeStaffDayOffQuotas", () => {
  it("ใช้ค่าที่บันทึกแล้วและ default สำหรับคนที่ยังไม่มี row", () => {
    const merged = mergeStaffDayOffQuotas(
      ["staff-1", "staff-2"],
      [{ staffProfileId: "staff-1", daysOffQuota: 5 }],
      8,
    );

    expect(merged["staff-1"]).toBe(5);
    expect(merged["staff-2"]).toBe(8);
  });
});

describe("validateStaffDayOffQuotasComplete", () => {
  it("ผ่านเมื่อทุกคนมีค่า integer 0–31", () => {
    const quotas = new Map<string, number | null>([
      ["staff-1", 8],
      ["staff-2", 0],
    ]);

    expect(validateStaffDayOffQuotasComplete(["staff-1", "staff-2"], quotas)).toEqual({
      ok: true,
    });
  });

  it("ไม่ผ่านเมื่อมีช่องว่าง", () => {
    const quotas = new Map<string, number | null>([
      ["staff-1", 8],
      ["staff-2", null],
    ]);

    const result = validateStaffDayOffQuotasComplete(["staff-1", "staff-2"], quotas);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missingStaffIds).toEqual(["staff-2"]);
    }
  });

  it("ไม่ผ่านเมื่อค่าเกิน 31", () => {
    const quotas = new Map<string, number | null>([["staff-1", 32]]);
    expect(validateStaffDayOffQuotasComplete(["staff-1"], quotas).ok).toBe(false);
  });
});

describe("isValidDayOffQuotaValue", () => {
  it("ยอม 0 และ 31", () => {
    expect(isValidDayOffQuotaValue(0)).toBe(true);
    expect(isValidDayOffQuotaValue(31)).toBe(true);
    expect(isValidDayOffQuotaValue(0.5)).toBe(false);
    expect(isValidDayOffQuotaValue(null)).toBe(false);
  });
});

describe("staffDayOffQuotasForSolver", () => {
  it("กรองเฉพาะค่าที่ valid", () => {
    const solverMap = staffDayOffQuotasForSolver(
      new Map<string, number | null>([
        ["staff-1", 4],
        ["staff-2", null],
      ]),
    );

    expect(solverMap["staff-1"]).toBe(4);
    expect(solverMap["staff-2"]).toBeUndefined();
  });
});

describe("serializeStaffDayOffQuotas", () => {
  it("เรียง staffId แบบ determinism", () => {
    const serialized = serializeStaffDayOffQuotas({
      "staff-b": 2,
      "staff-a": 1,
    });

    expect(serialized).toEqual([
      { staffId: "staff-a", daysOffQuota: 1 },
      { staffId: "staff-b", daysOffQuota: 2 },
    ]);
  });
});
