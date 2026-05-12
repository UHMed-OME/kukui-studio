import type { Scoring } from "./scoring.js";

/**
 * Idempotent in-place migrator from the pre-Scoring-tab shape to the
 * unified `config.scoring` block.
 *
 * Old shape (scattered):
 *   behaviour.singlePoint           → scoring.mode = "all-or-nothing"
 *   (default / false)               → scoring.mode = "points"
 *   passPercentage (root)           → scoring.passPercentage
 *   overallFeedback (root)          → scoring.bands
 *   behaviour.enableRetry           → scoring.enableRetry
 *   behaviour.enableSolutionsButton → scoring.enableSolutionsButton
 *   (Flashcards / Reflection / etc.) → scoring.mode = "completion"
 *
 * The migrator runs at three boundaries:
 *   1. Studio draft loader (localStorage → form)
 *   2. JSON import path (file upload → form)
 *   3. AI editor response handler (LLM JSON → form)
 *
 * It is intentionally permissive: unknown shapes pass through unchanged,
 * already-migrated configs are no-ops, and the migrator never mutates its
 * argument — callers get a new object reference only when something
 * actually changed.
 */

/** Activity kinds whose only meaningful scoring mode is "completion". */
const COMPLETION_ONLY_KINDS = new Set<string>([
  "flashcards",
  "reflection-prompt",
  "audio-recording",
  "virtual-tour",
  "image-comparison-slider",
  "branching-scenario",
]);

/** Activity kinds whose only meaningful scoring mode is "all-or-nothing". */
const ALL_OR_NOTHING_DEFAULT_KINDS = new Set<string>([
  "hotspot-2d",
  "hotspot-3d",
  "ddx-tree",
]);

/** Activity kinds that don't get a scoring block (Live activities). */
const NO_SCORING_KINDS = new Set<string>([
  "straw-poll",
  "confidence-meter",
  "word-cloud",
  "qa-board",
  "quick-quiz",
]);

type AnyConfig = Record<string, unknown>;

function isPlainObject(value: unknown): value is AnyConfig {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Migrate a single activity config. If `kind` is omitted, the migrator
 * infers reasonable defaults from the shape (e.g. presence of `cards` →
 * flashcards) but the caller should pass it whenever known.
 */
export function migrateToScoring(config: unknown, kind?: string): unknown {
  if (!isPlainObject(config)) return config;
  if (kind && NO_SCORING_KINDS.has(kind)) return config;

  // Already migrated: a `scoring` object with a `mode` discriminant.
  const existing = config.scoring;
  if (isPlainObject(existing) && typeof existing.mode === "string") {
    return config;
  }

  const behaviour = isPlainObject(config.behaviour) ? config.behaviour : {};
  const oldSinglePoint = behaviour.singlePoint === true;
  const oldEnableRetry =
    typeof behaviour.enableRetry === "boolean" ? behaviour.enableRetry : undefined;
  const oldEnableSolutions =
    typeof behaviour.enableSolutionsButton === "boolean"
      ? behaviour.enableSolutionsButton
      : typeof behaviour.showSolutionsButton === "boolean"
        ? behaviour.showSolutionsButton
        : undefined;
  const oldPassPct =
    typeof config.passPercentage === "number" ? config.passPercentage : undefined;
  const oldBands = Array.isArray(config.overallFeedback)
    ? (config.overallFeedback as unknown[])
    : undefined;

  let scoring: Scoring;
  if (kind && COMPLETION_ONLY_KINDS.has(kind)) {
    scoring = { mode: "completion" };
    if (oldEnableRetry !== undefined) scoring.enableRetry = oldEnableRetry;
  } else if (oldSinglePoint || (kind && ALL_OR_NOTHING_DEFAULT_KINDS.has(kind))) {
    scoring = { mode: "all-or-nothing" };
    if (oldEnableRetry !== undefined) scoring.enableRetry = oldEnableRetry;
    if (oldEnableSolutions !== undefined)
      scoring.enableSolutionsButton = oldEnableSolutions;
  } else {
    const next: Extract<Scoring, { mode: "points" }> = { mode: "points" };
    if (oldPassPct !== undefined) next.passPercentage = oldPassPct;
    if (oldBands !== undefined && oldBands.length > 0) {
      next.bands = oldBands as Extract<Scoring, { mode: "points" }>["bands"];
    }
    if (oldEnableRetry !== undefined) next.enableRetry = oldEnableRetry;
    if (oldEnableSolutions !== undefined) next.enableSolutionsButton = oldEnableSolutions;
    scoring = next;
  }

  // Clean cut: legacy fields are stripped from their old homes. Every
  // activity runtime reads via `resolveScoring(config)` (from
  // @kukui/core/scoring), which prefers the `scoring` block when present
  // and gracefully falls back to legacy fields if it sees old-shape
  // input. So we keep the migrator authoritative for new-shape output
  // and the runtime tolerant for old-shape input.
  const out: AnyConfig = { ...config, scoring };
  const cleanedBehaviour = isPlainObject(out.behaviour) ? { ...out.behaviour } : null;
  if (cleanedBehaviour) {
    delete cleanedBehaviour.singlePoint;
    delete cleanedBehaviour.enableRetry;
    delete cleanedBehaviour.enableSolutionsButton;
    delete cleanedBehaviour.showSolutionsButton;
    if (Object.keys(cleanedBehaviour).length > 0) {
      out.behaviour = cleanedBehaviour;
    } else {
      delete out.behaviour;
    }
  }
  delete out.passPercentage;
  delete out.overallFeedback;
  return out;
}

/**
 * @deprecated Kept exported for the Scoring tab's `withScoring` helper
 * so it can normalize new-shape edits before the form's roundtrip,
 * even though no legacy fields are written. After all runtimes were
 * converted to read via `resolveScoring()` (from @kukui/core), the
 * dual-write became unnecessary — this helper is now an identity
 * wrapper that keeps the API stable.
 */
export function syncLegacyFields(config: unknown, _scoring: Scoring): unknown {
  return config;
}

/** Run the migrator over an unknown config of unknown kind. */
export function migrateUnknown(config: unknown): unknown {
  if (!isPlainObject(config)) return config;
  // Heuristic kind inference for callers who don't pass `kind` (e.g.
  // JSON import where the file might not carry it explicitly).
  const heuristicKind = inferKind(config);
  return migrateToScoring(config, heuristicKind);
}

function inferKind(config: AnyConfig): string | undefined {
  if (Array.isArray(config.cards)) return "flashcards";
  if (Array.isArray(config.draggables) && Array.isArray(config.dropZones))
    return "drag-and-drop";
  if (Array.isArray(config.questions) && typeof config.passPercentage === "number")
    return "question-set";
  if (Array.isArray(config.steps)) return "sequence-steps";
  if (Array.isArray(config.pairs)) return "matching-pairs";
  if (Array.isArray(config.categories) && Array.isArray(config.items))
    return "categorization";
  if (Array.isArray(config.tokens)) return "highlight-text";
  if (Array.isArray(config.entries)) return "crossword";
  return undefined;
}
