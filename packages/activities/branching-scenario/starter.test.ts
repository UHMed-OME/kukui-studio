import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { BranchingScenarioConfigSchema } from "./schema.js";

describe("branching-scenario starter", () => {
  it("validates against the schema", () => {
    const result = BranchingScenarioConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
