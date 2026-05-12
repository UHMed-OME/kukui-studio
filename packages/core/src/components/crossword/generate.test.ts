import { describe, expect, it } from "vitest";
import { answerGrid, generateLayout } from "./generate.js";

const SAMPLE = [
  { id: "1", term: "CARDIAC" },
  { id: "2", term: "ARTERY" },
  { id: "3", term: "VEIN" },
  { id: "4", term: "AORTA" },
  { id: "5", term: "VALVE" },
];

describe("generateLayout", () => {
  it("returns one placement per entry and a non-empty bounding box", () => {
    const layout = generateLayout(SAMPLE, 42);
    expect(layout.placements).toHaveLength(SAMPLE.length);
    expect(layout.rows).toBeGreaterThan(0);
    expect(layout.cols).toBeGreaterThan(0);
  });

  it("places the longest term first and at coordinate origin (after normalisation)", () => {
    const layout = generateLayout(SAMPLE, 42);
    // Longest is "CARDIAC" (7) — should be the first placement.
    expect(layout.placements[0]?.term).toBe("CARDIAC");
    // After normalisation at least one placement touches row 0 and col 0.
    expect(layout.placements.some((p) => p.row === 0)).toBe(true);
    expect(layout.placements.some((p) => p.col === 0)).toBe(true);
  });

  it("is deterministic for a given seed", () => {
    const a = generateLayout(SAMPLE, 7);
    const b = generateLayout(SAMPLE, 7);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it("varies output across different seeds", () => {
    // Use seeds far apart so we don't accidentally hit the same shuffle
    // sequence for a small word list.
    const a = generateLayout(SAMPLE, 1);
    const b = generateLayout(SAMPLE, 9999);
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });

  it("produces a grid where placed letters never disagree at intersections", () => {
    const layout = generateLayout(SAMPLE, 5);
    const grid = answerGrid(layout);
    for (const p of layout.placements) {
      for (let i = 0; i < p.term.length; i += 1) {
        const r = p.direction === "across" ? p.row : p.row + i;
        const c = p.direction === "across" ? p.col + i : p.col;
        expect(grid[r]?.[c]).toBe(p.term[i]);
      }
    }
  });

  it("assigns sequential clue numbers in row-major order", () => {
    const layout = generateLayout(SAMPLE, 3);
    // Crossword numbering rule: each *starting cell* gets one number,
    // shared by the across + down placements that begin there. So the
    // distinct numbers should form 1..N with no gaps, where N is the
    // count of unique starting cells, and the sequence in row-major
    // order of those cells should be 1, 2, 3, ... .
    const byCell = new Map<string, number>();
    for (const p of layout.placements) {
      if (p.number > 0) byCell.set(`${p.row},${p.col}`, p.number);
    }
    const sortedCells = [...byCell.entries()].sort(([a], [b]) => {
      const [ar, ac] = a.split(",").map(Number) as [number, number];
      const [br, bc] = b.split(",").map(Number) as [number, number];
      return ar - br || ac - bc;
    });
    const expected = sortedCells.map((_, i) => i + 1);
    expect(sortedCells.map(([, n]) => n)).toEqual(expected);
  });

  it("falls back to isolated placement when no intersection works", () => {
    // Two terms with no letters in common — the second can't intersect.
    const layout = generateLayout(
      [
        { id: "1", term: "ABCD" },
        { id: "2", term: "WXYZ" },
      ],
      42,
    );
    expect(layout.placements).toHaveLength(2);
    expect(layout.unplaced).toContain("2");
  });

  it("returns an empty layout when given no entries", () => {
    const layout = generateLayout([], 0);
    expect(layout).toEqual({ rows: 0, cols: 0, placements: [], unplaced: [] });
  });
});
