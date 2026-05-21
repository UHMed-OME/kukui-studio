import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { FillInTheBlanksConfigSchema } from "./schema.js";

describe("fill-in-the-blanks starter", () => {
  it("validates against the schema", () => {
    const result = FillInTheBlanksConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed validation:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
