/**
 * Result of a learner's attempt at an activity.
 *
 * `raw` and `max` are the unscaled score and maximum possible score for this
 * attempt. `success` is the boolean pass/fail flag posted to the LMS as
 * `cmi.core.lesson_status`. `suspendData` is the activity's serialized state
 * for resume — already compressed when it lands in this shape.
 */
export type ScoreState = {
  raw: number;
  max: number;
  success: boolean;
  suspendData?: string;
};

/**
 * Common props every activity component receives. `TConfig` is the
 * activity-specific config object (validated against the matching Zod schema
 * before being handed to the component).
 */
export type ActivityProps<TConfig> = {
  config: TConfig;
  onSubmit: (s: ScoreState) => void;
  onResume?: () => Partial<TConfig> | undefined;
  /** Latest persisted suspend data — components decode this on mount to resume. */
  suspendData?: string;
  /** Called whenever the learner makes a meaningful interaction we should persist. */
  onPersist?: (suspendData: string) => void;
  /**
   * Report a per-question SCORM 1.2 interaction. Activities not yet wired
   * simply don't call this; behaviour is purely additive. See the
   * `2026-05-14-scorm-interaction-hygiene` spec for the per-activity
   * vocabulary.
   */
  onInteraction?: (record: InteractionRecord) => void;
  /**
   * Heading level the component should use for its title. Defaults to 1
   * (top-level activity); pass 2 when nesting inside Course Presentation /
   * Question Set so the document outline doesn't end up with multiple h1s.
   */
  headingLevel?: 1 | 2 | 3;
};

export type BuiltActivityKind =
  | "multiple-choice"
  | "fill-in-the-blanks"
  | "drag-and-drop"
  | "question-set"
  | "hotspot-3d"
  | "hotspot-2d"
  | "virtual-tour"
  | "sequence-steps"
  | "matching-pairs"
  | "categorization"
  | "image-comparison-slider"
  | "anatomy-labeling"
  | "highlight-text"
  | "flashcards"
  | "reflection-prompt"
  | "branching-scenario"
  | "image-annotation"
  | "concept-map"
  | "interactive-video"
  | "audio-recording"
  | "video-reflection"
  | "lab-panel"
  | "ddx-tree"
  | "osce"
  | "crossword"
  | "straw-poll"
  | "confidence-meter"
  | "word-cloud"
  | "qa-board"
  | "quick-quiz"
  | "isometric-chatroom";

/** Reserved for future activity kinds that haven't been implemented yet. */
export type PlannedKind = never;

export type ActivityKind = BuiltActivityKind | PlannedKind;

export const BUILT_ACTIVITY_KINDS: readonly BuiltActivityKind[] = [
  "multiple-choice",
  "fill-in-the-blanks",
  "drag-and-drop",
  "question-set",
  "hotspot-3d",
  "hotspot-2d",
  "virtual-tour",
  "sequence-steps",
  "matching-pairs",
  "categorization",
  "image-comparison-slider",
  "anatomy-labeling",
  "highlight-text",
  "flashcards",
  "reflection-prompt",
  "branching-scenario",
  "image-annotation",
  "concept-map",
  "interactive-video",
  "audio-recording",
  "video-reflection",
  "lab-panel",
  "ddx-tree",
  "osce",
  "crossword",
  "straw-poll",
  "confidence-meter",
  "word-cloud",
  "qa-board",
  "quick-quiz",
  "isometric-chatroom",
] as const;

export const ACTIVITY_KINDS: readonly ActivityKind[] = [
  ...BUILT_ACTIVITY_KINDS,
] as const;

/** Score band for `overallFeedback` lookups. */
export type ScoreBand = {
  from: number;
  to: number;
  message: string;
};

/**
 * SCORM 1.2 §3.4.7.3 interaction types. The eight values are spec-defined;
 * adding new ones isn't permitted.
 */
export type InteractionType =
  | "true-false"
  | "choice"
  | "fill-in"
  | "matching"
  | "performance"
  | "sequencing"
  | "likert"
  | "numeric";

/**
 * Discriminated union mirroring SCORM 1.2 §3.4.7.9 cmi.interactions.N.result
 * vocabulary. `numeric` covers the spec's decimal 0..1 case.
 */
export type InteractionResult =
  | { kind: "correct" }
  | { kind: "wrong" }
  | { kind: "unanticipated" }
  | { kind: "neutral" }
  | { kind: "numeric"; value: number };

/**
 * One learner-question pairing for SCORM 1.2 cmi.interactions.N.* writes.
 * `id` must be stable across re-attempts so the LMS report aggregates
 * correctly — see the spec for the `<kind>:<configIdent>:<itemRef>` format.
 *
 * `description` is internal — it's surfaced in dev-console logs and reserved
 * for future xAPI / cmi5 work, but never written to SCORM (1.2 has no
 * description field; objectives.N.id is for learning-objective linkage and
 * is intentionally unused).
 */
export type InteractionRecord = {
  id: string;
  type: InteractionType;
  description?: string;
  studentResponse: string;
  correctResponse?: string;
  result: InteractionResult;
  weighting?: number;
  latencySeconds?: number;
};
