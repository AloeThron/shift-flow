/**
 * ชื่อ/รหัสจาก OCR pilot ที่ห้ามปรากฏในไฟล์ commit ได้
 * สร้างจาก pilot-vault/raw (local) — อัปเดตเมื่อพบ leak ใหม่
 */
export const FORBIDDEN_PII_TOKENS = [
  "ใบหม่อน JTH",
  "ใบหม่อน",
  "กรกนก",
  "กฤติยา",
  "กัลยาพร",
  "100798",
  "513820",
  "527037",
  "546585",
] as const;

/** โฟลเดอร์ที่อนุญาตให้มี PII (gitignore) */
export const PII_ALLOWED_PREFIXES = [
  "pilot-vault/raw/",
  "pilot-vault/anonymized/",
  "pilot-vault/consent/",
] as const;

/** โฟลเดอร์ที่ต้องสแกนหาชื่อ/รหัสจริง */
export const PII_SCAN_ROOTS = ["docs", "demo"] as const;
