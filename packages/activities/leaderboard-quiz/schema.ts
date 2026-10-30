import { z } from "zod";
import { ScoringSchema, AppearanceSchema, SAFE_MEDIA_URL } from "@kukui/schemas/shared";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

/**
 * Leaderboard Quiz.
 *
 * Learning objective: "Recall and examine medical terms, disease names, and
 * anatomical structures accurately, under time pressure, across a set of
 * instructor-defined topics."
 *
 * Covers the engine (async, single-learner) and Live shapes. Typo
 * tolerance and the accommodations time multiplier are designed in
 * docs/superpowers/specs/2026-10-07-leaderboard-quiz-design.md.
 */
/** Credit links land in an href, so only http(s) is allowed (no javascript: / data:). */
const HTTP_URL = z
  .string()
  .url()
  .refine((v) => /^https?:\/\//i.test(v), { message: "Must be an http(s) URL." });

/** Fisher-Yates; returns a new array. */
export function shuffled<T>(items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export const LeaderboardQuizConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    topics: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z][a-z0-9-]*$/, "topic id must be kebab-case"),
            label: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
    questions: z
      .array(
        z
          .object({
            /** Optional; nothing reads it. Hidden in the Studio form. */
            id: z.string().min(1).optional(),
            topicId: z.string().min(1),
            prompt: z.string().min(1),
            /** Optional image shown with the prompt. Alt text is required for accessibility. */
            image: z
              .object({
                src: SAFE_MEDIA_URL,
                alt: z.string().min(1),
                /** Optional credit, listed in the activity footer with every other question's credit. */
                attribution: z
                  .object({
                    author: z.string().min(1),
                    authorUrl: HTTP_URL.optional(),
                    sourceUrl: HTTP_URL.optional(),
                    license: z.string().min(1).optional(),
                    licenseUrl: HTTP_URL.optional(),
                  })
                  .strict()
                  .optional(),
              })
              .strict()
              .optional(),
            /**
             * Legacy single-answer form (still accepted, hidden in the Studio
             * form). `blanks` wins when both are set.
             */
            // May be empty: the Studio form (which hides this field) fills missing lists with [].
            acceptedAnswers: z.array(z.string().min(1)).optional(),
            /**
             * The answers: one entry per answer box, each with its own accepted
             * answers (synonyms). A normal question has one entry; a
             * multi-blank fill-in-the-blanks has one per `___` in the prompt,
             * in order, and is correct only when every blank is right.
             */
            blanks: z
              .array(z.object({ acceptedAnswers: z.array(z.string().min(1)).min(1) }).strict())
              .min(1)
              .optional(),
            feedbackCorrect: z.string().optional(),
            feedbackIncorrect: z.string().optional(),
          })
          .strict(),
      )
      .min(1),
    round: z
      .object({
        /** Questions drawn per attempt (capped at the size of the selected pool). */
        questionCount: z.number().int().min(1),
        shuffle: z.boolean().optional(),
        topicSelection: z.enum(["all-topics", "learner-picks"]).optional(),
        /** One countdown for the whole round; no limit when unset. Learners can also turn it off. */
        timeLimitSeconds: z.number().int().min(1).optional(),
      })
      .strict(),
    /** Flat award per correct answer; no partial credit. */
    pointsPerCorrect: z.number().int().min(1),
    /** Instructor-editable learner-facing strings; built-in English defaults apply. */
    strings: z.record(z.string(), z.string()).optional(),
    scoring: ScoringSchema.optional(),
    /** Live classroom session keys; Studio auto-generates joinKey/adminKey. */
    live: z
      .object({
        joinKey: z.string().min(4).max(64).optional(),
        adminKey: z.string().min(4).max(64).optional(),
        signaling: z.enum(["nostr", "mqtt"]).optional(),
        relayUrls: z.array(z.string().url()).max(8).optional(),
      })
      .strict()
      .optional(),
    appearance: AppearanceSchema.default({ theme: "auto" }),
  })
  .strict()
  // Zod can't express cross-references natively; check them here so a typo'd
  // topicId fails validation instead of silently dropping the question.
  .superRefine((cfg, ctx) => {
    const ids = new Set(cfg.topics.map((t) => t.id));
    cfg.questions.forEach((q, i) => {
      if (!q.acceptedAnswers?.length && !q.blanks?.length) {
        ctx.addIssue({
          code: "custom",
          path: ["questions", i, "acceptedAnswers"],
          message: "add at least one answer, with at least one accepted answer",
        });
      }
      // One answer works with or without a blank in the prompt; several must match the blanks.
      if (q.blanks && q.blanks.length > 1 && q.prompt.split(BLANK_RE).length - 1 !== q.blanks.length) {
        ctx.addIssue({
          code: "custom",
          path: ["questions", i, "blanks"],
          message: `the prompt has ${q.prompt.split(BLANK_RE).length - 1} blank(s) (___) but ${q.blanks.length} blank answer list(s)`,
        });
      }
      if (!ids.has(q.topicId)) {
        ctx.addIssue({
          code: "custom",
          path: ["questions", i, "topicId"],
          message: `topicId "${q.topicId}" does not match any topic id`,
        });
      }
    });
  });

export type LeaderboardQuizConfig = z.infer<typeof LeaderboardQuizConfigSchema>;
export type LeaderboardQuizQuestion = LeaderboardQuizConfig["questions"][number];

/** A blank in a prompt is three or more underscores. */
const BLANK_RE = /_{3,}/g;

/**
 * Splits a question's prompt around its blanks for inline answer boxes, or
 * returns null for a plain short-answer prompt. A multi-blank question
 * (`blanks`) splits around every blank; otherwise only the first blank is an
 * input.
 */
export function promptParts(q: Pick<LeaderboardQuizQuestion, "prompt" | "blanks">): string[] | null {
  if (q.blanks && q.blanks.length > 1) {
    const parts = q.prompt.split(BLANK_RE);
    return parts.length === q.blanks.length + 1 ? parts : null;
  }
  const m = /_{3,}/.exec(q.prompt);
  return m ? [q.prompt.slice(0, m.index), q.prompt.slice(m.index + m[0].length)] : null;
}

/** The accepted-answer list for each answer box (one for a single-answer question). */
export function answerLists(q: LeaderboardQuizQuestion): string[][] {
  return q.blanks?.length ? q.blanks.map((b) => b.acceptedAnswers) : [q.acceptedAnswers ?? []];
}

/** Correct only if there is an answer for every box and each matches one of its accepted answers. */
export function isCorrect(q: LeaderboardQuizQuestion, answers: string[]): boolean {
  return answerLists(q).every((list, i) => {
    const given = normalizeAnswer(answers[i] ?? "");
    return given !== "" && list.some((a) => normalizeAnswer(a) === given);
  });
}

/** True once every answer box has something typed in. */
export function isComplete(q: LeaderboardQuizQuestion, answers: string[]): boolean {
  return answerLists(q).every((_, i) => (answers[i] ?? "").trim() !== "");
}

/** The answer shown after a miss: the first accepted answer of each box. */
export function answerText(q: LeaderboardQuizQuestion): string {
  return answerLists(q)
    .map((l) => l[0])
    .join(", ");
}

/**
 * Same normalization on both sides of the comparison: lowercase, strip
 * punctuation, collapse whitespace. Runtime-only; never written back to config.
 */
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
