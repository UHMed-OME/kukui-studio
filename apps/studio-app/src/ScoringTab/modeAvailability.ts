import type { ActivityKind } from "@kukui/core";
import type { ScoringMode } from "@kukui/schemas";

/**
 * Which scoring modes each activity kind supports, and what the
 * canonical "fresh defaults" object is when the author picks a mode.
 *
 * If a kind isn't in this table the ScoringTab is hidden — that's
 * what we do for Live activities (Straw Poll, Word Cloud, etc.) which
 * don't post grades to the LMS.
 */

export type ModeAvailability = {
  /** Which modes the author can pick. */
  modes: readonly ScoringMode[];
  /** The mode picked when no `scoring` block exists yet. */
  default: ScoringMode;
};

const AUTO_GRADED_TRIPLE: ModeAvailability = {
  modes: ["points", "all-or-nothing", "completion"],
  default: "points",
};

const ALL_OR_NOTHING_DEFAULT: ModeAvailability = {
  modes: ["all-or-nothing", "completion"],
  default: "all-or-nothing",
};

const COMPLETION_ONLY: ModeAvailability = {
  modes: ["completion"],
  default: "completion",
};

const TABLE: Partial<Record<ActivityKind, ModeAvailability>> = {
  "multiple-choice": AUTO_GRADED_TRIPLE,
  "fill-in-the-blanks": AUTO_GRADED_TRIPLE,
  "drag-and-drop": AUTO_GRADED_TRIPLE,
  "question-set": AUTO_GRADED_TRIPLE,
  "hotspot-2d": ALL_OR_NOTHING_DEFAULT,
  "hotspot-3d": ALL_OR_NOTHING_DEFAULT,
  "sequence-steps": AUTO_GRADED_TRIPLE,
  "matching-pairs": AUTO_GRADED_TRIPLE,
  categorization: AUTO_GRADED_TRIPLE,
  "anatomy-labeling": AUTO_GRADED_TRIPLE,
  "highlight-text": AUTO_GRADED_TRIPLE,
  crossword: AUTO_GRADED_TRIPLE,
  "image-annotation": AUTO_GRADED_TRIPLE,
  "concept-map": AUTO_GRADED_TRIPLE,
  "interactive-video": AUTO_GRADED_TRIPLE,
  "lab-panel": AUTO_GRADED_TRIPLE,
  "ddx-tree": ALL_OR_NOTHING_DEFAULT,
  osce: AUTO_GRADED_TRIPLE,
  "branching-scenario": ALL_OR_NOTHING_DEFAULT,
  "image-comparison-slider": COMPLETION_ONLY,
  flashcards: COMPLETION_ONLY,
  "reflection-prompt": COMPLETION_ONLY,
  "audio-recording": COMPLETION_ONLY,
  "virtual-tour": COMPLETION_ONLY,
};

/** Returns the availability entry for an activity, or `null` if the
 * tab should be hidden entirely (Live + planned kinds). */
export function modeAvailabilityFor(kind: ActivityKind): ModeAvailability | null {
  return TABLE[kind] ?? null;
}

export const MODE_LABELS: Record<ScoringMode, string> = {
  points: "Points",
  "all-or-nothing": "All-or-nothing",
  completion: "Completion",
};

export const MODE_DESCRIPTIONS: Record<ScoringMode, string> = {
  points:
    "Score is the percentage of items the learner got right. The LMS records that percentage and marks the activity passed when it reaches the threshold below.",
  "all-or-nothing":
    "Score is 100 only when every item is correct, 0 otherwise. The LMS records passed only on a clean sweep.",
  completion:
    "There's no right answer to check. The LMS marks the activity completed when the learner finishes.",
};
