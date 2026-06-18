import { describe, it, expect } from "vitest";
import { CoursePresentationConfigSchema } from "./schema.js";
import starter from "./starter.js";

describe("course-presentation starter", () => {
  it("parses against the schema", () => {
    const result = CoursePresentationConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
