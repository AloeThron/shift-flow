import { createEnv } from "@/lib/env/create-env";
import { z } from "zod";

/** schema สำหรับ validate environment — จุดเดียวที่แอปอ่าน env */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXTAUTH_URL: z.url(),
  AUTH_SECRET: z.string().min(32),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  DATABASE_PROVIDER: z.enum(["local", "neon"]).default("local"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type AppEnv = z.infer<typeof envSchema>;

/** environment ที่ validate แล้ว — import จากไฟล์นี้เท่านั้น */
export const env = createEnv({
  schema: envSchema,
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    DATABASE_PROVIDER: process.env.DATABASE_PROVIDER,
    LOG_LEVEL: process.env.LOG_LEVEL,
  },
});
