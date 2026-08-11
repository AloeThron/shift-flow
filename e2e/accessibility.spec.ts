import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { openScheduleCanvas } from "./helpers/auth";

/** หาเซลล์ที่มีรหัสเวร (ไม่ใช่วันหยุดหรือช่องว่าง) */
function firstShiftCodeCell(page: import("@playwright/test").Page) {
  return page
    .locator("tbody td button")
    .filter({ hasNotText: /^—$/ })
    .filter({ hasNotText: /^off$/i })
    .first();
}

/** accessibility gate — WCAG 2.2 AA smoke */
test.describe("accessibility", () => {
  test("หน้าแรกไม่มี serious/critical violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (item) => item.impact === "serious" || item.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  test("หน้า login ไม่มี serious/critical violations", async ({ page }) => {
    await page.goto("/login");
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (item) => item.impact === "serious" || item.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  test("หน้า login มี label ที่เชื่อมกับ input", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("ชื่อผู้ใช้")).toBeVisible();
    await expect(page.getByLabel("รหัสผ่าน")).toBeVisible();
  });

  test("หน้า canvas จัดเวรไม่มี serious/critical violations", async ({ page }) => {
    await openScheduleCanvas(page);
    await expect(firstShiftCodeCell(page)).toBeVisible({ timeout: 15_000 });

    const results = await new AxeBuilder({ page })
      .include('[aria-label="Canvas จัดเวร"]')
      .disableRules(["scrollable-region-focusable", "color-contrast"])
      .analyze();
    const blocking = results.violations.filter(
      (item) => item.impact === "serious" || item.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  test("popup เลือกรหัสเวรที่โหลดเสร็จแล้วไม่มี serious/critical violations", async ({ page }) => {
    await openScheduleCanvas(page);
    const cell = firstShiftCodeCell(page);
    await expect(cell).toBeVisible({ timeout: 15_000 });

    await cell.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

    const listbox = page.getByRole("listbox", { name: "ตัวเลือกรหัสเวร" });
    await expect(listbox).toHaveAttribute("aria-busy", "false", { timeout: 15_000 });
    await expect(page.getByRole("option").first()).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .disableRules(["scrollable-region-focusable", "color-contrast"])
      .analyze();
    const blocking = results.violations.filter(
      (item) => item.impact === "serious" || item.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });
});
