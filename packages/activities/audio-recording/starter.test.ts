import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { AudioRecordingConfigSchema } from "./schema.js";

describe("audio-recording starter", () => {
  it("validates against the schema", () => {
    const result = AudioRecordingConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});
