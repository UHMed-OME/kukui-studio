import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { QuestionSetConfigSchema } from "./schema.js";

describe("question-set starter", () => {
  it("validates against the schema", () => {
    const result = QuestionSetConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
