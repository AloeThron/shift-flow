import argon2 from "argon2";

/** hash รหัสผ่านด้วย Argon2id */
export async function hash(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

/** ตรวจรหัสผ่านกับ hash ที่เก็บไว้ */
export async function verify(password: string, passwordHash: string): Promise<boolean> {
  return argon2.verify(passwordHash, password);
}
