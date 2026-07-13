import { it, expect } from "vitest";
import { MultipleChoiceConfigSchema, FillInTheBlanksConfigSchema, ReflectionPromptConfigSchema } from "@kukui/schemas";
import { seedMcConfig, seedFitbConfig, seedReflectionConfig } from "./checkpointSeeds.js";
/**
 * The shared checkpoint seeds must stay schema-valid: an invalid embedded
 * config silently degrades to an inert marker at runtime, so a drifted seed
 * would break every newly added checkpoint.
 */
it("checkpoint seeds validate against their activity schemas", () => {
  expect(MultipleChoiceConfigSchema.safeParse(seedMcConfig()).success).toBe(true);
  const f = FillInTheBlanksConfigSchema.safeParse(seedFitbConfig());
  if (!f.success) console.log("FITB", JSON.stringify(f.error.issues));
  expect(f.success).toBe(true);
  const r = ReflectionPromptConfigSchema.safeParse(seedReflectionConfig());
  if (!r.success) console.log("REFL", JSON.stringify(r.error.issues));
  expect(r.success).toBe(true);
});
