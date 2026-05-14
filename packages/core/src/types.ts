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
