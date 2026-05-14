import { z } from "zod";
import { AppearanceSchema } from "./appearance.js";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

/**
 * Isometric Chatroom — students join as pixel-art avatars in a shared
 * isometric room. They walk around in real-time (via Y.js CRDT), type
 * messages that appear as speech bubbles above their heads, and react
 * with emoji. The instructor drives the session through the standard
 * phase lifecycle (lobby → question → reveal → discussion → ended)
 * and can moderate chat (mute, delete, pin a question).
 *
 * This is a synchronous communication activity, not an assessment.
 * No SCORM scoring — engagement-only by nature. The config defines
 * the room appearance, available characters, chat rules, and emoji set.
 *
 * Constraints encoded here:
 *   - 1-12 character options. Fewer than one is useless; more than
 *     twelve crowds the character picker.
 *   - Room size 8×8 to 20×20 tiles. Smaller rooms feel cramped;
 *     larger rooms make characters too small to see.
 *   - Message length 50-1000 chars. Below 50 is too short for
 *     meaningful discussion; above 1000 is a wall of text.
 *   - Message display duration 3-30 seconds. Below 3s is too fast
 *     to read; above 30s the room gets cluttered with bubbles.
 */
export const IsometricChatroomConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1).max(120),
    author: z.string().optional(),
    prompt: z.string().optional(),
    room: z
      .object({
        /** Room name displayed in the header. */
        name: z.string().min(1).max(80),
        /** Background theme for the room. */
        theme: z.enum(["classroom", "library", "cafe", "lounge", "outdoor", "custom"]),
        /** Custom background image URL (optional, overrides theme). */
        backgroundImage: z.string().url().optional(),
        /** Alt text for the custom background (required if backgroundImage set). */
        backgroundAlt: z.string().optional(),
        /** Room width in tiles. Default 12. Min 8. Max 20. */
        width: z.number().int().min(8).max(20).optional(),
        /** Room height in tiles. Default 12. Min 8. Max 20. */
        height: z.number().int().min(8).max(20).optional(),
        /**
         * Seeded furniture/props placement. Same seed = same layout on resume.
         * "reshuffle" regenerates from the seed.
         */
        seed: z.string().optional(),
      })
      .strict(),
    characters: z
      .array(
        z
          .object({
            /** Unique id for this character option. */
            id: z.string().min(1).max(32),
            /** Display name shown to the learner when selecting. */
            label: z.string().min(1).max(40),
            /**
             * Sprite data. Each character is a 16×24 pixel sprite
             * (2×3 pixel art per frame, 4 frames for walking).
             * Stored as base64 data URL or external URL.
             */
            sprite: z.string().min(1),
            /** Color palette override for the sprite (optional). */
            palette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).optional(),
            /** Whether this character is available to students. */
            availableToStudents: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(12)
      .refine((arr) => new Set(arr.map((c) => c.id)).size === arr.length, {
        message: "character ids must be unique",
      }),
    rules: z
      .object({
        /** Whether students must acknowledge rules before entering. Default true. */
        requireAcknowledge: z.boolean().optional(),
        /** Chat rules displayed in the lobby. Min 1, max 10 rules. */
        rules: z.array(z.string().min(1).max(200)).min(1).max(10),
        /** Maximum message length in characters. Default 280. Min 50. Max 1000. */
        maxMessageLength: z.number().int().min(50).max(1000).optional(),
        /**
         * How long messages persist above the avatar before fading.
         * Default 8000ms. Min 3000. Max 30000.
         */
        messageDisplayDuration: z.number().int().min(3000).max(30000).optional(),
        /**
         * Whether students can type freely or only during certain phases.
         * "free" = always, "question" = only during question phase,
         * "discussion" = only during discussion phase.
         */
        chatMode: z.enum(["free", "question", "discussion"]).optional(),
        /** Whether the instructor can close the lobby. Default true. */
        allowLobbyClose: z.boolean().optional(),
        /** Whether the instructor can mute/unmute individual students. Default true. */
        allowIndividualMute: z.boolean().optional(),
        /** Whether the instructor can delete messages. Default true. */
        allowMessageDeletion: z.boolean().optional(),
        /** Whether students can see each other's names during chat. Default true. */
        showNamesInChat: z.boolean().optional(),
      })
      .strict()
      .optional(),
    emoji: z
      .object({
        /**
         * Preset emoji sets.
         * "standard" = 24 common emojis
         * "academic" = 20 study/reaction emojis
         * "minimal" = 12 basic reaction emojis
         * "custom" = author defines the set
         */
        preset: z.enum(["standard", "academic", "minimal", "custom"]),
        /**
         * Custom emoji set (only used when preset = "custom").
         * Min 4, max 24 entries.
         */
        custom: z
          .array(
            z.object({
              name: z.string().min(1).max(32),
              char: z.string().min(1).max(4),
            }),
          )
          .min(4)
          .max(24)
          .optional(),
      })
      .strict()
      .optional(),
    appearance: AppearanceSchema.default({ theme: "auto" }),
    live: z
      .object({
        joinKey: z.string().min(4).max(64).optional(),
        adminKey: z.string().min(4).max(64).optional(),
        signaling: z.enum(["nostr", "mqtt"]).optional(),
        relayUrls: z.array(z.string().url()).max(8).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type IsometricChatroomConfig = z.infer<typeof IsometricChatroomConfigSchema>;
