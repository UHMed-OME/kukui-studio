import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { AnatomyLabelingConfigSchema } from "./schema.js";

describe("anatomy-labeling starter", () => {
  it("validates against the schema", () => {
    const result = AnatomyLabelingConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
