import { expect, type Locator, type Page, test } from "@playwright/test";

import { openScheduleCanvas } from "./helpers/auth";

/** หาเซลล์ที่มีรหัสเวร (ไม่ใช่วันหยุดหรือช่องว่าง) */
function firstShiftCodeCell(page: Page): Locator {
  return page
    .locator("tbody td button")
    .filter({ hasNotText: /^—$/ })
    .filter({ hasNotText: /^off$/i })
    .first();
}

/** หาเซลล์ว่างในวันสุดท้ายของสัปดาห์แรก (prepare เว้น assignment ไว้) */
function firstEmptyCellInFirstWeek(page: Page): Locator {
  return page
    .getByRole("button", { name: /รหัสเวร.*2026-09-07/ })
    .filter({ hasText: "—" })
    .first();
}

/** เปิด popup เลือกรหัสเวรแล้วรอ listbox พร้อม */
async function openShiftCodePicker(page: Page, cell: Locator): Promise<void> {
  await cell.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByLabel("ค้นหารหัสเวร")).toBeVisible();
  await expect(page.getByRole("listbox", { name: "ตัวเลือกรหัสเวร" })).toBeVisible({
    timeout: 15_000,
  });
}

/** เลือกรหัสเวรจาก popup ด้วยคำค้น */
async function selectShiftCodeInPicker(page: Page, shiftCode: string): Promise<void> {
  const search = page.getByLabel("ค้นหารหัสเวร");
  await search.fill(shiftCode);
  const option = page.getByRole("option").filter({ hasText: shiftCode }).first();
  await expect(option).toBeVisible({ timeout: 10_000 });
  await option.click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
}

/** e2e canvas — แก้เซลล์, ลงวันหยุด, solver, ล็อกเซลล์ */
test.describe("schedule canvas", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeEach(async ({ page }) => {
    await openScheduleCanvas(page);
    await expect(firstShiftCodeCell(page)).toBeVisible({ timeout: 15_000 });
  });

  test("เปิด popup ด้วย Enter เลือกอันดับแรกด้วย Enter แล้วบันทึกสำเร็จ", async ({ page }) => {
    const cell = firstEmptyCellInFirstWeek(page);
    await expect(cell).toBeVisible({ timeout: 10_000 });

    await cell.click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    await cell.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("listbox", { name: "ตัวเลือกรหัสเวร" })).toHaveAttribute(
      "aria-busy",
      "false",
      { timeout: 15_000 },
    );

    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
    await expect(cell).not.toHaveText("—", { timeout: 15_000 });
  });

  test("popup เปิดทันทีและโหลดรายการรหัสเวร", async ({ page }) => {
    const cell = firstShiftCodeCell(page);
    await cell.click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 });
    await expect(page.getByLabel("ค้นหารหัสเวร")).toBeVisible();

    const listbox = page.getByRole("listbox", { name: "ตัวเลือกรหัสเวร" });
    await expect(listbox).toBeVisible({ timeout: 15_000 });
    await expect(listbox).toHaveAttribute("aria-busy", "false", { timeout: 15_000 });
    await expect(page.getByRole("option").first()).toBeVisible();
  });

  test("แก้เซลล์ผ่าน popup", async ({ page }) => {
    const cell = firstShiftCodeCell(page);
    const currentCode = (await cell.textContent())?.trim() ?? "";
    expect(currentCode.length).toBeGreaterThan(0);

    await openShiftCodePicker(page, cell);
    await selectShiftCodeInPicker(page, currentCode);
    await expect(cell).toHaveText(currentCode, { timeout: 15_000 });
  });

  test("ลงวันหยุดที่เซลล์ที่เลือก", async ({ page }) => {
    const cell = firstEmptyCellInFirstWeek(page);
    await expect(cell).toBeVisible({ timeout: 10_000 });
    const cellLabel = await cell.getAttribute("aria-label");

    await openShiftCodePicker(page, cell);

    const dayOffOption = page.getByRole("option", { name: /วันหยุด/i }).first();
    await expect(dayOffOption).toBeVisible({ timeout: 10_000 });
    await dayOffOption.click();

    await expect(page.locator(`button[aria-label^="${cellLabel ?? ""}"]`)).toHaveText(/off/i, {
      timeout: 15_000,
    });
  });

  test("ล็อกเซลล์แล้ว popup แสดงปุ่มปลดล็อกและไม่มีตัวเลือกรหัส", async ({ page }) => {
    const cell = firstShiftCodeCell(page);

    await openShiftCodePicker(page, cell);
    await page.getByRole("button", { name: "ล็อกเซลล์" }).click();

    await expect(page.getByRole("button", { name: "ปลดล็อกเซลล์" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByLabel("ค้นหารหัสเวร")).toBeHidden();
    await expect(page.getByRole("listbox", { name: "ตัวเลือกรหัสเวร" })).toBeHidden();
    await expect(page.getByRole("option")).toHaveCount(0);
  });

  test("ล็อกเซลล์แล้ว solver เกลี่ยงานไม่แตะค่า", async ({ page }) => {
    const cell = firstShiftCodeCell(page);
    const pinnedCode = (await cell.textContent())?.trim() ?? "";

    await openShiftCodePicker(page, cell);
    await page.getByRole("button", { name: "ล็อกเซลล์" }).click();
    const balanceButton = page.getByRole("button", { name: "เกลี่ยงาน" });
    await balanceButton.click();
    await expect(balanceButton).toBeEnabled({ timeout: 120_000 });

    await expect(cell).toHaveText(pinnedCode);
  });

  test("สั่งเกลี่ยงานจากแถบเครื่องมือ", async ({ page }) => {
    const balanceButton = page.getByRole("button", { name: "เกลี่ยงาน" });
    await balanceButton.click();
    await expect(balanceButton).toBeEnabled({ timeout: 120_000 });
    await expect(page.getByText("ข้อจำกัด")).toBeVisible();
  });
});
