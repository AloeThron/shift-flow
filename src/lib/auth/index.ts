import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { verify } from "@/lib/auth/password";
import { logger } from "@/lib/observability/logger";
import { metrics } from "@/lib/observability/metrics";
import { prisma } from "@/lib/prisma";
import { loginRateLimitKey, loginRateLimiter } from "@/lib/security/rate-limit";

/** ข้อมูล session JWT ที่ขยายแล้ว */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      organizationId: string | null;
      role: string | null;
    };
  }

  interface User {
    username: string;
    organizationId?: string | null;
    role?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    tokenVersion: number;
    organizationId: string | null;
    role: string | null;
  }
}

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

/** คอนฟิก Auth.js — Credentials + JWT, ไม่มี public signup */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: {
    signIn: "/login",
    signOut: "/signout",
  },

  providers: [
    Credentials({
      credentials: {
        username: { label: "ชื่อผู้ใช้", type: "text" },
        password: { label: "รหัสผ่าน", type: "password" },
      },
      authorize: async (credentials, request) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const ipAddress =
          request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request?.headers?.get("x-real-ip") ??
          null;
        const rateKey = loginRateLimitKey(parsed.data.username, ipAddress);
        const rate = loginRateLimiter.check(rateKey);

        if (!rate.allowed) {
          metrics.increment("auth_login_rate_limited_total");
          logger.warn("login rate limited", {
            event: "auth.login.rate_limited",
            username: parsed.data.username,
            retryAfterSeconds: rate.retryAfterSeconds,
          });
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { username: parsed.data.username },
          include: {
            memberships: {
              where: { status: "ACTIVE" },
              take: 1,
              orderBy: { createdAt: "asc" },
            },
          },
        });

        if (!user || user.status !== "ACTIVE") {
          metrics.increment("auth_login_failure_total", { reason: "invalid_credentials" });
          logger.info("login failed", {
            event: "auth.login.failure",
            reason: "invalid_credentials",
          });
          return null;
        }

        const valid = await verify(parsed.data.password, user.passwordHash);
        if (!valid) {
          metrics.increment("auth_login_failure_total", { reason: "invalid_credentials" });
          logger.info("login failed", {
            event: "auth.login.failure",
            reason: "invalid_credentials",
          });
          return null;
        }

        loginRateLimiter.reset(rateKey);
        metrics.increment("auth_login_success_total");
        logger.info("login succeeded", { event: "auth.login.success" });

        const membership = user.memberships[0];

        return {
          id: user.id,
          name: user.displayName ?? user.username,
          email: user.email,
          username: user.username,
          organizationId: membership?.organizationId ?? null,
          role: membership?.role ?? null,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }): Promise<JWT | null> => {
      if (user?.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { tokenVersion: true, username: true },
        });

        token.id = user.id;
        token.username = user.username ?? dbUser?.username ?? "";
        token.tokenVersion = dbUser?.tokenVersion ?? 0;
        token.organizationId = user.organizationId ?? null;
        token.role = user.role ?? null;
      }

      if (typeof token.id === "string" && token.id.length > 0) {
        const current = await prisma.user.findUnique({
          where: { id: token.id },
          select: { tokenVersion: true },
        });

        if (!current || current.tokenVersion !== token.tokenVersion) {
          return null;
        }
      }

      return token as JWT;
    },
    session: async ({ session, token }) => {
      if (!token?.id) {
        return session;
      }

      session.user = {
        ...session.user,
        id: token.id,
        username: token.username,
        organizationId: token.organizationId,
        role: token.role,
      };

      return session;
    },
  },
  trustHost: true,
});
