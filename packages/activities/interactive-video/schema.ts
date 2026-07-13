import { z } from "zod";
import { ScoringSchema, AppearanceSchema, SAFE_MEDIA_URL } from "@kukui/schemas/shared";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

/** WebVTT caption track (html5 sources; YouTube uses its native captions). */
const Track = z
  .object({
    src: SAFE_MEDIA_URL,
    /** BCP-47 language code, e.g. "en". */
    srclang: z.string().min(1),
    /** Human label shown in the captions menu, e.g. "English". */
    label: z.string().min(1),
    /** Show this track by default. */
    default: z.boolean().optional(),
  })
  .strict();

const Video = z
  .object({
    src: SAFE_MEDIA_URL,
    type: z.enum(["html5", "youtube"]).optional(),
    poster: SAFE_MEDIA_URL.optional(),
    /** Optional caption tracks (html5). */
    tracks: z.array(Track).optional(),
    /** Trim: playback window start (seconds). Default 0 (no trim). */
    startAt: z.number().min(0).optional(),
    /** Trim: playback window end (seconds). Must be greater than startAt. */
    endAt: z.number().positive().optional(),
  })
  .strict()
  .refine((v) => v.endAt === undefined || v.endAt > (v.startAt ?? 0), {
    message: "endAt must be greater than startAt",
    path: ["endAt"],
  });

/**
 * A timed interaction. `kind` selects what `config` holds:
 *   - "label": `{ html }` — a non-scored info card shown at the timecode.
 *   - "multipleChoice" / "fillInTheBlanks": the embedded activity config,
 *     validated against that activity's schema at render.
 *   - "reflection": an embedded reflection-prompt config (open response).
 *     Gates like any required checkpoint but records a zero-max score, so
 *     it never shifts a points-mode grade.
 */
const Interaction = z
  .object({
    id: z.string().min(1),
    atSeconds: z.number().min(0),
    /** Short title — shown in the marker tooltip, bookmarks list, overlay. */
    title: z.string().optional(),
    required: z.boolean().optional(),
    /** Pause playback when reached. Default true. */
    pauseOnReach: z.boolean().optional(),
    kind: z.enum(["label", "multipleChoice", "fillInTheBlanks", "reflection"]),
    config: z.record(z.string(), z.unknown()),
    /**
     * Answer-adaptive jump: when a graded checkpoint is answered incorrectly,
     * offer to rewatch from `seekTo` (seconds) instead of recording the score.
     * `maxReplays` caps how many times (default 1); once spent, the score is
     * recorded and playback continues.
     */
    onWrong: z
      .object({
        seekTo: z.number().min(0),
        maxReplays: z.number().int().min(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

/** A named jump point on the timeline (distinct from a graded interaction). */
const Chapter = z
  .object({
    id: z.string().min(1),
    atSeconds: z.number().min(0),
    title: z.string().min(1),
  })
  .strict();

export const InteractiveVideoConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    prompt: z.string().optional(),
    video: Video,
    interactions: z.array(Interaction),
    /** Optional chapter markers offering a jump menu on the seek bar. */
    chapters: z
      .array(Chapter)
      .optional()
      .refine(
        (cs) => cs === undefined || new Set(cs.map((c) => c.id)).size === cs.length,
        { message: "Chapter ids must be unique" },
      ),
    behaviour: z
      .object({
        enableRetry: z.boolean().optional(),
        passPercentage: z.number().min(0).max(100).optional(),
        /** Speed options offered in the player. */
        playbackRates: z.array(z.number().positive()).optional(),
        /** Show an end-of-video answer summary before final submit. Default true. */
        showSummary: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        resumeButtonLabel: z.string().optional(),
      })
      .strict()
      .optional(),
    scoring: ScoringSchema.optional(),
    appearance: AppearanceSchema.default({ theme: "auto" }),
  })
  .strict();

export type InteractiveVideoConfig = z.infer<typeof InteractiveVideoConfigSchema>;
