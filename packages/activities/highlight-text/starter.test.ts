import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { HighlightTextConfigSchema } from "./schema.js";

describe("highlight-text starter", () => {
  it("validates against the schema", () => {
    const result = HighlightTextConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
