import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { ActivityKind } from "@kukui/core";
import { ActivityIcon, hasActivityIcon } from "./activityIcons.js";

/**
 * Every activity Studio surfaces in the sidebar should have its own icon.
 * If you add a kind to BLOOM_BY_KIND in App.tsx, add it here too — and add
 * the icon in activityIcons.tsx. The test fails loudly otherwise.
 */
const STUDIO_SURFACED: readonly ActivityKind[] = [
  "flashcards",
  "matching-pairs",
  "hotspot-2d",
  "anatomy-labeling",
  "highlight-text",
  "drag-and-drop",
  "sequence-steps",
  "categorization",
  "hotspot-3d",
  "virtual-tour",
  "interactive-video",
  "image-annotation",
  "image-comparison-slider",
  "concept-map",
  "lab-panel",
  "branching-scenario",
  "ddx-tree",
  "reflection-prompt",
  "osce",
  "audio-recording",
];

describe("activityIcons", () => {
  it.each(STUDIO_SURFACED)("%s has a registered icon", (kind) => {
    expect(hasActivityIcon(kind)).toBe(true);
  });

  it.each(STUDIO_SURFACED)("%s renders an <svg> element", (kind) => {
    const { container } = render(<ActivityIcon kind={kind} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
  });

  it("renders a placeholder span when the kind has no icon", () => {
    // Cast through unknown to simulate a future ActivityKind we haven't
    // mapped yet — the dispatcher must keep the sidebar's flex layout
    // stable rather than collapse to a missing flex item.
    const fakeKind = "future-activity" as unknown as ActivityKind;
    const { container } = render(<ActivityIcon kind={fakeKind} />);
    expect(container.querySelector("svg")).toBeNull();
    const placeholder = container.querySelector("span");
    expect(placeholder).not.toBeNull();
    expect(placeholder?.getAttribute("aria-hidden")).toBe("true");
  });
});
