import { describe, expect, it } from "vitest";

import { loadStarterPack } from "@/domain/starter-pack/load-pack";
import { validateStarterPack } from "@/domain/starter-pack/validate-pack";

const WEEKDAY_DEMAND_CODES = ["MI20", "IM20", "BB20", "CH18", "HE18"] as const;
const MT_STAFF_CODES = [
  "STAFF-DEMO-PL-002",
  "STAFF-DEMO-PL-003",
  "STAFF-DEMO-PL-004",
  "STAFF-DEMO-PL-005",
  "STAFF-DEMO-PL-006",
  "STAFF-DEMO-PL-012",
] as const;

/** ตรวจ starter pack — MT staff มีสิทธิครบ demand weekday และไม่มี expiry สั้น */
describe("starter pack shift auth coverage", () => {
  it("validate ผ่านและ MT staff มีสิทธิครบ 5 รหัส weekday โดยไม่หมดอายุ", () => {
    const snapshot = loadStarterPack("pilot-lab-example");
    const validation = validateStarterPack(snapshot);

    expect(validation.ok).toBe(true);

    const staffByCode = new Map(snapshot.staff.map((row) => [row.staffCode, row]));
    const authByStaff = new Map<string, Set<string>>();

    for (const row of snapshot.staffShiftAuthorization) {
      if (!row.shiftCode) {
        authByStaff.set(row.staffCode, new Set(["ALL"]));
        continue;
      }
      const codes = authByStaff.get(row.staffCode) ?? new Set<string>();
      codes.add(row.shiftCode);
      authByStaff.set(row.staffCode, codes);
    }

    for (const staffCode of MT_STAFF_CODES) {
      const staff = staffByCode.get(staffCode);
      expect(staff?.gradeCode).toBe("MT");

      const codes = authByStaff.get(staffCode) ?? new Set<string>();
      for (const demandCode of WEEKDAY_DEMAND_CODES) {
        expect(codes.has(demandCode), `${staffCode} ขาดสิทธิ ${demandCode}`).toBe(true);
      }
    }

    const expiredRows = snapshot.staffShiftAuthorization.filter(
      (row) => row.expiryDate !== null && row.expiryDate <= "2026-06-01",
    );
    expect(expiredRows).toHaveLength(0);
  });

  it("N1-MI และ N1-IM ไม่ต้องยืนยันก่อนจัด demand", () => {
    const snapshot = loadStarterPack("pilot-lab-example");
    const n1Codes = snapshot.shiftCodes.filter((row) =>
      ["N1-MI", "N1-IM"].includes(row.canonicalCode),
    );

    expect(n1Codes).toHaveLength(2);
    expect(n1Codes.every((row) => row.needsConfirmation === false)).toBe(true);
  });
});
