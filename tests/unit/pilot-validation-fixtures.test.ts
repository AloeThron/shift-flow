import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DATASET = join(process.cwd(), "demo/validation-dataset");

type StatusSummary = {
  total_cells: number;
  unique_staff: number;
  by_status: Record<string, number>;
};

type TokenGolden<T> = {
  token_count: number;
  tokens: Record<string, T>;
};

/** นับบรรทัด CSV ไม่รวม header */
function countCsvRows(path: string): number {
  const text = readFileSync(path, "utf8").trim();
  if (!text) return 0;
  return text.split("\n").length - 1;
}

describe("validation dataset integrity", () => {
  it("มีไฟล์หลักครบ", () => {
    const required = [
      "manifest.yaml",
      "staff_master.csv",
      "roster_long.csv",
      "edge_cases/roster_cells.csv",
      "golden/status_summary.json",
      "golden/parse_shift_tokens.json",
      "golden/fairness_metrics.json",
    ];
    for (const file of required) {
      expect(readFileSync(join(DATASET, file), "utf8").length).toBeGreaterThan(0);
    }
  });

  it("roster_long ตรงกับ status_summary golden", () => {
    const summary = JSON.parse(
      readFileSync(join(DATASET, "golden/status_summary.json"), "utf8"),
    ) as StatusSummary;

    expect(countCsvRows(join(DATASET, "roster_long.csv"))).toBe(summary.total_cells);
    expect(summary.unique_staff).toBeGreaterThanOrEqual(20);
    expect(summary.by_status.UNKNOWN).toBeGreaterThan(0);
    expect(summary.by_status.ASSIGNED).toBeGreaterThan(summary.by_status.UNKNOWN);
  });

  it("staff_master ไม่มีฟิลด์ off-repo", () => {
    const header = readFileSync(join(DATASET, "staff_master.csv"), "utf8").split("\n")[0] ?? "";
    expect(header).not.toContain("majority_name");
    expect(header).not.toContain("employee_id");
  });
});

describe("parse_shift golden (OCR pipeline)", () => {
  it("edge cases ตรง golden status/confidence", () => {
    const parseGolden = JSON.parse(
      readFileSync(join(DATASET, "golden/parse_shift_tokens.json"), "utf8"),
    ) as TokenGolden<{
      status: string;
      confidence: string;
      canonical_area: string;
      crosses_midnight: boolean;
    }>;

    const edgeText = readFileSync(join(DATASET, "edge_cases/roster_cells.csv"), "utf8");
    const lines = edgeText.trim().split("\n").slice(1);

    for (const line of lines) {
      const parts = line.split(",");
      const rawCode = parts[3] ?? "";
      const expectedStatus = parts[8] ?? "";
      const expectedArea = parts[4] ?? "";
      const golden = parseGolden.tokens[rawCode];
      expect(golden, `missing golden for ${rawCode}`).toBeDefined();
      expect(golden?.status).toBe(expectedStatus);
      expect(golden?.canonical_area).toBe(expectedArea);
    }
  });

  it("ครอบคลุม token พิเศษจาก taxonomy", () => {
    const parseGolden = JSON.parse(
      readFileSync(join(DATASET, "golden/parse_shift_tokens.json"), "utf8"),
    ) as TokenGolden<{ status: string }>;

    const mustHave = ["?", "off", "บด", "7HE", "MI20", "N1", "F/16", "BB/18"];
    for (const token of mustHave) {
      expect(parseGolden.tokens[token], token).toBeDefined();
    }
    expect(parseGolden.tokens["?"]?.status).toBe("UNKNOWN");
    expect(parseGolden.tokens["off"]?.status).toBe("OFF");
    expect(parseGolden.tokens["บด"]?.status).toBe("ASSIGNED");
  });
});

describe("pilot data isolation", () => {
  it("staff_code ใช้รูปแบบ STAFF-xxx ไม่ใช่ STAFF-DEMO", () => {
    const roster = readFileSync(join(DATASET, "roster_long.csv"), "utf8");
    expect(roster).toMatch(/STAFF-\d{3}/);
    expect(roster).not.toMatch(/STAFF-DEMO/);
  });
});
