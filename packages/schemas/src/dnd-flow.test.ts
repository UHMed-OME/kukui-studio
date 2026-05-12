import { describe, expect, it } from "vitest";
import { DragAndDropConfigSchema } from "./drag-and-drop.js";
import { migrateToScoring, syncLegacyFields } from "./migrate.js";
import type { Scoring } from "./scoring.js";

const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg'></svg>");

const starter = {
  version: "1.0",
  title: "Drag and Drop",
  background: { src: PLACEHOLDER, alt: "x" },
  draggables: [{ id: "d1", label: "Label A", correctZones: ["z1"] }],
  dropZones: [{ id: "z1", label: "Zone 1", rect: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 } }],
  behaviour: { enableRetry: true },
};

describe("DnD end-to-end flow", () => {
  it("starter alone validates", () => {
    const r = DragAndDropConfigSchema.safeParse(starter);
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
  });

  it("after migrator (load path) validates", () => {
    const migrated = migrateToScoring(starter, "drag-and-drop");
    const r = DragAndDropConfigSchema.safeParse(migrated);
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
  });

  it("after Scoring tab opens (defaultScoring with passPercentage=50) validates", () => {
    // What the Scoring tab does on first edit: takes the current value,
    // sets scoring + dual-writes legacy fields via syncLegacyFields.
    const migrated = migrateToScoring(starter, "drag-and-drop") as Record<string, unknown>;
    const newScoring: Scoring = {
      mode: "points",
      passPercentage: 50,
      enableRetry: true,
    };
    const updated = syncLegacyFields({ ...migrated, scoring: newScoring }, newScoring);
    const r = DragAndDropConfigSchema.safeParse(updated);
    if (!r.success) console.log("Scoring tab interaction FAIL:", JSON.stringify(r.error.issues, null, 2));
    expect(r.success).toBe(true);
  });
});
