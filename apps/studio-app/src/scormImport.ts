import JSZip from "jszip";
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

// Zip-bomb guards. The outer total is a coarse pre-filter based on the
// attacker-declared sizes in the zip's central directory; it's cheap but
// trusts the input. The inner per-config-entry limit measures the actual
// decompressed bytes and is the authoritative check.
const MAX_TOTAL_UNCOMPRESSED = 50 * 1024 * 1024; // 50 MB across all entries
const MAX_CONFIG_BYTES = 1 * 1024 * 1024; // 1 MB for the matched config file

async function importZip(file: File): Promise<ImportResult> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  // Coarse outer guard: sum *declared* uncompressed sizes from the central
  // directory. Attacker-controlled, so it's not load-bearing — just rejects
  // obviously huge claims before we touch any entry. The authoritative
  // check is the measured decompression of the matched config below.
  let totalDeclared = 0;
  for (const entry of Object.values(zip.files)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const size = (entry as any)._data?.uncompressedSize ?? 0;
    totalDeclared += typeof size === "number" ? size : 0;
    if (totalDeclared > MAX_TOTAL_UNCOMPRESSED) {
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

  const entry = zip.file(configPath)!;
  // Cheap pre-filter: if the declared uncompressed size is already over the
  // limit, don't bother decompressing. Authoritative check follows.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const declaredSize = (entry as any)._data?.uncompressedSize;
  if (typeof declaredSize === "number" && declaredSize > MAX_CONFIG_BYTES) {
    return {
      ok: false,
      error: "This activity config is unexpectedly large. SCORM configs should be well under 1 MB.",
    };
  }

  // Authoritative check: measure actual decompressed bytes. We only ever
  // call .async() on this single matched entry; never on any other file
  // in the zip (no media, no SCORM scaffolding).
  const bytes = await entry.async("uint8array");
  if (bytes.byteLength > MAX_CONFIG_BYTES) {
    return {
      ok: false,
      error: "This activity config is unexpectedly large. SCORM configs should be well under 1 MB.",
    };
  }
  const text = new TextDecoder("utf-8").decode(bytes);
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
