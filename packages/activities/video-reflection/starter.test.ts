import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { VideoReflectionConfigSchema } from "./schema.js";

describe("video-reflection starter", () => {
  it("validates against the schema", () => {
    const result = VideoReflectionConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
