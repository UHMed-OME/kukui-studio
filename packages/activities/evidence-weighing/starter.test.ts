import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { EvidenceWeighingConfigSchema } from "./schema.js";

describe("evidence-weighing starter", () => {
  it("validates against the schema", () => {
    const result = EvidenceWeighingConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed validation:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
