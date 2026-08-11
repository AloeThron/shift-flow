import "dotenv/config";
import { defineConfig } from "prisma/config";

/** URL สำหรับ CLI — fallback ตอน postinstall/generate ที่ยังไม่มี .env */
const directUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  "postgresql://shiftflow:shiftflow@localhost:5432/shiftflow?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: directUrl,
  },
});
