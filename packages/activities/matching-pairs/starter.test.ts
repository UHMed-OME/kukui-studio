import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { MatchingPairsConfigSchema } from "./schema.js";

describe("matching-pairs starter", () => {
  it("validates against the schema", () => {
    const result = MatchingPairsConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
