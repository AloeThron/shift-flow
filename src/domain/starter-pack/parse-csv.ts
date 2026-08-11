/** แยกแถว CSV แบบง่าย (รองรับ BOM และ trim) */
export function parseStarterPackCsv(content: string): Record<string, string>[] {
  const normalized = content.replace(/^\uFEFF/, "").trim();
  if (!normalized) {
    return [];
  }

  const lines = normalized.split(/\r?\n/);
  const headers = lines[0]?.split(",").map((header) => header.trim()) ?? [];

  return lines
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const values = line.split(",").map((value) => value.trim());
      return headers.reduce<Record<string, string>>((row, header, index) => {
        row[header] = values[index] ?? "";
        return row;
      }, {});
    });
}

/** แปลง string เป็นตัวเลข พร้อมค่า null เมื่อว่าง */
export function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** แยก pipe-delimited codes */
export function splitPipeCodes(value: string): readonly string[] {
  return value
    .split("|")
    .map((code) => code.trim())
    .filter(Boolean);
}
