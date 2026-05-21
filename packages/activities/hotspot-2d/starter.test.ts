import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { Hotspot2DConfigSchema } from "./schema.js";

describe("hotspot-2d starter", () => {
  it("validates against the schema", () => {
    const result = Hotspot2DConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
