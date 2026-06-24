import { describe, it, expect } from "vitest";
import { ClinicalCaseConfigSchema } from "./schema.js";
import starter from "./starter.js";

describe("clinical-case starter", () => {
  it("parses against the schema", () => {
    const result = ClinicalCaseConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });

  // The Studio form materializes optional arrays as `[]`, so a freshly
  // reset/loaded deck arrives with quiz.scoreMessages = []. That must NOT trip
  // the length refinement (regression: it surfaced "must have N+1 entries" on
  // reset). An empty array means "none set", same as omitting the field.
  it("treats an empty scoreMessages array as unset (no error on reset)", () => {
    const withEmpty = structuredClone(starter) as typeof starter & {
      quiz: { scoreMessages?: string[] };
    };
    withEmpty.quiz.scoreMessages = [];
    expect(ClinicalCaseConfigSchema.safeParse(withEmpty).success).toBe(true);
  });

  // A partial array (fewer than questions.length + 1, but non-empty) silently
  // drops messages for the top scores — still rejected at author time.
  it("rejects a partial (non-empty, wrong-length) scoreMessages array", () => {
    const partial = structuredClone(starter) as typeof starter & {
      quiz: { questions: unknown[]; scoreMessages?: string[] };
    };
    // 1 question → needs 2 entries; give 1 → invalid.
    partial.quiz.scoreMessages = ["only one"];
    expect(ClinicalCaseConfigSchema.safeParse(partial).success).toBe(false);
  });
});
