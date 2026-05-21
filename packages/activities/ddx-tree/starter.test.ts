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
