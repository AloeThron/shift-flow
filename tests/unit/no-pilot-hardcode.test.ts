import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { FORBIDDEN_PILOT_TOKENS } from "../fixtures/forbidden-pilot-tokens";

/** ลบ comment ออกจาก source ก่อนสแกน */
function stripComments(source: string): string {
  const withoutBlock = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutBlock.replace(/\/\/.*$/gm, "");
}

/** รวบรวมไฟล์ .ts/.tsx ใน src/ */
function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }

  return files;
}

/** regression — ห้ามมีค่าเฉพาะแล็บนำร่องใน src/ */
describe("no pilot hardcode in src/", () => {
  it("ไม่มี token จากแล็บนำร่องใน source code", () => {
    const srcRoot = path.resolve(process.cwd(), "src");
    const files = collectSourceFiles(srcRoot);
    const violations: string[] = [];

    for (const file of files) {
      const content = stripComments(readFileSync(file, "utf8"));
      for (const token of FORBIDDEN_PILOT_TOKENS) {
        if (content.includes(token)) {
          violations.push(`${path.relative(process.cwd(), file)} → "${token}"`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
