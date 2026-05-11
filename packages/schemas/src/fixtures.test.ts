import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SchemaRegistry, type SchemaRegistryKey } from "./index.js";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../../..");
const SAMPLES_ROOT = join(REPO_ROOT, "apps", "engine-web", "public", "samples");

const ACTIVITIES: SchemaRegistryKey[] = [
  "multiple-choice",
  "fill-in-the-blanks",
  "drag-and-drop",
  "question-set",
  "hotspot-3d",
  "hotspot-2d",
  "virtual-tour",
];

async function readFixture(activity: string, name: string): Promise<unknown> {
  const path = join(SAMPLES_ROOT, activity, name);
  const text = await readFile(path, "utf8");
  return JSON.parse(text);
}

describe("Sample fixtures validate against the schema registry", () => {
  for (const activity of ACTIVITIES) {
    describe(activity, () => {
      it("has at least basic.json that parses", async () => {
        const json = await readFixture(activity, "basic.json");
        const result = SchemaRegistry[activity].safeParse(json);
        if (!result.success) {
          console.error(
            `${activity}/basic.json failed:`,
            JSON.stringify(result.error.issues, null, 2),
          );
        }
        expect(result.success).toBe(true);
      });

      it("full.json parses if present", async () => {
        let json: unknown;
        try {
          json = await readFixture(activity, "full.json");
        } catch {
          return; // full.json optional for some activities
        }
        const result = SchemaRegistry[activity].safeParse(json);
        if (!result.success) {
          console.error(
            `${activity}/full.json failed:`,
            JSON.stringify(result.error.issues, null, 2),
          );
        }
        expect(result.success).toBe(true);
      });

      it("_invalid/ fixtures all fail to validate", async () => {
        let invalidNames: string[] = [];
        try {
          invalidNames = await readdir(join(SAMPLES_ROOT, activity, "_invalid"));
        } catch {
          return; // no _invalid/ dir
        }
        for (const name of invalidNames.filter((n) => n.endsWith(".json"))) {
          const json = await readFixture(activity, join("_invalid", name));
          const result = SchemaRegistry[activity].safeParse(json);
          expect(result.success, `${activity}/_invalid/${name} should NOT parse`).toBe(false);
        }
      });
    });
  }
});
