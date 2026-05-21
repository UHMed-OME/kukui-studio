import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { CategorizationConfigSchema } from "./schema.js";

describe("categorization starter", () => {
  it("validates against the schema", () => {
    const result = CategorizationConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
