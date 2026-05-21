import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { OSCEConfigSchema } from "./schema.js";

describe("osce starter", () => {
  it("validates against the schema", () => {
    const result = OSCEConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
