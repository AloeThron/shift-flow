import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.test" });
loadEnv({ path: ".env.local" });

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://shiftflow:shiftflow@localhost:5432/shiftflow_test?schema=public";

const e2ePort = process.env.E2E_PORT ?? "3099";
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

/** E2E config — smoke + canvas/accessibility gates */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: e2eBaseUrl,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm start",
    url: `${e2eBaseUrl}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: e2ePort,
      NODE_ENV: "production",
      NEXTAUTH_URL: e2eBaseUrl,
      AUTH_SECRET: process.env.AUTH_SECRET ?? "test-auth-secret-minimum-32-characters-long",
      DATABASE_URL: databaseUrl,
      DIRECT_URL: process.env.DIRECT_URL ?? databaseUrl,
      DATABASE_PROVIDER: process.env.DATABASE_PROVIDER ?? "local",
      E2E_SOLVER_MAX_DAYS: "7",
      LOG_LEVEL: "warn",
    },
  },
});
