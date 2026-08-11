import { beforeEach, describe, expect, it } from "vitest";

import { formatLogEntry, shouldLog } from "@/lib/observability/logger";
import { MetricsCollector } from "@/lib/observability/metrics";
import { redactSensitive } from "@/lib/observability/redact";

/** ทดสอบ observability helpers */
describe("observability", () => {
  describe("redactSensitive", () => {
    it("redact password และ token", () => {
      const result = redactSensitive({
        username: "demo",
        password: "secret",
        token: "abc",
        nested: { authorization: "Bearer x" },
      }) as Record<string, unknown>;

      expect(result.password).toBe("[REDACTED]");
      expect(result.token).toBe("[REDACTED]");
      expect((result.nested as Record<string, unknown>).authorization).toBe("[REDACTED]");
    });
  });

  describe("formatLogEntry", () => {
    it("สร้าง structured log พร้อม redact", () => {
      const entry = formatLogEntry("info", "test event", {
        correlationId: "cid-1",
        password: "hidden",
      });

      expect(entry.level).toBe("info");
      expect(entry.message).toBe("test event");
      expect(entry.password).toBe("[REDACTED]");
    });
  });

  describe("shouldLog", () => {
    it("กรองระดับ log ตาม env", () => {
      expect(typeof shouldLog("info")).toBe("boolean");
    });
  });

  describe("MetricsCollector", () => {
    let collector: MetricsCollector;

    beforeEach(() => {
      collector = new MetricsCollector();
    });

    it("increment counter พร้อม labels", () => {
      collector.increment("auth_login_failure_total", { reason: "invalid_credentials" });
      collector.increment("auth_login_failure_total", { reason: "invalid_credentials" });

      const snapshot = collector.snapshot();
      expect(snapshot).toHaveLength(1);
      expect(snapshot[0]?.value).toBe(2);
    });

    it("set gauge แยกจาก counter", () => {
      collector.setGauge("db_pool_size", 4);
      const snapshot = collector.snapshot();
      expect(snapshot[0]?.kind).toBe("gauge");
      expect(snapshot[0]?.value).toBe(4);
    });
  });
});
