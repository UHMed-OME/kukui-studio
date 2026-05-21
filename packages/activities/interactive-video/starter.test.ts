import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { InteractiveVideoConfigSchema } from "./schema.js";

describe("interactive-video starter", () => {
  it("validates against the schema", () => {
    const result = InteractiveVideoConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
