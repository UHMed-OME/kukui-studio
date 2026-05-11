import { SchemaRegistry, type SchemaRegistryKey } from "@kukui/schemas";
import type { ActivityKind } from "@kukui/core";

export type ImportResult =
  | { ok: true; kind: ActivityKind; config: unknown }
  | { ok: false; error: string };

/**
 * Read a JSON or SCORM-zip file and return the activity kind + config.
 *
 * - `.json` — parsed as a single activity config and matched against every
 *   registered Zod schema; first one that validates wins.
 * - `.zip` — unpacked, looking for the SCORM template's standard
 *   `samples/<kind>/basic.json` payload, then validated the same way.
 *
 * Activity kind is inferred from the config rather than the filename so
 * authors can rename files without breaking the import.
 */
export async function importFromFile(file: File): Promise<ImportResult> {
  const lowered = file.name.toLowerCase();
  try {
    if (lowered.endsWith(".zip")) return await importZip(file);
    if (lowered.endsWith(".json")) return await importJson(file);
    return { ok: false, error: "Pick a .json file or a SCORM .zip." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't read that file." };
  }
}

async function importJson(file: File): Promise<ImportResult> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  return detectKind(parsed);
}

async function importZip(file: File): Promise<ImportResult> {
  // JSZip (~25 KB gz) only matters when the author imports a zip — keep
  // it out of the Studio's main chunk by dynamic-importing here too.
  const { default: JSZip } = await import("jszip");
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  // Zip-bomb guard: sum decompressed sizes before extracting. A 1 KB zip
  // can decompress to gigabytes; if we just call .async("string") on the
  // contents we crash the tab. 50 MB total is plenty for a SCORM
  // activity payload.
  const MAX_TOTAL_UNCOMPRESSED = 50 * 1024 * 1024;
  let total = 0;
  for (const entry of Object.values(zip.files)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const size = (entry as any)._data?.uncompressedSize ?? 0;
    total += typeof size === "number" ? size : 0;
    if (total > MAX_TOTAL_UNCOMPRESSED) {
      return {
        ok: false,
        error: "This zip is unexpectedly large when uncompressed. It may be corrupt.",
      };
    }
  }

  const configPath = Object.keys(zip.files).find((p) =>
    /^samples\/[^/]+\/basic\.json$/i.test(p),
  );
  if (!configPath) {
    return { ok: false, error: "This zip doesn't contain a Kukui activity config." };
  }
  const text = await zip.file(configPath)!.async("string");
  const parsed = JSON.parse(text);
  return detectKind(parsed);
}

function detectKind(config: unknown): ImportResult {
  for (const [kind, schema] of Object.entries(SchemaRegistry) as [
    SchemaRegistryKey,
    (typeof SchemaRegistry)[SchemaRegistryKey],
  ][]) {
    const result = schema.safeParse(config);
    if (result.success) {
      return { ok: true, kind: kind as ActivityKind, config: result.data };
    }
  }
  return {
    ok: false,
    error: "This file doesn't match any known activity type. Check that the JSON is for a Kukui activity.",
  };
}
