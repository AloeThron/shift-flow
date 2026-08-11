import { NextResponse } from "next/server";

import { env } from "@/env";
import { prisma } from "@/lib/prisma";

/** health check สำหรับ CI และ monitoring */
export async function GET(): Promise<NextResponse> {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      service: "shift-flow",
      checks: {
        database: "up",
      },
      latencyMs: Date.now() - startedAt,
      environment: env.NODE_ENV,
    });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        service: "shift-flow",
        checks: {
          database: "down",
        },
        latencyMs: Date.now() - startedAt,
        environment: env.NODE_ENV,
      },
      { status: 503 },
    );
  }
}
