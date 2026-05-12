import { describe, expect, it } from "vitest";
import { migrateToScoring, migrateUnknown } from "./migrate.js";
import { ScoringSchema } from "./scoring.js";

describe("migrateToScoring", () => {
  it("leaves an already-migrated config alone", () => {
    const input = {
      title: "x",
      scoring: { mode: "points", passPercentage: 70 },
      behaviour: { randomAnswers: true },
    };
    const out = migrateToScoring(input, "multiple-choice");
    expect(out).toBe(input);
  });

  it("non-objects pass through", () => {
    expect(migrateToScoring(undefined)).toBeUndefined();
    expect(migrateToScoring(null)).toBeNull();
    expect(migrateToScoring(42)).toBe(42);
  });

  it("default → points mode with no extra fields", () => {
    const input = { title: "x", behaviour: {} };
    const out = migrateToScoring(input, "multiple-choice") as Record<string, unknown>;
    expect(out.scoring).toEqual({ mode: "points" });
  });

  it("behaviour.singlePoint=true → all-or-nothing (dual-written)", () => {
    const input = {
      title: "x",
      behaviour: { singlePoint: true, enableRetry: true },
    };
    const out = migrateToScoring(input, "multiple-choice") as Record<string, unknown>;
    expect(out.scoring).toEqual({ mode: "all-or-nothing", enableRetry: true });
    // dual-write keeps the legacy fields populated for unconverted runtimes
    expect((out.behaviour as Record<string, unknown>).singlePoint).toBe(true);
    expect((out.behaviour as Record<string, unknown>).enableRetry).toBe(true);
  });

  it("preserves passPercentage + overallFeedback when promoting to points", () => {
    const input = {
      title: "x",
      passPercentage: 80,
      overallFeedback: [
        { from: 0, to: 49, message: "Review." },
        { from: 50, to: 100, message: "Good." },
      ],
      behaviour: { singlePoint: false, enableRetry: true },
    };
    const out = migrateToScoring(input, "multiple-choice") as Record<string, unknown>;
    expect(out.scoring).toEqual({
      mode: "points",
      passPercentage: 80,
      bands: [
        { from: 0, to: 49, message: "Review." },
        { from: 50, to: 100, message: "Good." },
      ],
      enableRetry: true,
    });
    // dual-write: legacy fields still present
    expect(out.passPercentage).toBe(80);
    expect(out.overallFeedback).toEqual([
      { from: 0, to: 49, message: "Review." },
      { from: 50, to: 100, message: "Good." },
    ]);
  });

  it("Question Set's root passPercentage is promoted (dual-written)", () => {
    const input = {
      title: "Set",
      passPercentage: 75,
      behaviour: { randomQuestions: true },
    };
    const out = migrateToScoring(input, "question-set") as Record<string, unknown>;
    expect(out.scoring).toMatchObject({ mode: "points", passPercentage: 75 });
    expect((out.behaviour as Record<string, unknown>).randomQuestions).toBe(true);
    expect(out.passPercentage).toBe(75);
  });

  it("Flashcards default to completion mode", () => {
    const input = { title: "Cards", behaviour: { shuffle: true, enableRetry: true } };
    const out = migrateToScoring(input, "flashcards") as Record<string, unknown>;
    expect(out.scoring).toEqual({ mode: "completion", enableRetry: true });
    expect((out.behaviour as Record<string, unknown>).shuffle).toBe(true);
    // completion mode clears single-point flag at the legacy site too
    expect((out.behaviour as Record<string, unknown>).singlePoint).toBeUndefined();
  });

  it("Hotspot 2D defaults to all-or-nothing (dual-written)", () => {
    const input = { title: "H", behaviour: {} };
    const out = migrateToScoring(input, "hotspot-2d") as Record<string, unknown>;
    expect(out.scoring).toEqual({ mode: "all-or-nothing" });
    expect((out.behaviour as Record<string, unknown>).singlePoint).toBe(true);
  });

  it("Live activity kinds are skipped entirely", () => {
    const input = { title: "Poll", behaviour: { singlePoint: true } };
    const out = migrateToScoring(input, "straw-poll");
    expect(out).toBe(input);
  });

  it("legacy showSolutionsButton key is accepted as alias", () => {
    const input = { title: "x", behaviour: { showSolutionsButton: true } };
    const out = migrateToScoring(input, "fill-in-the-blanks") as Record<string, unknown>;
    expect(out.scoring).toEqual({ mode: "points", enableSolutionsButton: true });
    // dual-write mirrors back to both legacy keys
    expect((out.behaviour as Record<string, unknown>).showSolutionsButton).toBe(true);
    expect((out.behaviour as Record<string, unknown>).enableSolutionsButton).toBe(true);
  });

  it("output passes the discriminated-union schema", () => {
    const inputs = [
      { title: "x", behaviour: { singlePoint: true } },
      { title: "x", behaviour: {}, passPercentage: 70 },
      { title: "x" }, // flashcards
    ];
    const kinds = ["drag-and-drop", "multiple-choice", "flashcards"];
    for (let i = 0; i < inputs.length; i += 1) {
      const out = migrateToScoring(inputs[i], kinds[i]) as Record<string, unknown>;
      const parsed = ScoringSchema.safeParse(out.scoring);
      expect(parsed.success, JSON.stringify(parsed)).toBe(true);
    }
  });

  it("is idempotent on a second pass", () => {
    const input = { title: "x", behaviour: { singlePoint: true } };
    const once = migrateToScoring(input, "drag-and-drop");
    const twice = migrateToScoring(once, "drag-and-drop");
    expect(twice).toBe(once);
  });
});

describe("migrateUnknown — kind inference", () => {
  it("infers flashcards from a `cards` array", () => {
    const out = migrateUnknown({
      title: "Set",
      cards: [{ front: "a", back: "b" }],
      behaviour: { shuffle: true },
    }) as Record<string, unknown>;
    expect((out.scoring as { mode: string }).mode).toBe("completion");
  });

  it("infers drag-and-drop from draggables + dropZones", () => {
    const out = migrateUnknown({
      title: "DnD",
      draggables: [{}],
      dropZones: [{}],
      behaviour: { singlePoint: true },
    }) as Record<string, unknown>;
    expect((out.scoring as { mode: string }).mode).toBe("all-or-nothing");
  });

  it("falls back to points when no signal", () => {
    const out = migrateUnknown({ title: "Unknown" }) as Record<string, unknown>;
    expect((out.scoring as { mode: string }).mode).toBe("points");
  });
});
