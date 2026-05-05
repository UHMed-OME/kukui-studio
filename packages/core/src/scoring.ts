import type { ScoreBand, ScoreState } from "./types.js";

/**
 * Multiple Choice / Multiple Select scoring.
 *
 * `singlePoint`: all-or-nothing. Awards 1 point iff the learner's selection set
 * exactly matches the correct set. Otherwise partial credit: +1 per correct
 * selection, -1 per incorrect selection, clamped to [0, totalCorrect].
 */
export function scoreSelection(args: {
  selectedIndices: ReadonlySet<number>;
  correctIndices: ReadonlySet<number>;
  totalAnswers: number;
  singlePoint?: boolean;
}): { raw: number; max: number; success: boolean } {
  const { selectedIndices, correctIndices, totalAnswers, singlePoint } = args;
  const totalCorrect = correctIndices.size;

  if (singlePoint) {
    const exact =
      selectedIndices.size === correctIndices.size &&
      [...correctIndices].every((i) => selectedIndices.has(i));
    return { raw: exact ? 1 : 0, max: 1, success: exact };
  }

  let earned = 0;
  for (const i of selectedIndices) {
    if (correctIndices.has(i)) earned += 1;
    else earned -= 1;
  }
  const clamped = Math.max(0, Math.min(totalCorrect, earned));
  void totalAnswers;
  return { raw: clamped, max: totalCorrect, success: clamped === totalCorrect };
}

/**
 * Aggregates child ScoreStates into a single ScoreState for composite
 * activities (Question Set). Pass threshold defaults to 50%.
 */
export function aggregate(scores: readonly ScoreState[], passPercent = 50): ScoreState {
  const raw = scores.reduce((s, x) => s + x.raw, 0);
  const max = scores.reduce((s, x) => s + x.max, 0);
  const pct = max === 0 ? 0 : (raw / max) * 100;
  return { raw, max, success: pct >= passPercent };
}

/** 0–100 percentage. Returns 0 when `max` is 0. */
export function percentage(s: Pick<ScoreState, "raw" | "max">): number {
  if (s.max === 0) return 0;
  return Math.round((s.raw / s.max) * 100);
}

/** Picks the matching `overallFeedback` band for a score. */
export function bandMessage(bands: readonly ScoreBand[] | undefined, pct: number): string | null {
  if (!bands) return null;
  for (const b of bands) {
    if (pct >= b.from && pct <= b.to) return b.message;
  }
  return null;
}
