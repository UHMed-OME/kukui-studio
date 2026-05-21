import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { DragAndDropConfigSchema } from "./schema.js";

describe("drag-and-drop starter", () => {
  it("validates against the schema", () => {
    const result = DragAndDropConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed validation:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
