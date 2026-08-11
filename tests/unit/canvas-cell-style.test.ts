import { describe, expect, it } from "vitest";

import { isCanvasCellLocked } from "@/components/schedule/canvas/cell-style";

describe("canvas cell lock styling", () => {
  it("isCanvasCellLocked รวม pin และ lock วันหยุด", () => {
    expect(isCanvasCellLocked({ isPinned: false, plannedOffLocked: false })).toBe(false);
    expect(isCanvasCellLocked({ isPinned: true, plannedOffLocked: false })).toBe(true);
    expect(isCanvasCellLocked({ isPinned: false, plannedOffLocked: true })).toBe(true);
  });
});
