import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { Hotspot3DConfigSchema } from "./schema.js";

describe("hotspot-3d starter", () => {
  it("validates against the schema", () => {
    const result = Hotspot3DConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
