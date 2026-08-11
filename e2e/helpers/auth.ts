import type { Page } from "@playwright/test";

import { DEV_DEMO_PASSWORD } from "../../src/lib/auth/dev-demo-accounts";

/** login ด้วย credentials demo */
export async function loginWithCredentials(
  page: Page,
  username: string,
  password: string = DEV_DEMO_PASSWORD,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้").fill(username);
  await page.getByLabel("รหัสผ่าน").fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await page.waitForURL(/\/schedule/);
}

/** login เป็นผู้จัดเวร demo */
export async function loginAsScheduler(page: Page): Promise<void> {
  await loginWithCredentials(page, "scheduler.demo");
}

/** เปิดหน้า canvas รอบที่แก้ได้ */
export async function openScheduleCanvas(page: Page): Promise<void> {
  await loginAsScheduler(page);
  await page.goto("/schedule");
  await page.waitForURL(/\/schedule\/[^/]+$/);
  await page.getByRole("region", { name: "Canvas จัดเวร" }).waitFor();
}
