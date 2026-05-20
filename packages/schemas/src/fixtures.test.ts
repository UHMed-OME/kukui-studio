import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SchemaRegistry, type SchemaRegistryKey } from "./index.js";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../../..");
const ACTIVITIES_ROOT = join(REPO_ROOT, "packages", "activities");
const LEGACY_SAMPLES_ROOT = join(REPO_ROOT, "apps", "engine-web", "public", "samples");

/**
 * For each kind in SchemaRegistry, find its samples directory — either the
 * new co-located location (packages/activities/<slug>/samples/) or the
 * legacy mirror (apps/engine-web/public/samples/<slug>/). Returns null if
 * neither exists (the kind has no fixtures yet — common during the
 * 25-activity migration).
 */
async function findSamplesDir(kind: string): Promise<string | null> {
  const newDir = join(ACTIVITIES_ROOT, kind, "samples");
  if (existsSync(newDir)) return newDir;
  const oldDir = join(LEGACY_SAMPLES_ROOT, kind);
  if (existsSync(oldDir)) return oldDir;
  return null;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

describe("Sample fixtures validate against the schema registry", () => {
  const kinds = Object.keys(SchemaRegistry) as SchemaRegistryKey[];

  for (const kind of kinds) {
    describe(kind, () => {
      it("basic.json parses if present", async () => {
        const dir = await findSamplesDir(kind);
        if (!dir) return;
        const path = join(dir, "basic.json");
        if (!existsSync(path)) return;
        const result = SchemaRegistry[kind].safeParse(await readJson(path));
        if (!result.success) {
          console.error(
            `${kind}/basic.json failed:`,
            JSON.stringify(result.error.issues, null, 2),
          );
        }
        expect(result.success).toBe(true);
      });

      it("full.json parses if present", async () => {
        const dir = await findSamplesDir(kind);
        if (!dir) return;
        const path = join(dir, "full.json");
        if (!existsSync(path)) return;
        const result = SchemaRegistry[kind].safeParse(await readJson(path));
        if (!result.success) {
          console.error(
            `${kind}/full.json failed:`,
            JSON.stringify(result.error.issues, null, 2),
          );
        }
        expect(result.success).toBe(true);
      });

      it("_invalid/ fixtures all fail to validate", async () => {
        const dir = await findSamplesDir(kind);
        if (!dir) return;
        const invalidDir = join(dir, "_invalid");
        if (!existsSync(invalidDir)) return;
        const names = (await readdir(invalidDir)).filter((n) => n.endsWith(".json"));
        for (const name of names) {
          const result = SchemaRegistry[kind].safeParse(
            await readJson(join(invalidDir, name)),
          );
          expect(result.success, `${kind}/_invalid/${name} should NOT parse`).toBe(
            false,
          );
        }
      });
    });
  }
});
