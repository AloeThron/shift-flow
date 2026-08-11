import { expect, test } from "@playwright/test";

/** smoke test หน้าแรกและ health endpoint */
test.describe("scaffold smoke", () => {
  test("health endpoint ตอบ ok พร้อม database check", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();

    const body = (await response.json()) as {
      status: string;
      checks: { database: string };
    };
    expect(body.status).toBe("ok");
    expect(body.checks.database).toBe("up");
  });

  test("หน้าแรกแสดงชื่อ Shift-Flow", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Shift-Flow" })).toBeVisible();
  });

  test("หน้า login แสดงฟอร์ม", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible();
    await expect(page.getByLabel("ชื่อผู้ใช้")).toBeVisible();
  });
});
