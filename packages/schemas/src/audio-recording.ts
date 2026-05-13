import { z } from "zod";
import { ScoringSchema } from "./scoring.js";
import { AppearanceSchema } from "./appearance.js";
import { SAFE_MEDIA_URL } from "./url.js";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

/**
 * Audio Recording / Pronunciation — completion-only spoken-response activity.
 *
 * The learner reads `prompt` (HTML) and records an audio clip via the browser
 * MediaRecorder API. After stopping, they may play it back, re-record (if
 * `behaviour.allowReRecord` is true), then submit. Submission encodes the clip
 * as a data URL and stuffs it into suspendData. There is no auto-grading: any
 * recording that meets `minDurationSeconds` is accepted.
 *
 * Phase 1 (async) trade-off: a 60 s clip in WebM/Opus is roughly 60 KB; base64
 * inflates that ~33 %. SCORM 1.2 caps suspend_data at 4096 chars, so anything
 * beyond a few seconds will overflow on strict LMSes. This is the v0 trade-off
 * — Phase 3 (Live) streams peer-to-peer instead. Authors should keep
 * `maxDurationSeconds` short for SCORM-bound deployments.
 *
 * `referenceAudio` lets authors supply a model pronunciation the learner can
 * play before recording — useful for medical-term or language drills.
 */
export const AudioRecordingConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    prompt: z.string().min(1),
    referenceAudio: z
      .object({
        src: SAFE_MEDIA_URL,
        caption: z.string().optional(),
      })
      .strict()
      .optional(),
    maxDurationSeconds: z.number().positive().optional(),
    minDurationSeconds: z.number().positive().optional(),
    behaviour: z
      .object({
        allowReRecord: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        recordButton: z.string().optional(),
        stopButton: z.string().optional(),
        playbackButton: z.string().optional(),
        reRecordButton: z.string().optional(),
        submitButton: z.string().optional(),
      })
      .strict()
      .optional(),
    scoring: ScoringSchema.optional(),
    appearance: AppearanceSchema.optional(),
  })
  .strict()
  .refine(
    (cfg) =>
      cfg.maxDurationSeconds === undefined ||
      cfg.minDurationSeconds === undefined ||
      cfg.minDurationSeconds <= cfg.maxDurationSeconds,
    { message: "minDurationSeconds must be ≤ maxDurationSeconds" },
  );

export type AudioRecordingConfig = z.infer<typeof AudioRecordingConfigSchema>;
