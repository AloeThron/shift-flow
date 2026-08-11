/** คีย์ที่ต้อง redact ออกจาก log/metrics */
const SENSITIVE_KEYS = [
  "password",
  "passwordhash",
  "token",
  "secret",
  "authorization",
  "cookie",
  "session",
  "email",
  "displayname",
  "username",
] as const;

/** redact ค่า sensitive ใน object ก่อน log */
export function redactSensitive<T>(value: T): T {
  return redactValue(value) as T;
}

function redactValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.includes(key.toLowerCase() as (typeof SENSITIVE_KEYS)[number])) {
        result[key] = "[REDACTED]";
        continue;
      }
      result[key] = redactValue(nested);
    }
    return result;
  }

  return value;
}
