import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { DDxTreeConfigSchema } from "./schema.js";

describe("ddx-tree starter", () => {
  it("validates against the schema", () => {
    const result = DDxTreeConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});

describe("ddx-tree authoring-friendliness", () => {
  // RJSF in Studio auto-populates optional sub-objects with default values when
  // a user toggles them on. For Diagnosis, that means name:"" instead of name
  // being absent — which would fail strict min(1). The schema's preprocess on
  // `name` rewrites the empty string into the "New diagnosis" placeholder so
  // the form validates immediately and the author can rename without seeing
  // the "must NOT have fewer than 1 characters" error pause the Preview.
  it("treats an empty diagnosis.name as the 'New diagnosis' placeholder", () => {
    const draft = {
      version: "1.0",
      title: "Draft in progress",
      caseHeader: "Patient presents...",
      startNodeId: "n1",
      nodes: [
        {
          id: "n1",
          presentation: "What next?",
          choices: null,
          diagnosis: { name: "", correct: false, score: 0 },
        },
      ],
    };
    const result = DDxTreeConfigSchema.safeParse(draft);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nodes[0]?.diagnosis?.name).toBe("New diagnosis");
    }
  });

  // The other Diagnosis fields default to safe placeholders too, so a
  // freshly-added terminal node validates without any author intervention.
  it("fills in correct/score defaults when a diagnosis is added with no values", () => {
    const draft = {
      version: "1.0",
      title: "Draft",
      caseHeader: "Patient.",
      startNodeId: "n1",
      nodes: [
        {
          id: "n1",
          presentation: "Step.",
          choices: null,
          diagnosis: { name: "Something" },
        },
      ],
    };
    const result = DDxTreeConfigSchema.safeParse(draft);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nodes[0]?.diagnosis?.correct).toBe(false);
      expect(result.data.nodes[0]?.diagnosis?.score).toBe(0);
    }
  });
});
