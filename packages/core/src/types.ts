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
};

export type ActivityKind =
  | "multiple-choice"
  | "fill-in-the-blanks"
  | "drag-and-drop"
  | "course-presentation"
  | "question-set"
  | "hotspot-3d"
  | "virtual-tour";

export const ACTIVITY_KINDS: readonly ActivityKind[] = [
  "multiple-choice",
  "fill-in-the-blanks",
  "drag-and-drop",
  "course-presentation",
  "question-set",
  "hotspot-3d",
  "virtual-tour",
] as const;

/** Score band for `overallFeedback` lookups. */
export type ScoreBand = {
  from: number;
  to: number;
  message: string;
};
