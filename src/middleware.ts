import { NextResponse, type NextRequest } from "next/server";

import { CORRELATION_HEADER, resolveCorrelationId } from "@/lib/observability/correlation";
import { applySecurityHeaders } from "@/lib/security/headers";

/** middleware — correlation ID + security headers */
export function middleware(request: NextRequest): NextResponse {
  const correlationId = resolveCorrelationId(request.headers.get(CORRELATION_HEADER));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CORRELATION_HEADER, correlationId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  applySecurityHeaders(response.headers);
  response.headers.set(CORRELATION_HEADER, correlationId);

  if (request.nextUrl.pathname.startsWith("/s/")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "no-store");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
