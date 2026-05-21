import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { IsometricChatroomConfigSchema } from "./schema.js";

describe("isometric-chatroom starter", () => {
  it("validates against the schema", () => {
    const result = IsometricChatroomConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
