import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { VirtualTourConfigSchema } from "./schema.js";

describe("virtual-tour starter", () => {
  it("validates against the schema", () => {
    const result = VirtualTourConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
