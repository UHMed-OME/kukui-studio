import { z } from "zod";
import { ScoringSchema, AppearanceSchema } from "@kukui/schemas/shared";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

/**
 * Video Reflection — completion-only recorded-video response activity.
 *
 * The learner reads `prompt` (HTML) and records a short video via the
 * browser. Camera + mic are always available; on devices that support
 * screen capture (`getDisplayMedia` — desktop browsers, not iOS Safari)
 * an optional screen share is composited behind a webcam picture-in-
 * picture. After stopping, the learner can play it back, re-record (if
 * `behaviour.allowReRecord`), download the clip, and submit.
 *
 * Delivery trade-off (Phase 1, no backend): video is far too large to
 * persist in SCORM `cmi.suspend_data` (4 KB cap), so the recording is
 * NOT transmitted to the LMS. The learner downloads the file and uploads
 * it to the course dropbox/assignment; Kukui records completion only
 * (duration + a flag that they recorded). The activity copy states this
 * plainly so it isn't a surprise.
 */
export const VideoReflectionConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    prompt: z.string().min(1),
    /**
     * Where the learner should send the finished video (e.g. the name of
     * the Brightspace assignment/dropbox). Surfaced in the submit step.
     */
    submissionTarget: z.string().optional(),
    maxDurationSeconds: z.number().positive().optional(),
    minDurationSeconds: z.number().positive().optional(),
    behaviour: z
      .object({
        allowReRecord: z.boolean().optional(),
        /** Offer screen-share + picture-in-picture where the browser supports it. */
        allowScreenShare: z.boolean().optional(),
        /**
         * Shape of the webcam picture-in-picture over a shared screen.
         * "rounded" keeps the full 16:9 frame with rounded corners;
         * "circle" crops to a centered face bubble. Defaults to "rounded".
         */
        cameraShape: z.enum(["rounded", "circle"]).optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        recordButton: z.string().optional(),
        stopButton: z.string().optional(),
        reRecordButton: z.string().optional(),
        downloadButton: z.string().optional(),
        submitButton: z.string().optional(),
      })
      .strict()
      .optional(),
    scoring: ScoringSchema.optional(),
    appearance: AppearanceSchema.default({ theme: "auto" }),
  })
  .strict()
  .refine(
    (cfg) =>
      cfg.maxDurationSeconds === undefined ||
      cfg.minDurationSeconds === undefined ||
      cfg.minDurationSeconds <= cfg.maxDurationSeconds,
    { message: "minDurationSeconds must be ≤ maxDurationSeconds" },
  );

export type VideoReflectionConfig = z.infer<typeof VideoReflectionConfigSchema>;
