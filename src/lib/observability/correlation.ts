/** ชื่อ header สำหรับ correlation ID ข้าม request */
export const CORRELATION_HEADER = "x-correlation-id";

/** สร้าง correlation ID ใหม่ */
export function createCorrelationId(): string {
  return crypto.randomUUID();
}

/** อ่าน correlation ID จาก header หรือสร้างใหม่ */
export function resolveCorrelationId(headerValue: string | null): string {
  if (headerValue && headerValue.trim().length > 0) {
    return headerValue.trim();
  }
  return createCorrelationId();
}
