import type { RuleInstancePackRow } from "./types";

/** แปลง scalar YAML value */
function parseYamlScalar(raw: string): string | number | boolean {
  const value = raw.trim();

  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }

  const asNumber = Number(value);
  if (value !== "" && Number.isFinite(asNumber)) {
    return asNumber;
  }

  return value;
}

/** แปลง YAML list ของ object เช่น `- from: NIGHT` */
function parseYamlObjectList(lines: readonly string[]): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = [];
  let current: Record<string, unknown> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith("- ")) {
      if (current) {
        items.push(current);
      }

      const rest = trimmed.slice(2);
      const separator = rest.indexOf(":");
      current =
        separator > 0
          ? { [rest.slice(0, separator).trim()]: parseYamlScalar(rest.slice(separator + 1).trim()) }
          : {};
      continue;
    }

    if (current) {
      const separator = trimmed.indexOf(":");
      if (separator > 0) {
        const key = trimmed.slice(0, separator).trim();
        current[key] = parseYamlScalar(trimmed.slice(separator + 1).trim());
      }
    }
  }

  if (current) {
    items.push(current);
  }

  return items;
}

/** แปลง indented YAML list เช่น `- NIGHT` */
function parseYamlList(lines: readonly string[]): readonly string[] {
  return lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

/** แปลง params block ใต้ `params:` */
function parseParamsBlock(lines: readonly string[]): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      index += 1;
      continue;
    }

    const keyMatch = /^([a-zA-Z_][\w-]*):\s*(.*)$/.exec(trimmed);
    if (!keyMatch) {
      index += 1;
      continue;
    }

    const [, key, inlineValue] = keyMatch;
    if (!key) {
      index += 1;
      continue;
    }

    if (inlineValue === "") {
      const nested: string[] = [];
      index += 1;
      while (index < lines.length) {
        const nestedLine = lines[index];
        if (!nestedLine.startsWith("    ") && !nestedLine.startsWith("\t")) {
          break;
        }
        nested.push(nestedLine.trim());
        index += 1;
      }

      if (nested.some((item) => item.startsWith("- ") && item.includes(":"))) {
        params[key] = parseYamlObjectList(nested);
      } else if (nested.some((item) => item.startsWith("- "))) {
        params[key] = parseYamlList(nested);
      } else {
        params[key] = parseParamsBlock(nested.map((item) => `  ${item}`));
      }
      continue;
    }

    params[key] = parseYamlScalar(inlineValue);
    index += 1;
  }

  return params;
}

/** แปลง rule_instances.yaml แบบง่าย */
export function parseRuleInstancesYaml(content: string): RuleInstancePackRow[] {
  const blocks = content
    .split(/\n(?=- rule_template_id:)/)
    .map((block) => block.trim())
    .filter((block) => block.startsWith("- rule_template_id:"));

  return blocks.map((block) => {
    const lines = block.split(/\r?\n/);
    const header = lines[0] ?? "";
    const ruleTemplateId = header.replace("- rule_template_id:", "").trim();

    let enabled = true;
    let severity: RuleInstancePackRow["severity"] = "HARD";
    let overrideClass: RuleInstancePackRow["overrideClass"] = "NEVER";
    let params: Record<string, unknown> = {};

    const paramsStart = lines.findIndex((line) => line.trim() === "params:");
    const metaLines = paramsStart >= 0 ? lines.slice(1, paramsStart) : lines.slice(1);
    const paramsLines = paramsStart >= 0 ? lines.slice(paramsStart + 1) : [];

    for (const line of metaLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("enabled:")) {
        enabled = parseYamlScalar(trimmed.replace("enabled:", "").trim()) === true;
      }
      if (trimmed.startsWith("severity:")) {
        const value = trimmed.replace("severity:", "").trim();
        if (value === "HARD" || value === "SOFT") {
          severity = value;
        }
      }
      if (trimmed.startsWith("override_class:")) {
        const value = trimmed.replace("override_class:", "").trim();
        if (value === "NEVER" || value === "APPROVER_REQUIRED" || value === "SCHEDULER_ALLOWED") {
          overrideClass = value;
        }
      }
    }

    if (paramsLines.length > 0) {
      params = parseParamsBlock(paramsLines);
    }

    return {
      ruleTemplateId,
      enabled,
      severity,
      overrideClass,
      params,
    };
  });
}

/** แปลง scheduling_policy.yaml แบบ key-value */
export function parseSchedulingPolicyYaml(
  content: string,
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf(":");
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    result[key] = parseYamlScalar(value);
  }

  return result;
}

/** แปลง organization.yaml แบบ key-value */
export function parseOrganizationYaml(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf(":");
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    result[key] = value;
  }

  return result;
}

/** แปลง manifest.yaml แบบ key-value ระดับ pack list */
export function parseManifestYaml(content: string): Record<string, unknown> {
  const lines = content.split(/\r?\n/);
  const root: Record<string, unknown> = {};
  const packs: Record<string, unknown>[] = [];
  let currentPack: Record<string, unknown> | null = null;
  let currentListKey: string | null = null;
  let inPacksSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    if (trimmed === "packs:") {
      inPacksSection = true;
      currentPack = null;
      currentListKey = null;
      continue;
    }

    if (inPacksSection && trimmed.startsWith("- id:")) {
      currentPack = { id: trimmed.replace("- id:", "").trim() };
      packs.push(currentPack);
      currentListKey = null;
      continue;
    }

    if (!inPacksSection && trimmed.includes(":")) {
      const separator = trimmed.indexOf(":");
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      root[key] = parseYamlScalar(value);
      continue;
    }

    if (inPacksSection && currentPack && trimmed.startsWith("- ") && currentListKey) {
      const list = (currentPack[currentListKey] as string[]) ?? [];
      list.push(trimmed.replace("- ", "").trim());
      currentPack[currentListKey] = list;
      continue;
    }

    if (inPacksSection && currentPack && trimmed.includes(":")) {
      const separator = trimmed.indexOf(":");
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();

      if (value === "") {
        currentListKey = key;
        currentPack[key] = [];
        continue;
      }

      currentListKey = null;
      currentPack[key] =
        value === "true" ? true : value === "false" ? false : parseYamlScalar(value);
    }
  }

  root.packs = packs;
  return root;
}
