/** ผลลัพธ์การตรวจ rate limit */
export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type Bucket = {
  count: number;
  windowStartMs: number;
};

/** sliding window rate limiter แบบ in-memory */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
  ) {}

  /** ตรวจและนับ attempt — คืน allowed=false เมื่อเกิน quota */
  check(key: string, nowMs = Date.now()): RateLimitResult {
    const bucket = this.buckets.get(key);
    const windowStartMs = nowMs - this.windowMs;

    if (!bucket || bucket.windowStartMs < windowStartMs) {
      this.buckets.set(key, { count: 1, windowStartMs: nowMs });
      return {
        allowed: true,
        remaining: this.maxAttempts - 1,
        retryAfterSeconds: 0,
      };
    }

    if (bucket.count >= this.maxAttempts) {
      const retryAfterMs = bucket.windowStartMs + this.windowMs - nowMs;
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      };
    }

    bucket.count += 1;
    return {
      allowed: true,
      remaining: this.maxAttempts - bucket.count,
      retryAfterSeconds: 0,
    };
  }

  /** รีเซ็ต key เดียว — ใช้ใน test */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  /** ล้าง state ทั้งหมด */
  clear(): void {
    this.buckets.clear();
  }
}

/** rate limiter สำหรับ login — 5 ครั้ง / 15 นาที ต่อ account+IP */
export const loginRateLimiter = new RateLimiter(5, 15 * 60 * 1000);

/** สร้าง key สำหรับ login rate limit */
export function loginRateLimitKey(username: string, ipAddress: string | null): string {
  const ip = ipAddress?.trim() || "unknown-ip";
  return `login:${username.toLowerCase()}:${ip}`;
}
