import * as fc from "fast-check";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createShareToken, hashShareToken, isShareLinkActive } from "@/domain/schedule/share/token";

/** ทดสอบ token/hash ลิงก์แชร์ */
describe("schedule share token", () => {
  it("hash ไม่ย้อนกลับเป็น token ต้นฉบับ", () => {
    const token = createShareToken();
    const hash = hashShareToken(token);

    expect(hash).not.toBe(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(createHash("sha256").update(token).digest("hex")).toBe(hash);
  });

  it("ลิงก์หมดอายุหรือถูกเพิกถอนไม่ active", () => {
    const now = new Date("2026-08-11T12:00:00.000Z");

    expect(
      isShareLinkActive({ revokedAt: null, expiresAt: new Date("2026-08-12T00:00:00.000Z") }, now),
    ).toBe(true);

    expect(
      isShareLinkActive({ revokedAt: null, expiresAt: new Date("2026-08-11T00:00:00.000Z") }, now),
    ).toBe(false);

    expect(
      isShareLinkActive(
        {
          revokedAt: new Date("2026-08-10T00:00:00.000Z"),
          expiresAt: new Date("2026-12-31T00:00:00.000Z"),
        },
        now,
      ),
    ).toBe(false);
  });

  it("property — token ไม่ซ้ำและยาวคงที่", () => {
    fc.assert(
      fc.property(fc.integer({ min: 8, max: 64 }), () => {
        const tokens = Array.from({ length: 16 }, () => createShareToken());
        const lengths = new Set(tokens.map((token) => token.length));
        expect(lengths.size).toBe(1);
        expect(tokens[0]?.length).toBeGreaterThan(0);
        expect(new Set(tokens).size).toBe(tokens.length);
      }),
      { numRuns: 20 },
    );
  });
});
