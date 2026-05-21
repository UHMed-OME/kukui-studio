import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { QuickQuizConfigSchema } from "./schema.js";

describe("quick-quiz starter", () => {
  it("validates against the schema", () => {
    const result = QuickQuizConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
