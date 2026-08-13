import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseManifestYaml } from "./parse-yaml";
import { manifestSchema } from "./schemas";
import type { StarterPackManifest, StarterPackManifestEntry } from "./types";

/** คืน root directory ของ starter packs */
export function getStarterPacksRoot(baseDir = process.cwd()): string {
  return join(baseDir, "demo/starter-packs");
}

/** โหลด manifest ระดับ repo */
export function loadStarterPackManifest(baseDir = process.cwd()): StarterPackManifest {
  const manifestPath = join(getStarterPacksRoot(baseDir), "manifest.yaml");
  const raw = parseManifestYaml(readFileSync(manifestPath, "utf8"));
  const parsed = manifestSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error(
      `manifest.yaml ไม่ถูกต้อง: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`,
    );
  }

  return {
    version: parsed.data.version,
    packs: parsed.data.packs.map(
      (entry): StarterPackManifestEntry => ({
        id: entry.id,
        slug: entry.slug,
        path: entry.path,
        displayNameTh: entry.display_name_th,
        displayNameEn: entry.display_name_en,
        complexity: entry.complexity,
        aliases: entry.aliases,
        disclaimer: entry.disclaimer,
        requiresReview: entry.requires_review,
        patternReference: entry.pattern_reference,
        applyOrder: entry.apply_order,
      }),
    ),
  };
}

/** ค้นหา pack entry จาก id หรือ alias */
export function findStarterPackEntry(
  manifest: StarterPackManifest,
  packIdOrAlias: string,
): StarterPackManifestEntry | undefined {
  return manifest.packs.find(
    (pack) => pack.id === packIdOrAlias || pack.aliases.includes(packIdOrAlias),
  );
}

/** คืน absolute path ของ pack directory */
export function resolveStarterPackDirectory(
  packEntry: StarterPackManifestEntry,
  baseDir = process.cwd(),
): string {
  return join(getStarterPacksRoot(baseDir), packEntry.path);
}
