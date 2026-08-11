import { execSync } from "node:child_process";
import { config } from "dotenv";

/** เตรียม test DB ก่อนรัน Playwright */
export default async function globalSetup(): Promise<void> {
  config({ path: ".env.test" });
  config({ path: ".env.local" });

  const env = process.env as NodeJS.ProcessEnv & { NODE_ENV?: string };
  env.NODE_ENV ??= "test";
  process.env.DATABASE_URL ??=
    "postgresql://shiftflow:shiftflow@localhost:5432/shiftflow_test?schema=public";
  process.env.DIRECT_URL ??= process.env.DATABASE_URL;
  process.env.AUTH_SECRET ??= "test-auth-secret-minimum-32-characters-long";
  process.env.NEXTAUTH_URL ??= "http://127.0.0.1:3099";
  process.env.DATABASE_PROVIDER ??= "local";

  execSync("pnpm db:migrate:deploy", { stdio: "inherit", env: process.env });
  execSync("pnpm db:seed", { stdio: "inherit", env: process.env });
  execSync("pnpm exec tsx e2e/prepare-canvas-draft.ts", { stdio: "inherit", env: process.env });
}
