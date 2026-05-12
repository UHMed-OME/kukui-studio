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

  it("behaviour.singlePoint=true → all-or-nothing (legacy fields stripped)", () => {
    const input = {
      title: "x",
      behaviour: { singlePoint: true, enableRetry: true },
    };
    const out = migrateToScoring(input, "multiple-choice") as Record<string, unknown>;
    expect(out.scoring).toEqual({ mode: "all-or-nothing", enableRetry: true });
    // legacy fields cleaned up; runtimes read via resolveScoring()
    expect(out.behaviour).toBeUndefined();
  });

  it("promotes passPercentage + overallFeedback into scoring block, strips originals", () => {
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
    // root-level legacy fields removed — runtime reads scoring.passPercentage /
    // scoring.bands via resolveScoring().
    expect(out.passPercentage).toBeUndefined();
    expect(out.overallFeedback).toBeUndefined();
  });

  it("Question Set's root passPercentage is promoted into scoring block", () => {
    const input = {
      title: "Set",
      passPercentage: 75,
      behaviour: { randomQuestions: true },
    };
    const out = migrateToScoring(input, "question-set") as Record<string, unknown>;
    expect(out.scoring).toMatchObject({ mode: "points", passPercentage: 75 });
    // unrelated behaviour fields stay where they are
    expect((out.behaviour as Record<string, unknown>).randomQuestions).toBe(true);
    expect(out.passPercentage).toBeUndefined();
  });

  it("Flashcards default to completion mode", () => {
    const input = { title: "Cards", behaviour: { shuffle: true, enableRetry: true } };
    const out = migrateToScoring(input, "flashcards") as Record<string, unknown>;
    expect(out.scoring).toEqual({ mode: "completion", enableRetry: true });
    // shuffle is playback-level (not a scoring field) so it stays in behaviour
    expect((out.behaviour as Record<string, unknown>).shuffle).toBe(true);
    expect((out.behaviour as Record<string, unknown>).enableRetry).toBeUndefined();
  });

  it("Hotspot 2D defaults to all-or-nothing", () => {
    const input = { title: "H", behaviour: {} };
    const out = migrateToScoring(input, "hotspot-2d") as Record<string, unknown>;
    expect(out.scoring).toEqual({ mode: "all-or-nothing" });
    // legacy singlePoint is no longer written; runtime reads from scoring.mode
    expect(out.behaviour).toBeUndefined();
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
    // legacy keys cleared
    expect(out.behaviour).toBeUndefined();
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
