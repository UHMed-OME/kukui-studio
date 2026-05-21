import { describe, it } from "vitest";
import { answerGrid, generateLayout } from "./generate.js";

const STARTER = [
  { id: "e1", term: "AORTA" },
  { id: "e2", term: "ARTERY" },
  { id: "e3", term: "VEIN" },
  { id: "e4", term: "VALVE" },
  { id: "e5", term: "ATRIUM" },
];

/**
 * Regression guard: every layout `generateLayout` returns must be
 * internally consistent — for every placement, the cells on its path
 * in the answer grid must hold exactly that placement's letters. If a
 * future tweak to `attemptLayout` produces a layout where two
 * placements disagree on an intersection cell, the runtime grid will
 * silently accept one term and reject the other; the puzzle will look
 * fine but be unsolvable. The test below covers 500 random seeds
 * across the starter's term list so any such regression fails CI
 * before it ships.
 */
describe("crossword layout invariants", () => {
  it("never produces conflicting letters at intersections (starter, many seeds)", () => {
    const seeds: number[] = [];
    let r = 1;
    for (let i = 0; i < 500; i += 1) {
      r = (r * 1103515245 + 12345) & 0x7fffffff;
      seeds.push(r);
    }
    for (const seed of seeds) {
      const layout = generateLayout(STARTER, seed);
      const grid = answerGrid(layout);
      for (const p of layout.placements) {
        for (let i = 0; i < p.term.length; i += 1) {
          const r = p.direction === "across" ? p.row : p.row + i;
          const c = p.direction === "across" ? p.col + i : p.col;
          const expected = p.term[i];
          const actual = grid[r]?.[c];
          if (actual !== expected) {
            throw new Error(
              `seed=${seed}: placement ${p.id} "${p.term}" ${p.direction} ` +
                `at (${p.row},${p.col}) — index ${i} expected '${expected}' ` +
                `but answer grid has '${actual}' at (${r},${c})`,
            );
          }
        }
      }
      const expectedByCell = new Map<string, string>();
      for (const p of layout.placements) {
        for (let i = 0; i < p.term.length; i += 1) {
          const r = p.direction === "across" ? p.row : p.row + i;
          const c = p.direction === "across" ? p.col + i : p.col;
          const k = `${r},${c}`;
          const prev = expectedByCell.get(k);
          if (prev !== undefined && prev !== p.term[i]) {
            throw new Error(
              `seed=${seed}: cell (${r},${c}) has conflicting letters: ` +
                `'${prev}' vs '${p.term[i]}' (from ${p.id})`,
            );
          }
          expectedByCell.set(k, p.term[i] as string);
        }
      }
    }
  });
});
