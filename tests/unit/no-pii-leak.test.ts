import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  FORBIDDEN_PII_TOKENS,
  PII_ALLOWED_PREFIXES,
  PII_SCAN_ROOTS,
} from "../fixtures/forbidden-pii-tokens";

/** รวบรวมไฟล์ข้อความในโฟลเดอร์ */
function collectTextFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTextFiles(fullPath));
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if ([".ts", ".tsx", ".md", ".csv", ".json", ".yaml", ".yml", ".py"].includes(ext)) {
      files.push(fullPath);
    }
  }

  return files;
}

/** ตรวจว่า path อยู่ในโซนที่ gitignore สำหรับ PII */
function isAllowedPiiPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  return PII_ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

/** regression — ห้ามมีชื่อ/รหัสจริงจาก pilot ในไฟล์ commit ได้ */
describe("no PII leak in commit-able paths", () => {
  it("ไม่มี forbidden PII token ใน docs/demo", () => {
    const root = process.cwd();
    const violations: string[] = [];

    for (const scanRoot of PII_SCAN_ROOTS) {
      const absRoot = path.join(root, scanRoot);
      if (!statSync(absRoot, { throwIfNoEntry: false })?.isDirectory()) {
        continue;
      }

      for (const file of collectTextFiles(absRoot)) {
        const relative = path.relative(root, file).replace(/\\/g, "/");
        if (isAllowedPiiPath(relative)) {
          continue;
        }

        const content = readFileSync(file, "utf8");
        for (const token of FORBIDDEN_PII_TOKENS) {
          if (content.includes(token)) {
            violations.push(`${relative} → "${token}"`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("validation-dataset ไม่มี id_map หรือคอลัมน์ name/employee_id", () => {
    const datasetRoot = path.join(process.cwd(), "demo/validation-dataset");
    const files = collectTextFiles(datasetRoot);
    const forbiddenColumns = ["employee_id", "name", "_majority_name_off_repo"];

    for (const file of files) {
      if (!file.endsWith(".csv")) {
        continue;
      }
      const header = readFileSync(file, "utf8").split("\n")[0] ?? "";
      for (const column of forbiddenColumns) {
        expect(header, path.relative(process.cwd(), file)).not.toContain(column);
      }
    }

    expect(
      statSync(path.join(datasetRoot, "id_map.csv"), { throwIfNoEntry: false }),
    ).toBeUndefined();
  });
});
