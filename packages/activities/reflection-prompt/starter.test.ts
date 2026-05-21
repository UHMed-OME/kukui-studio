import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { ReflectionPromptConfigSchema } from "./schema.js";

describe("reflection-prompt starter", () => {
  it("validates against the schema", () => {
    const result = ReflectionPromptConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
