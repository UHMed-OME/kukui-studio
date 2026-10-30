import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Leaderboard Quiz";

/**
 * One-line description for Studio's catalog and learning-objective matching.
 * Objective: recall and examine medical terms, disease names, and anatomical
 * structures accurately, under time pressure, across instructor-defined topics.
 */
export const description =
  "Timed, typed-answer recall drill over instructor-defined topics, with a personal best.";

/** Recall of terms/facts, with a secondary "understand" component. */
export const bloom: BloomLevel = "remember";

/** Live variant: apps/live-mode/src/activities/LeaderboardQuizLive.tsx. */
export const live = true;
