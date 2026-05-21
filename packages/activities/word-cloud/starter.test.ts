import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { WordCloudConfigSchema } from "./schema.js";

describe("word-cloud starter", () => {
  it("validates against the schema", () => {
    const result = WordCloudConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
