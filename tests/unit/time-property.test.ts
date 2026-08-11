import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
    addDaysToDate,
    buildAssignmentInterval,
    intervalsOverlap,
    localDateTimeToIso,
    shiftCrossesMidnight,
} from "@/domain/schedule/time";

const TIMEZONE = "Asia/Bangkok";

/** property tests สำหรับ time model */
describe("time model — property", () => {
  it("buildAssignmentInterval ของกะข้ามคืนให้ endAt หลัง startAt", () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const interval = buildAssignmentInterval(
          { startTime: "20:00", endTime: "08:00" },
          "2026-03-01",
          TIMEZONE,
        );
        expect(Date.parse(interval.endAt)).toBeGreaterThan(Date.parse(interval.startAt));
      }),
    );
  });

  it("intervalsOverlap สมมาตric — overlap(A,B) === overlap(B,A)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 1, max: 4 }),
        (startA, lenA, startB, lenB) => {
          const toIso = (hour: number) =>
            localDateTimeToIso("2026-03-01", `${String(hour).padStart(2, "0")}:00`, TIMEZONE);
          const endA = startA + lenA;
          const endB = startB + lenB;
          const aStart = toIso(startA);
          const aEnd = toIso(endA);
          const bStart = toIso(startB);
          const bEnd = toIso(endB);

          expect(intervalsOverlap(aStart, aEnd, bStart, bEnd)).toBe(
            intervalsOverlap(bStart, bEnd, aStart, aEnd),
          );
        },
      ),
    );
  });

  it("shiftCrossesMidnight ตรวจจากเวลาเริ่ม–จบ", () => {
    expect(shiftCrossesMidnight("20:00", "08:00")).toBe(true);
    expect(shiftCrossesMidnight("08:00", "16:00")).toBe(false);
  });

  it("addDaysToDate เพิ่มวันถูกต้อง", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 28 }), (days) => {
        const next = addDaysToDate("2026-03-01", days);
        expect(next > "2026-03-01").toBe(true);
      }),
    );
  });
});
