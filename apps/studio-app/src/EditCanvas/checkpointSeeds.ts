/**
 * Fresh, schema-valid starter configs for activities embedded as checkpoints
 * (course-presentation slide checkpoints, interactive-video timeline
 * checkpoints). Shared so both editors seed identical, always-valid content:
 * an invalid embedded config degrades to an inert marker at runtime, so
 * these must stay in lockstep with the MC / FITB / reflection-prompt schemas.
 */

export type SeedAnswer = { text: string; correct: boolean; feedback?: string };

export type SeedMcConfig = {
  version: string;
  title: string;
  question: string;
  answers: SeedAnswer[];
  [k: string]: unknown;
};

/** A fresh, schema-valid multiple-choice config so a new checkpoint works immediately. */
export function seedMcConfig(): SeedMcConfig {
  return {
    version: "1.0",
    title: "Checkpoint question",
    question: "<p>New question. Edit me.</p>",
    answers: [
      { text: "Correct answer", correct: true },
      { text: "Another option", correct: false },
    ],
  };
}

/** A fresh, schema-valid fill-in-the-blanks config. */
export function seedFitbConfig(): Record<string, unknown> {
  return {
    version: "1.0",
    title: "Checkpoint",
    text: "The capital of France is *Paris*.",
  };
}

/** A fresh, schema-valid reflection-prompt config (open response, ungraded). */
export function seedReflectionConfig(): Record<string, unknown> {
  return {
    version: "1.0",
    title: "Reflection",
    prompt: "<p>Pause and reflect: what stood out to you in this section?</p>",
  };
}
