import { PrismaClient } from "@/generated/client/client";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import ws from "ws";

import { env } from "@/env";

/** สร้าง Prisma driver adapter factory ตาม DATABASE_PROVIDER */
function createAdapter(): PrismaNeon | PrismaPg {
  if (env.DATABASE_PROVIDER === "neon") {
    neonConfig.webSocketConstructor = ws;
    return new PrismaNeon({ connectionString: env.DATABASE_URL });
  }

  return new PrismaPg({ connectionString: env.DATABASE_URL });
}

/** singleton Prisma client พร้อม driver adapter (Prisma 7) */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    adapter: createAdapter(),
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/** ตรวจ delegate หลัง generate/migrate — กัน Next dev ค้าง client เก่าจาก HMR */
function isPrismaClientCurrent(client: PrismaClient): boolean {
  return typeof client.draftStaffDayOffQuota?.upsert === "function";
}

function resolvePrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && (env.NODE_ENV === "production" || isPrismaClientCurrent(cached))) {
    return cached;
  }

  const client = createPrismaClient();
  if (env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

/** proxy ให้ทุกการเข้าถึง resolve client ล่าสุดใน dev */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = resolvePrismaClient();
    const value = Reflect.get(client as object, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
