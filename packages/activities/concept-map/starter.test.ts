import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { ConceptMapConfigSchema } from "./schema.js";

describe("concept-map starter", () => {
  it("validates against the schema", () => {
    const result = ConceptMapConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
