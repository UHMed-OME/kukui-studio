import { syncLegacyFields, type Scoring, type ScoringMode } from "@kukui/schemas";
import type { ActivityKind } from "@kukui/core";
import { modeAvailabilityFor } from "./modeAvailability.js";

/**
 * Read the scoring block off an arbitrary config (typed as `unknown`
 * because Studio's draft state is loosely typed during edits).
 */
export function readScoring(value: unknown): Scoring | undefined {
  if (!value || typeof value !== "object") return undefined;
  const s = (value as Record<string, unknown>).scoring;
  if (!s || typeof s !== "object") return undefined;
  const mode = (s as Record<string, unknown>).mode;
  if (mode === "points" || mode === "all-or-nothing" || mode === "completion") {
    return s as Scoring;
  }
  return undefined;
}

/**
 * Default scoring block for an activity kind, used when the form has
 * no `scoring` field yet (fresh starter, or imported old-shape JSON
 * before the migrator runs).
 */
export function defaultScoring(kind: ActivityKind): Scoring | null {
  const avail = modeAvailabilityFor(kind);
  if (!avail) return null;
  return buildFreshScoring(avail.default);
}

/**
 * Build a clean `scoring` block for the given mode. Used by the
 * mode picker when the author switches modes — we discard the
 * irrelevant discriminant fields so the runtime sees a clean shape.
 */
export function buildFreshScoring(mode: ScoringMode): Scoring {
  switch (mode) {
    case "points":
      return { mode: "points", passPercentage: 50 };
    case "all-or-nothing":
      return { mode: "all-or-nothing" };
    case "completion":
      return { mode: "completion" };
  }
}

/**
 * Replace the `scoring` block on a config and mirror the change into
 * the legacy fields (`behaviour.singlePoint`, `passPercentage`,
 * `overallFeedback`, `behaviour.enableRetry`, `behaviour.enableSolutionsButton`).
 * The dual-write lets unconverted activity runtimes keep working
 * unchanged — they still read the legacy fields and see the latest
 * authoring choices.
 */
export function withScoring(value: unknown, scoring: Scoring): unknown {
  const base =
    value && typeof value === "object"
      ? { ...(value as Record<string, unknown>), scoring }
      : { scoring };
  return syncLegacyFields(base, scoring);
}

/**
 * Effective scoring for an activity kind + value. Falls back to the
 * kind's default if the value has no scoring block.
 */
export function effectiveScoring(
  kind: ActivityKind,
  value: unknown,
): Scoring | null {
  return readScoring(value) ?? defaultScoring(kind);
}
