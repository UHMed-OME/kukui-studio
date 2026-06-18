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
});
