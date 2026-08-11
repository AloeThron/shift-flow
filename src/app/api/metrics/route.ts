import { NextResponse } from "next/server";

import { env } from "@/env";
import { metrics } from "@/lib/observability/metrics";

/** metrics endpoint — ใช้ใน staging/ops เท่านั้น */
export async function GET(request: Request): Promise<NextResponse> {
  if (env.NODE_ENV === "production") {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const expected = process.env.METRICS_TOKEN;

    if (!expected || token !== expected) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json({
    service: "shift-flow",
    collectedAt: new Date().toISOString(),
    metrics: metrics.snapshot(),
  });
}
