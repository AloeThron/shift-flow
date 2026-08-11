import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { loginAsScheduler } from "./helpers/auth";

/** e2e — publish, เปิดลิงก์แชร์แบบไม่ล็อกอิน, เพิกถอนแล้ว 404 */
test.describe("share link", () => {
  test("เผยแพร่แล้วเปิดลิงก์ได้โดยไม่ล็อกอิน และเพิกถอนแล้วได้ 404", async ({ page, browser }) => {
    await loginAsScheduler(page);
    await page.goto("/schedule");
    await page.waitForURL(/\/schedule\/[^/]+$/);

    const shareDialogButton = page.getByRole("button", { name: "เผยแพร่และแชร์" });
    await expect(shareDialogButton).toBeVisible({ timeout: 15_000 });
    await shareDialogButton.click();

    const publishButton = page.getByRole("button", { name: "เผยแพร่ตาราง" });
    await expect(publishButton).toBeVisible({ timeout: 15_000 });

    const overrideField = page.getByLabel("เหตุผล override (บังคับ)");
    if (await overrideField.isVisible()) {
      await overrideField.fill("e2e override — ยอมรับ hard violation ชั่วคราว");
    }

    await publishButton.click();
    await expect(page.getByText("ลิงก์แชร์ (แสดงครั้งเดียว)")).toBeVisible({
      timeout: 30_000,
    });

    const shareUrl = await page.locator("code").first().textContent();
    expect(shareUrl).toMatch(/\/s\//);

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(shareUrl!.trim());
    await expect(guestPage.getByText("ตารางเวรแบบอ่านอย่างเดียว")).toBeVisible({
      timeout: 20_000,
    });

    const axeResults = await new AxeBuilder({ page: guestPage }).analyze();
    const blocking = axeResults.violations.filter(
      (item) => item.impact === "serious" || item.impact === "critical",
    );
    expect(blocking).toEqual([]);

    await guestContext.close();

    const revokeButton = page.getByRole("button", { name: "เพิกถอน" }).first();
    await expect(revokeButton).toBeVisible({ timeout: 10_000 });
    await revokeButton.click();

    const guestAfterRevoke = await browser.newContext();
    const revokedPage = await guestAfterRevoke.newPage();
    await revokedPage.goto(shareUrl!.trim());
    await expect(revokedPage.getByRole("heading", { name: "ไม่พบตารางเวร" })).toBeVisible({
      timeout: 20_000,
    });
    await guestAfterRevoke.close();
  });
});
