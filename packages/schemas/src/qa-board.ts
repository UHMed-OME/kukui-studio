import { z } from "zod";
import { AppearanceSchema } from "./appearance.js";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

/**
 * Q&A Board — open backchannel for class. Students post short
 * questions during lecture; anyone can upvote; the instructor sees
 * the list ranked by votes and can mark a question as "answered".
 *
 * No "right answer" semantics — this is a participation channel, not
 * an assessment. Anonymity is opt-in via `behaviour.allowAnonymous`
 * (default true) — when on, the poster's display name is hidden in
 * the public list, though the instructor still sees it for moderation.
 *
 * The activity carries no question list itself: students supply the
 * content at runtime. Author just provides a prompt and behaviour.
 */
export const QABoardConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    prompt: z.string().min(1),
    maxQuestionsPerStudent: z.number().int().min(1).max(20).optional(),
    maxQuestionLength: z.number().int().min(20).max(500).optional(),
    behaviour: z
      .object({
        allowAnonymous: z.boolean().optional(),
        allowUpvoteOwn: z.boolean().optional(),
        showAnsweredBelow: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        openButton: z.string().optional(),
        resetButton: z.string().optional(),
        submitButton: z.string().optional(),
      })
      .strict()
      .optional(),
    live: z
      .object({
        joinKey: z.string().min(4).max(64).optional(),
        adminKey: z.string().min(4).max(64).optional(),
        signaling: z.enum(["nostr", "mqtt"]).optional(),
        relayUrls: z.array(z.string().url()).max(8).optional(),
      })
      .strict()
      .optional(),
    appearance: AppearanceSchema.optional(),
  })
  .strict();

export type QABoardConfig = z.infer<typeof QABoardConfigSchema>;
