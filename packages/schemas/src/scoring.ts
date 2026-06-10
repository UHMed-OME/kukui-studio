import { z } from "zod";

/**
 * Scoring configuration — the single typed surface that determines what
 * the LMS sees when a learner finishes an activity.
 *
 * Replaces the older scattered shape (`behaviour.singlePoint`,
 * root-level `passPercentage`, root-level `overallFeedback`,
 * `behaviour.enableRetry`, `behaviour.enableSolutionsButton`) with a
 * discriminated union keyed on `mode`. The Scoring tab in Studio
 * reads + writes this; per-activity Editors no longer expose the
 * underlying fields.
 *
 * SCORM 1.2 mapping (handled by the activity runtime → bridge):
 *   - "points": score.raw = round(correct/total * 100); lesson_status
 *     = passed if score.raw >= passPercentage else failed
 *   - "all-or-nothing": score.raw = 100 if fully correct else 0;
 *     lesson_status = passed only on a clean sweep
 *   - "completion": score.raw = 100, lesson_status = "passed" when the
 *     learner finishes (the drivers only ever write passed/failed)
 */

const ScoreBandSchema = z
  .object({
    from: z.number().min(0).max(100),
    to: z.number().min(0).max(100),
    message: z.string(),
  })
  .strict();

const PointsScoring = z
  .object({
    mode: z.literal("points"),
    passPercentage: z.number().min(0).max(100).optional(),
    bands: z.array(ScoreBandSchema).optional(),
    enableRetry: z.boolean().optional(),
    enableSolutionsButton: z.boolean().optional(),
  })
  .strict();

const AllOrNothingScoring = z
  .object({
    mode: z.literal("all-or-nothing"),
    enableRetry: z.boolean().optional(),
    enableSolutionsButton: z.boolean().optional(),
  })
  .strict();

const CompletionScoring = z
  .object({
    mode: z.literal("completion"),
    enableRetry: z.boolean().optional(),
  })
  .strict();

export const ScoringSchema = z.discriminatedUnion("mode", [
  PointsScoring,
  AllOrNothingScoring,
  CompletionScoring,
]);

export type Scoring = z.infer<typeof ScoringSchema>;
export type ScoringMode = Scoring["mode"];

export const SCORING_MODES: readonly ScoringMode[] = [
  "points",
  "all-or-nothing",
  "completion",
];
