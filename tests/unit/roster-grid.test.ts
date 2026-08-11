import { describe, expect, it } from "vitest";

import { buildPublishedRosterGrid } from "@/domain/share";

describe("buildPublishedRosterGrid", () => {
  it("ประกอบ pivot คน × วัน และเติมเซลล์ว่าง", () => {
    const grid = buildPublishedRosterGrid({
      periodStart: "2026-08-01",
      periodEnd: "2026-08-03",
      staff: [
        { id: "s2", displayName: "Beta" },
        { id: "s1", displayName: "Alpha" },
      ],
      assignments: [
        {
          staffProfileId: "s1",
          displayName: "Alpha",
          localDate: "2026-08-03",
          shiftCode: "ช",
          nonWorkingDayKindCode: null,
          startsAt: "2026-08-03T01:00:00.000Z",
          endsAt: "2026-08-03T09:00:00.000Z",
        },
        {
          staffProfileId: "s2",
          displayName: "Beta",
          localDate: "2026-08-02",
          shiftCode: "MI18",
          nonWorkingDayKindCode: null,
          startsAt: "2026-08-02T10:00:00.000Z",
          endsAt: "2026-08-02T18:00:00.000Z",
        },
      ],
    });

    expect(grid.dates).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
    expect(grid.rows.map((row) => row.displayName)).toEqual(["Alpha", "Beta"]);
    expect(grid.rows[0]?.cells.map((cell) => cell.displayCode)).toEqual([null, null, "ช"]);
    expect(grid.rows[1]?.cells.map((cell) => cell.displayCode)).toEqual([null, "MI18", null]);
  });

  it("ใช้รหัสวันหยุดแทน shift code เมื่อเป็น non-working day", () => {
    const grid = buildPublishedRosterGrid({
      periodStart: "2026-08-01",
      periodEnd: "2026-08-01",
      staff: [{ id: "s1", displayName: "Alpha" }],
      assignments: [
        {
          staffProfileId: "s1",
          displayName: "Alpha",
          localDate: "2026-08-01",
          shiftCode: null,
          nonWorkingDayKindCode: "OFF",
          startsAt: null,
          endsAt: null,
        },
      ],
    });

    const cell = grid.rows[0]?.cells[0];
    expect(cell?.displayCode).toBe("OFF");
    expect(cell?.isNonWorkingDay).toBe(true);
  });
});
