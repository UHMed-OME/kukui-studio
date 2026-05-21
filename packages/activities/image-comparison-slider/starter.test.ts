import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { ImageComparisonSliderConfigSchema } from "./schema.js";

describe("image-comparison-slider starter", () => {
  it("validates against the schema", () => {
    const result = ImageComparisonSliderConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
