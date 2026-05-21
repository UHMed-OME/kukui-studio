import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { QABoardConfigSchema } from "./schema.js";

describe("qa-board starter", () => {
  it("validates against the schema", () => {
    const result = QABoardConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
