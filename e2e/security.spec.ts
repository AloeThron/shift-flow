import { expect, test } from "@playwright/test";

/** security smoke — headers และ generic login error */
test.describe("security controls", () => {
  test("response มี security headers หลัก", async ({ request }) => {
    const response = await request.get("/");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["x-correlation-id"]).toBeTruthy();
  });

  test("health endpoint ตอบพร้อม database check", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as {
      status: string;
      checks: { database: string };
    };
    expect(body.status).toBe("ok");
    expect(body.checks.database).toBe("up");
  });

  test("login ผิดพลาดแสดงข้อความ generic", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("ชื่อผู้ใช้").fill("nonexistent.user");
    await page.getByLabel("รหัสผ่าน").fill("wrong-password");
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
    await expect(page.getByText("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง")).toBeVisible();
  });
});
