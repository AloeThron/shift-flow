import { describe, expect, it } from "vitest";

import {
  loadAllStarterPacks,
  loadStarterPack,
  loadStarterPackManifest,
  validateStarterPack,
} from "@/domain/starter-pack";

describe("starter pack manifest", () => {
  it("โหลด manifest ได้ pack เดียว", () => {
    const manifest = loadStarterPackManifest();
    expect(manifest.version).toBe(1);
    expect(manifest.packs).toHaveLength(1);
    expect(manifest.packs.map((pack) => pack.id)).toEqual(["pilot-lab-example"]);
  });

  it("resolve alias pilot-lab-sample", () => {
    const pilot = loadStarterPack("pilot-lab-sample");
    expect(pilot.packId).toBe("pilot-lab-example");
  });
});

describe("starter pack validation", () => {
  it("ทุก pack ใน manifest ผ่าน validation", () => {
    const snapshots = loadAllStarterPacks();

    for (const snapshot of snapshots) {
      const result = validateStarterPack(snapshot);
      expect(result.ok, snapshot.packId).toBe(true);
    }
  });

  it("pilot-lab-example มี edge cases ครบ", () => {
    const snapshot = loadStarterPack("pilot-lab-example");

    expect(snapshot.shiftCodes.some((row) => row.needsConfirmation)).toBe(true);
    expect(snapshot.ruleInstances.length).toBeGreaterThanOrEqual(5);
    expect(snapshot.organization.disclaimer).toContain("SYNTHETIC");
  });

  it("pilot-lab-example มี rule Stage A/B ครบชุด", () => {
    const snapshot = loadStarterPack("pilot-lab-example");
    const templateIds = new Set(snapshot.ruleInstances.map((row) => row.ruleTemplateId));

    expect(templateIds.has("DAY_OFF_QUOTA")).toBe(true);
    expect(templateIds.has("MAX_STAFF_OFF_PER_DAY")).toBe(true);
    expect(templateIds.has("FAIR_DISTRIBUTION")).toBe(true);
    expect(templateIds.has("OT_LIMIT")).toBe(true);

    const dayOff = snapshot.ruleInstances.find((row) => row.ruleTemplateId === "DAY_OFF_QUOTA");
    expect(dayOff?.enabled).toBe(true);
    expect(dayOff?.severity).toBe("HARD");
    expect(dayOff?.params).toMatchObject({ daysOffPerCycle: 8, scope: "GROUP" });

    const otLimit = snapshot.ruleInstances.find((row) => row.ruleTemplateId === "OT_LIMIT");
    expect(otLimit?.overrideClass).toBe("NEVER");
    expect(otLimit?.params).toMatchObject({ maxOtHoursPerStaffPerCycle: 20 });
  });

  it("pilot-lab-example มีตารางเวรเดือนตัวอย่างครบ 12×31", () => {
    const snapshot = loadStarterPack("pilot-lab-example");

    expect(snapshot.rosterMonthSample).toHaveLength(12 * 31);
    expect(snapshot.rosterMonthSample.every((row) => row.localDate.startsWith("2026-08-"))).toBe(
      true,
    );
  });

  it("pilot-lab-example มี staff_group_section ครบทุกคน", () => {
    const snapshot = loadStarterPack("pilot-lab-example");

    expect(snapshot.staff.every((row) => row.staffGroupSection)).toBe(true);
    expect(
      snapshot.staff.find((row) => row.staffCode === "STAFF-DEMO-PL-007")?.staffGroupSection,
    ).toBe("PART_TIME");
    expect(
      snapshot.staff.find((row) => row.staffCode === "STAFF-DEMO-PL-008")?.staffGroupSection,
    ).toBe("RESULT_NOT_CAPABLE");
  });

  it("pilot-lab-example มี scheduling policy ตามค่า default", () => {
    const snapshot = loadStarterPack("pilot-lab-example");

    expect(snapshot.schedulingPolicy.historyWindowMonths).toBe(6);
    expect(snapshot.schedulingPolicy.fairnessLookbackMonths).toBe(6);
    expect(snapshot.schedulingPolicy.planningHorizonMonths).toBe(1);
    expect(snapshot.schedulingPolicy.publishLeadDays).toBe(7);
    expect(snapshot.schedulingPolicy.otDerivationMode).toBe("PLANNED_OVERRIDE_ALLOWED");
  });
});
