import { config } from "dotenv";

/** โหลด env ก่อน integration tests */
config({ path: ".env.test" });
config({ path: ".env.local" });
config();

process.env.DATABASE_PROVIDER ??= "local";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://shiftflow:shiftflow@localhost:5432/shiftflow_test?schema=public";
}

if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = "test-auth-secret-minimum-32-characters-long";
}

if (!process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = "http://localhost:3000";
}
