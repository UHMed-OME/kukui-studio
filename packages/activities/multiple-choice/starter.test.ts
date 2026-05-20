import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { MultipleChoiceConfigSchema } from "./schema.js";

describe("multiple-choice starter", () => {
  it("validates against the schema", () => {
    const result = MultipleChoiceConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed validation:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
