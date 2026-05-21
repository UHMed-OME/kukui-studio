import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { CrosswordConfigSchema } from "./schema.js";

describe("crossword starter", () => {
  it("validates against the schema", () => {
    const result = CrosswordConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
