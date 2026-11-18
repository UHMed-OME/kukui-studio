import { describe, it, expect } from "vitest";
import { activity } from "./manifest.js";

describe("evidence-weighing manifest", () => {
  it("has kind 'evidence-weighing'", () => {
    expect(activity.kind).toBe("evidence-weighing");
  });

  it("starter validates against the schema", () => {
    const result = activity.schema.safeParse(activity.starter);
    expect(result.success).toBe(true);
  });

  it("appears in @kukui/activities ACTIVITY_MANIFESTS", async () => {
    const { ACTIVITY_MANIFESTS } = await import("../src/index.js");
    expect(ACTIVITY_MANIFESTS["evidence-weighing"]).toBe(activity);
  }, 15000);
});
