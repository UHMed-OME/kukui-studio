import { describe, it, expect } from "vitest";
import {
  ACTIVITY_MANIFESTS,
  BUILT_ACTIVITY_KINDS,
  getManifest,
} from "./index.js";

describe("@kukui/activities registry", () => {
  it("exports an ACTIVITY_MANIFESTS map", () => {
    expect(ACTIVITY_MANIFESTS).toBeTypeOf("object");
  });

  it("BUILT_ACTIVITY_KINDS is derived from manifest keys", () => {
    expect(BUILT_ACTIVITY_KINDS).toEqual(Object.keys(ACTIVITY_MANIFESTS).sort());
  });

  it("getManifest returns undefined for unknown kinds", () => {
    expect(getManifest("nonexistent-kind" as never)).toBeUndefined();
  });
});
