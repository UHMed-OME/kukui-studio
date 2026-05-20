import { describe, it, expect } from "vitest";
import { activity } from "./manifest.js";

describe("multiple-choice manifest", () => {
  it("has kind 'multiple-choice'", () => {
    expect(activity.kind).toBe("multiple-choice");
  });

  it("starter validates against the schema", () => {
    const result = activity.schema.safeParse(activity.starter);
    expect(result.success).toBe(true);
  });

  it("appears in @kukui/activities ACTIVITY_MANIFESTS", async () => {
    const { ACTIVITY_MANIFESTS } = await import("../src/index.js");
    expect(ACTIVITY_MANIFESTS["multiple-choice"]).toBe(activity);
  });
});
