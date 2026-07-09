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

describe("question-set schema", () => {
  it("rejects a set whose total question weight is 0", () => {
    const result = QuestionSetConfigSchema.safeParse({
      version: "1.0",
      title: "All zero weights",
      questions: [
        {
          type: "multipleChoice",
          config: { version: "1.0", title: "Q", question: "<p>?</p>", answers: [] },
          weight: 0,
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "questions")).toBe(true);
    }
  });
});
