import { describe, expect, it } from "vitest";

import {
    parseDateInput,
    staffShiftAuthorizationFormSchema,
} from "@/domain/config/schemas";
import { authCoversShiftCode, staffHasShiftAuthForInterval } from "@/domain/schedule/shift-auth";

describe("staffShiftAuthorizationFormSchema", () => {
  it("ยอมรับเมื่อเลือกรหัสเวรและวันหมดอายุ", () => {
    const result = staffShiftAuthorizationFormSchema.safeParse({
      coversAll: false,
      shiftCodeIds: ["code-mi20"],
      assessedAt: "2024-01-01",
      expiresAt: "2026-01-01",
    });

    expect(result.success).toBe(true);
  });

  it("ยอมรับเมื่อไม่ระบุวันหมดอายุ (ไม่หมดอายุ)", () => {
    const result = staffShiftAuthorizationFormSchema.safeParse({
      coversAll: false,
      shiftCodeIds: ["code-mi20"],
      assessedAt: "2024-01-01",
    });

    expect(result.success).toBe(true);
  });

  it("ยอมรับเมื่อเลือกทุกรหัสเวรโดยไม่ระบุ shiftCodeIds", () => {
    const result = staffShiftAuthorizationFormSchema.safeParse({
      coversAll: true,
      shiftCodeIds: [],
      assessedAt: "2024-01-01",
    });

    expect(result.success).toBe(true);
  });

  it("ปฏิเสธเมื่อไม่เลือกรหัสและไม่เลือกทั้งหมด", () => {
    const result = staffShiftAuthorizationFormSchema.safeParse({
      coversAll: false,
      shiftCodeIds: [],
      assessedAt: "2024-01-01",
    });

    expect(result.success).toBe(false);
  });

  it("ปฏิเสธเมื่อวันหมดอายุก่อนวันอนุมัติ", () => {
    const result = staffShiftAuthorizationFormSchema.safeParse({
      coversAll: false,
      shiftCodeIds: ["code-mi20"],
      assessedAt: "2024-06-01",
      expiresAt: "2024-01-01",
    });

    expect(result.success).toBe(false);
  });
});

describe("shift-auth", () => {
  it("coversAll ครอบคลุมทุกรหัสเวรในช่วงเวลา", () => {
    const startMs = Date.parse("2026-03-01T00:00:00.000Z");
    const endMs = Date.parse("2026-03-01T08:00:00.000Z");

    expect(
      staffHasShiftAuthForInterval(
        [
          {
            shiftCodeId: null,
            coversAllShiftCodes: true,
            validFrom: "2026-01-01",
            validTo: null,
          },
        ],
        "code-mi20",
        startMs,
        endMs,
      ),
    ).toBe(true);
  });

  it("authCoversShiftCode ไม่ match เมื่อหมดอายุก่อนเวร", () => {
    const startMs = Date.parse("2026-03-01T00:00:00.000Z");
    const endMs = Date.parse("2026-03-01T08:00:00.000Z");

    expect(
      authCoversShiftCode(
        {
          shiftCodeId: "code-mi20",
          validFrom: "2026-01-01",
          validTo: "2026-02-01",
        },
        "code-mi20",
        startMs,
        endMs,
      ),
    ).toBe(false);
  });

  it("validTo: null = ไม่หมดอายุ", () => {
    const startMs = Date.parse("2026-03-01T00:00:00.000Z");
    const endMs = Date.parse("2026-03-01T08:00:00.000Z");

    expect(
      staffHasShiftAuthForInterval(
        [
          {
            shiftCodeId: "code-mi20",
            validFrom: "2020-01-01",
            validTo: null,
          },
        ],
        "code-mi20",
        startMs,
        endMs,
      ),
    ).toBe(true);
  });

  it("validTo วันสุดท้ายครอบคลุมเวรที่จบในวันนั้น (inclusive สิ้นวัน local)", () => {
    const start = parseDateInput("2026-03-01");
    start.setHours(8, 0, 0, 0);
    const end = parseDateInput("2026-03-01");
    end.setHours(20, 0, 0, 0);

    expect(
      authCoversShiftCode(
        {
          shiftCodeId: "code-mi20",
          validFrom: "2026-01-01",
          validTo: "2026-03-01",
        },
        "code-mi20",
        start.getTime(),
        end.getTime(),
      ),
    ).toBe(true);
  });
});
