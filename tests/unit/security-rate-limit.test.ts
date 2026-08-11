import { beforeEach, describe, expect, it } from "vitest";

import { loginRateLimiter, loginRateLimitKey, RateLimiter } from "@/lib/security/rate-limit";

/** ทดสอบ rate limiter สำหรับ login */
describe("login rate limiter", () => {
  beforeEach(() => {
    loginRateLimiter.clear();
  });

  it("อนุญาต attempt ภายใน quota", () => {
    const key = loginRateLimitKey("user.demo", "127.0.0.1");
    const first = loginRateLimiter.check(key);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(4);
  });

  it("บล็อก attempt เมื่อเกิน quota", () => {
    const limiter = new RateLimiter(2, 60_000);
    const key = "test-key";

    expect(limiter.check(key).allowed).toBe(true);
    expect(limiter.check(key).allowed).toBe(true);
    const blocked = limiter.check(key);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("แยก bucket ตาม username และ IP", () => {
    const keyA = loginRateLimitKey("alice", "1.1.1.1");
    const keyB = loginRateLimitKey("bob", "1.1.1.1");

    for (let index = 0; index < 5; index += 1) {
      loginRateLimiter.check(keyA);
    }

    const bobAttempt = loginRateLimiter.check(keyB);
    expect(bobAttempt.allowed).toBe(true);
  });
});
