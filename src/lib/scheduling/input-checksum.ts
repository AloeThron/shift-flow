import { createHash } from "node:crypto";

/** สร้าง checksum แบบ deterministic จาก payload JSON */
export function buildInputChecksum(payload: unknown): string {
  const normalized = stableStringify(payload);
  return createHash("sha256").update(normalized).digest("hex");
}

/** stringify แบบเรียง key เพื่อ replay ได้ */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

/** seed คงที่จาก checksum และ attempt */
export function buildDeterministicSeed(inputChecksum: string, attemptNumber: number): string {
  return `${inputChecksum.slice(0, 16)}:${attemptNumber}`;
}
