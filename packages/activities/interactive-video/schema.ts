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
    type: z.enum(["html5", "youtube", "vimeo"]).optional(),
    poster: SAFE_MEDIA_URL.optional(),
    /** Optional caption tracks (html5). */
    tracks: z.array(Track).optional(),
  })
  .strict();

/**
 * A timed interaction. `kind` selects what `config` holds:
 *   - "label": `{ html }` — a non-scored info card shown at the timecode.
 *   - "multipleChoice" / "fillInTheBlanks": the embedded activity config,
 *     validated against that activity's schema at render.
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
    kind: z.enum(["label", "multipleChoice", "fillInTheBlanks"]),
    config: z.record(z.string(), z.unknown()),
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
    behaviour: z
      .object({
        enableRetry: z.boolean().optional(),
        passPercentage: z.number().min(0).max(100).optional(),
        /** Speed options offered in the player. */
        playbackRates: z.array(z.number().positive()).optional(),
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
