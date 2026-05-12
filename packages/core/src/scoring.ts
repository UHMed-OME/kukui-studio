import type { Scoring } from "@kukui/schemas";
import type { ScoreBand, ScoreState } from "./types.js";

/**
 * Effective scoring view for an activity runtime. Reads `config.scoring`
 * when present (new shape after Scoring-tab migration), and falls back to
 * legacy `behaviour.singlePoint` + root `passPercentage` + root
 * `overallFeedback` (old shape) so existing fixtures + samples that
 * haven't been re-saved through Studio still play correctly.
 *
 * Activities call this once per render with the relevant slice of their
 * config; the resolved view is the single source of truth for retry /
 * show-solution / scoring-mode logic in the component.
 */
export type ResolvedScoring = {
  mode: "points" | "all-or-nothing" | "completion";
  passPercentage: number;
  bands: readonly ScoreBand[] | undefined;
  enableRetry: boolean;
  enableSolutionsButton: boolean;
};

export function resolveScoring(
  source: {
    scoring?: Scoring;
    behaviour?: {
      singlePoint?: boolean;
      enableRetry?: boolean;
      enableSolutionsButton?: boolean;
      showSolutionsButton?: boolean;
    };
    passPercentage?: number;
    overallFeedback?: readonly ScoreBand[];
  },
  defaults: { mode?: ResolvedScoring["mode"]; passPercentage?: number } = {},
): ResolvedScoring {
  const defaultMode = defaults.mode ?? "points";
  const defaultPass = defaults.passPercentage ?? 50;
  const s = source.scoring;
  if (s) {
    const enableRetry = s.enableRetry ?? true;
    const enableSolutionsButton =
      s.mode === "completion" ? false : s.enableSolutionsButton ?? false;
    const passPercentage =
      s.mode === "points" ? s.passPercentage ?? defaultPass : 100;
    const bands = s.mode === "points" ? s.bands : undefined;
    return { mode: s.mode, passPercentage, bands, enableRetry, enableSolutionsButton };
  }
  const b = source.behaviour ?? {};
  const enableRetry = b.enableRetry ?? true;
  const enableSolutionsButton =
    b.enableSolutionsButton ?? b.showSolutionsButton ?? false;
  const mode: ResolvedScoring["mode"] = b.singlePoint ? "all-or-nothing" : defaultMode;
  return {
    mode,
    passPercentage: source.passPercentage ?? defaultPass,
    bands: source.overallFeedback ?? undefined,
    enableRetry,
    enableSolutionsButton,
  };
}

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
