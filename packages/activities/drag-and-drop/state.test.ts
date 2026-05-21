import { describe, expect, it } from "vitest";
import type { DragAndDropConfig } from "@kukui/schemas";
import {
  initial,
  reducer,
  isCorrect,
  solutionAssignment,
  parseSuspend,
  type State,
} from "./state.js";

const cfg: DragAndDropConfig = {
  version: "1.0",
  title: "Plant cell",
  draggables: [
    { id: "d-1", label: "Nucleus", correctZones: ["z-1"] },
    { id: "d-2", label: "Chloroplast", correctZones: ["z-2"] },
    { id: "d-3", label: "Mitochondrion", correctZones: ["z-1", "z-2"] },
  ],
  dropZones: [
    { id: "z-1", label: "Z1", rect: { x: 0, y: 0, w: 0.2, h: 0.2 } },
    { id: "z-2", label: "Z2", rect: { x: 0.3, y: 0, w: 0.2, h: 0.2 } },
  ],
};

const start = (): State => initial(cfg);

describe("dnd state — initial", () => {
  it("places every chip in the tray and starts in answering", () => {
    const s = start();
    expect(s.stage).toBe("answering");
    expect(s.attempts).toBe(0);
    expect(s.selectedChipId).toBeNull();
    expect(s.placement).toEqual({ "d-1": null, "d-2": null, "d-3": null });
  });
});

describe("dnd state — select / deselect", () => {
  it("select-chip records the selection", () => {
    const s = reducer(start(), { type: "select-chip", id: "d-1" }, cfg);
    expect(s.selectedChipId).toBe("d-1");
  });

  it("re-selecting the same chip toggles deselection", () => {
    let s = reducer(start(), { type: "select-chip", id: "d-1" }, cfg);
    s = reducer(s, { type: "select-chip", id: "d-1" }, cfg);
    expect(s.selectedChipId).toBeNull();
  });

  it("selecting another chip swaps selection", () => {
    let s = reducer(start(), { type: "select-chip", id: "d-1" }, cfg);
    s = reducer(s, { type: "select-chip", id: "d-2" }, cfg);
    expect(s.selectedChipId).toBe("d-2");
  });

  it("deselect clears selection", () => {
    let s = reducer(start(), { type: "select-chip", id: "d-1" }, cfg);
    s = reducer(s, { type: "deselect" }, cfg);
    expect(s.selectedChipId).toBeNull();
  });

  it("select-chip is a noop after submit", () => {
    let s = reducer(start(), { type: "place", chipId: "d-1", zoneId: "z-1" }, cfg);
    s = reducer(s, { type: "place", chipId: "d-2", zoneId: "z-2" }, cfg);
    s = reducer(s, { type: "place", chipId: "d-3", zoneId: "z-1" }, cfg);
    // d-3 placement should fail (capacity already 1 on z-1) — but let's submit anyway.
    s = reducer(s, { type: "submit" }, cfg);
    const after = reducer(s, { type: "select-chip", id: "d-1" }, cfg);
    expect(after.selectedChipId).toBeNull();
  });
});

describe("dnd state — place", () => {
  it("placement updates the map and clears selection", () => {
    let s = reducer(start(), { type: "select-chip", id: "d-1" }, cfg);
    s = reducer(s, { type: "place", chipId: "d-1", zoneId: "z-1" }, cfg);
    expect(s.placement["d-1"]).toBe("z-1");
    expect(s.selectedChipId).toBeNull();
  });

  it("placement to null lifts the chip back to tray", () => {
    let s = reducer(start(), { type: "place", chipId: "d-1", zoneId: "z-1" }, cfg);
    s = reducer(s, { type: "place", chipId: "d-1", zoneId: null }, cfg);
    expect(s.placement["d-1"]).toBeNull();
  });

  it("placement to an unknown chip is dropped", () => {
    const s = reducer(start(), { type: "place", chipId: "nope", zoneId: "z-1" }, cfg);
    expect(s).toEqual(start());
  });

  it("placement to an unknown zone is dropped", () => {
    const s = reducer(start(), { type: "place", chipId: "d-1", zoneId: "missing" }, cfg);
    expect(s.placement["d-1"]).toBeNull();
  });

  it("zone capacity (default 1) rejects a second chip", () => {
    let s = reducer(start(), { type: "place", chipId: "d-1", zoneId: "z-1" }, cfg);
    s = reducer(s, { type: "place", chipId: "d-3", zoneId: "z-1" }, cfg);
    expect(s.placement["d-3"]).toBeNull();
    expect(s.placement["d-1"]).toBe("z-1");
  });

  it("explicit capacity 2 allows two chips", () => {
    const cap2: DragAndDropConfig = {
      ...cfg,
      dropZones: [{ ...cfg.dropZones[0]!, capacity: 2 }, cfg.dropZones[1]!],
    };
    let s = reducer(initial(cap2), { type: "place", chipId: "d-1", zoneId: "z-1" }, cap2);
    s = reducer(s, { type: "place", chipId: "d-3", zoneId: "z-1" }, cap2);
    expect(s.placement["d-1"]).toBe("z-1");
    expect(s.placement["d-3"]).toBe("z-1");
  });

  it("place is a noop after submit", () => {
    let s = reducer(start(), { type: "place", chipId: "d-1", zoneId: "z-1" }, cfg);
    s = reducer(s, { type: "place", chipId: "d-2", zoneId: "z-2" }, cfg);
    s = reducer(s, { type: "place", chipId: "d-3", zoneId: "z-2" }, cfg);
    s = reducer(s, { type: "submit" }, cfg);
    const after = reducer(s, { type: "place", chipId: "d-1", zoneId: "z-2" }, cfg);
    expect(after.placement["d-1"]).toBe("z-1");
  });
});

describe("dnd state — submit / try-again", () => {
  it("submit moves to submitted and increments attempts", () => {
    const s = reducer(start(), { type: "submit" }, cfg);
    expect(s.stage).toBe("submitted");
    expect(s.attempts).toBe(1);
  });

  it("try-again resets to a fresh initial", () => {
    let s = reducer(start(), { type: "place", chipId: "d-1", zoneId: "z-1" }, cfg);
    s = reducer(s, { type: "submit" }, cfg);
    s = reducer(s, { type: "try-again", initial: initial(cfg) }, cfg);
    expect(s.stage).toBe("answering");
    expect(s.placement["d-1"]).toBeNull();
  });
});

describe("dnd state — show-solution", () => {
  it("only fires from submitted stage", () => {
    const s = reducer(
      start(),
      { type: "show-solution", assignment: { "d-1": "z-1" } },
      cfg,
    );
    expect(s.stage).toBe("answering");
  });

  it("places the assigned chips and locks to showing-solution stage", () => {
    let s = reducer(start(), { type: "submit" }, cfg);
    s = reducer(
      s,
      { type: "show-solution", assignment: { "d-1": "z-1", "d-2": "z-2", "d-3": "z-1" } },
      cfg,
    );
    expect(s.stage).toBe("showing-solution");
    expect(s.placement).toEqual({ "d-1": "z-1", "d-2": "z-2", "d-3": "z-1" });
  });
});

describe("isCorrect", () => {
  it("matches against the chip's correctZones", () => {
    expect(isCorrect("d-1", "z-1", cfg)).toBe(true);
    expect(isCorrect("d-1", "z-2", cfg)).toBe(false);
    expect(isCorrect("d-3", "z-1", cfg)).toBe(true);
    expect(isCorrect("d-3", "z-2", cfg)).toBe(true);
  });

  it("returns false when chip is in the tray", () => {
    expect(isCorrect("d-1", null, cfg)).toBe(false);
  });
});

describe("solutionAssignment", () => {
  it("assigns each chip to its first correct zone when capacity allows", () => {
    const a = solutionAssignment(cfg);
    expect(a["d-1"]).toBe("z-1");
    expect(a["d-2"]).toBe("z-2");
    // z-1 is full after d-1 (capacity 1), so d-3 should fall back to z-2.
    // But z-2 is also full after d-2 → d-3 gets dropped.
    expect(a["d-3"]).toBeUndefined();
  });

  it("respects capacity > 1", () => {
    const cap2: DragAndDropConfig = {
      ...cfg,
      dropZones: [{ ...cfg.dropZones[0]!, capacity: 2 }, cfg.dropZones[1]!],
    };
    const a = solutionAssignment(cap2);
    expect(a["d-1"]).toBe("z-1");
    expect(a["d-3"]).toBe("z-1");
  });
});

describe("parseSuspend", () => {
  it("returns null for undefined / invalid input", () => {
    expect(parseSuspend(undefined, cfg)).toBeNull();
    expect(parseSuspend("not json", cfg)).toBeNull();
    expect(parseSuspend(JSON.stringify({}), cfg)).toBeNull();
  });

  it("round-trips a state", () => {
    let s = reducer(start(), { type: "place", chipId: "d-1", zoneId: "z-1" }, cfg);
    s = reducer(s, { type: "submit" }, cfg);
    const parsed = parseSuspend(JSON.stringify(s), cfg);
    expect(parsed?.stage).toBe("submitted");
    expect(parsed?.placement["d-1"]).toBe("z-1");
    expect(parsed?.attempts).toBe(1);
  });

  it("drops placements for chips no longer in the config", () => {
    const stale = { stage: "answering", placement: { "d-1": "z-1", "deleted": "z-2" }, attempts: 0 };
    const parsed = parseSuspend(JSON.stringify(stale), cfg);
    expect(parsed?.placement).not.toHaveProperty("deleted");
    expect(parsed?.placement["d-1"]).toBe("z-1");
  });
});
