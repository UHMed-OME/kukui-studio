import { z } from "zod";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

/**
 * Straw Poll — Kukui Live's first synchronous activity.
 *
 * An instructor poses a single question with a small set of choices;
 * connected students each cast one vote; everyone watches the tally
 * update live. There is no "correct" answer — this is a feedback /
 * temperature-check tool, not a graded assessment, so the schema has
 * no `correct` flag on choices.
 *
 * Designed for class sizes up to ~300. The vote storage layer scales
 * gracefully with that count (one Y.Map entry per voter, ≤ ~50 bytes
 * each → ≤ ~15 KB of room state at full attendance). The transport
 * layer (Trystero full-mesh) is the real bottleneck above ~100 peers,
 * and is a separate concern — the schema doesn't change to support
 * it.
 *
 * Constraints encoded here:
 *   - 2..8 choices. Fewer than two isn't a poll; more than eight
 *     crowds the bar chart and overwhelms the live-stream learner.
 *   - Choice ids are unique per poll; choice labels are short (≤ 80
 *     chars) so they render cleanly under each bar.
 *   - The author can opt out of the default "students see live
 *     counts" behaviour for high-stakes polls where seeing other
 *     responses would bias the answer.
 */
export const StrawPollConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    prompt: z.string().min(1),
    choices: z
      .array(
        z
          .object({
            id: z.string().min(1).max(64),
            label: z.string().min(1).max(80),
            description: z.string().max(280).optional(),
          })
          .strict(),
      )
      .min(2)
      .max(8)
      .refine((arr) => new Set(arr.map((c) => c.id)).size === arr.length, {
        message: "choice ids must be unique",
      }),
    behaviour: z
      .object({
        /**
         * If true (default), students see the live tally after casting
         * their vote. If false, the tally only appears when the
         * instructor advances to the "reveal" phase.
         */
        showLiveResultsToStudents: z.boolean().optional(),
        /**
         * If true (default), a student can re-tap a different choice
         * before the poll closes and their previous vote is replaced.
         * If false, the first vote is final.
         */
        allowChangeVote: z.boolean().optional(),
        /**
         * If true, the instructor sees per-student vote rows in
         * addition to the aggregate. Default false (aggregate only) —
         * 300-row lists are noisy and most straw polls are anonymous
         * by intent.
         */
        showIndividualVotes: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        openPollButton: z.string().optional(),
        closePollButton: z.string().optional(),
        revealButton: z.string().optional(),
        resetButton: z.string().optional(),
        submitVoteButton: z.string().optional(),
        changeVoteButton: z.string().optional(),
      })
      .strict()
      .optional(),
    /**
     * Live-mode transport settings baked into the activity. The author
     * pins these so every learner who opens the SCO connects to the
     * same mesh without having to type a backend / relay URL into a
     * lobby. Optional — when omitted, Kukui Live falls back to its
     * defaults (Nostr signaling, Trystero's bundled relay list).
     *
     * Use `relayUrls` to pin to specific relays that are known to work
     * on your institution's network (and known not to disappear mid-
     * lecture). Pass `signaling: "mqtt"` if Nostr is blocked.
     */
    live: z
      .object({
        /**
         * Public room key. Hashed to derive the Trystero room id, so
         * every learner whose activity JSON has the same `joinKey`
         * lands in the same mesh. Author chooses any string (treated
         * as opaque — 4..64 chars). Rotate per session if you want
         * fresh rooms between class meetings.
         */
        joinKey: z.string().min(4).max(64).optional(),
        /**
         * Private admin key. When present, only a participant who
         * proves they know it (via `?adminKey=…` URL param or the
         * in-activity lock-icon prompt) is granted host role.
         * Without an `adminKey`, anyone can claim host — fine for
         * dev / sandbox, NOT for shared classroom polls.
         */
        adminKey: z.string().min(4).max(64).optional(),
        signaling: z.enum(["nostr", "mqtt"]).optional(),
        relayUrls: z
          .array(z.string().url())
          .max(8)
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type StrawPollConfig = z.infer<typeof StrawPollConfigSchema>;
