import { describe, expect, it } from "vitest";
import { ACTIVITY_MANIFESTS } from "@kukui/activities";
import { LIVE_ACTIVITY_REGISTRY } from "./index.js";

describe("Live activity registry", () => {
  it("every manifest with live=true has a matching Live wrapper", () => {
    const liveKinds = Object.values(ACTIVITY_MANIFESTS)
      .filter((m) => m.live)
      .map((m) => m.kind)
      .sort();
    const registeredKinds = Object.keys(LIVE_ACTIVITY_REGISTRY).sort();
    expect(registeredKinds).toEqual(liveKinds);
  });

  it("every Live wrapper has a manifest with live=true", () => {
    for (const kind of Object.keys(LIVE_ACTIVITY_REGISTRY)) {
      const manifest = ACTIVITY_MANIFESTS[kind];
      expect(manifest, `${kind} has Live wrapper but no manifest`).toBeDefined();
      expect(manifest!.live, `${kind} has Live wrapper but manifest.live is false`).toBe(true);
    }
  });
});
