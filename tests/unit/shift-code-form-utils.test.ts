import { describe, expect, it } from "vitest";

import {
  buildShiftCodeFormInput,
  emptyShiftCodeDraft,
  formatShiftTimeRange,
  shiftCodeRowToDraft,
  toggleGradeSelection,
} from "@/components/config/shift-code-form-utils";
import { shiftCodeFormSchema } from "@/domain/config/schemas";

describe("shiftCodeFormSchema allowedGradeCodes", () => {
  it("ปฏิเสธ array ว่าง", () => {
    const result = shiftCodeFormSchema.safeParse({
      canonicalCode: "D",
      allowedGradeCodes: [],
      needsConfirmation: false,
      deprecated: false,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("ต้องเลือกระดับพนักงานอย่างน้อย 1 รายการ");
    }
  });

  it("ยอมรับ array ของ grade codes", () => {
    const result = shiftCodeFormSchema.safeParse({
      canonicalCode: "D",
      allowedGradeCodes: ["MT", "PT"],
      needsConfirmation: false,
      deprecated: false,
    });

    expect(result.success).toBe(true);
  });
});

describe("shift code form utils", () => {
  const row = {
    canonicalCode: "D",
    departmentId: "dept-1",
    startTime: "08:00",
    endTime: "16:00",
    standardHours: 8,
    allowedGradeCodes: ["MT", "PT"],
    needsConfirmation: false,
    deprecated: false,
  };

  it("shiftCodeRowToDraft คัดลอก allowedGradeCodes เป็น array", () => {
    const draft = shiftCodeRowToDraft(row);
    expect(draft.allowedGradeCodes).toEqual(["MT", "PT"]);
  });

  it("buildShiftCodeFormInput ส่ง allowedGradeCodes เป็น array", () => {
    const draft = shiftCodeRowToDraft(row);
    const input = buildShiftCodeFormInput(draft);
    expect(input.allowedGradeCodes).toEqual(["MT", "PT"]);
  });

  it("emptyShiftCodeDraft เลือกทุก grade active เป็นค่าเริ่มต้น", () => {
    const draft = emptyShiftCodeDraft(["MT", "PT", "ASSISTANT"]);
    expect(draft.allowedGradeCodes).toEqual(["MT", "PT", "ASSISTANT"]);
  });

  it("toggleGradeSelection เพิ่มและลบ grade code", () => {
    expect(toggleGradeSelection(["MT"], "PT")).toEqual(["MT", "PT"]);
    expect(toggleGradeSelection(["MT", "PT"], "MT")).toEqual(["PT"]);
  });

  it("formatShiftTimeRange แสดง (วันถัดไป) เมื่อ end ≤ start", () => {
    expect(formatShiftTimeRange("20:00", "08:00")).toBe("20:00–08:00 (วันถัดไป)");
    expect(formatShiftTimeRange("08:00", "16:00")).toBe("08:00–16:00");
  });
});
