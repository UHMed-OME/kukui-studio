import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { ConfidenceMeterConfigSchema } from "./schema.js";

describe("confidence-meter starter", () => {
  it("validates against the schema", () => {
    const result = ConfidenceMeterConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
