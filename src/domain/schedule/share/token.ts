import { createHash, randomBytes } from "node:crypto";

/** ลิงก์แชร์ที่ใช้ตรวจสถานะ active */
export type ShareLinkActiveInput = {
  readonly revokedAt: Date | null;
  readonly expiresAt: Date;
};

/** สร้าง token แบบสุ่ม 32 bytes แล้ว encode เป็น base64url */
export function createShareToken(): string {
  return randomBytes(32).toString("base64url");
}

/** hash token ด้วย SHA-256 hex สำหรับเก็บใน DB */
export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** ตรวจว่าลิงก์ยังใช้ได้ — ไม่ถูกเพิกถอนและยังไม่หมดอายุ */
export function isShareLinkActive(link: ShareLinkActiveInput, now: Date): boolean {
  if (link.revokedAt !== null) {
    return false;
  }
  return link.expiresAt.getTime() > now.getTime();
}
