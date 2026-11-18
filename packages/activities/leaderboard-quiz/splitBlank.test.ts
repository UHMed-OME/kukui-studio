import { describe, expect, it } from "vitest";
import { LeaderboardQuizConfigSchema, answerText, isCorrect, promptParts, type LeaderboardQuizConfig } from "./schema.js";
import starter from "./starter.js";

type Q = LeaderboardQuizConfig["questions"][number];
const single: Q = { id: "s", topicId: "general", prompt: "The ___ pumps blood.", acceptedAnswers: ["heart"] };
const multi: Q = {
  id: "m",
  topicId: "general",
  prompt: "The ___ ventricle pumps blood to the ___.",
  blanks: [{ acceptedAnswers: ["left"] }, { acceptedAnswers: ["body", "aorta"] }],
};

describe("promptParts", () => {
  it("single-answer: splits around the first blank; plain prompts give null", () => {
    expect(promptParts(single)).toEqual(["The ", " pumps blood."]);
    expect(promptParts({ prompt: "Heart attack?" })).toBeNull();
    expect(promptParts({ prompt: "snake__case" })).toBeNull();
  });
  it("multi-blank: splits around every blank", () => {
    expect(promptParts(multi)).toEqual(["The ", " ventricle pumps blood to the ", "."]);
  });
});

describe("isCorrect / answerText", () => {
  it("multi-blank needs every blank right; any accepted answer per blank counts", () => {
    expect(isCorrect(multi, ["Left", "aorta"])).toBe(true);
    expect(isCorrect(multi, ["left", "body"])).toBe(true);
    expect(isCorrect(multi, ["right", "body"])).toBe(false);
    expect(isCorrect(multi, ["left"])).toBe(false);
    expect(answerText(multi)).toBe("left, body");
  });
  it("single-answer still works", () => {
    expect(isCorrect(single, [" Heart. "])).toBe(true);
    expect(isCorrect(single, [""])).toBe(false);
  });
});

describe("schema", () => {
  const base = { ...starter };
  const parse = (q: object) => LeaderboardQuizConfigSchema.safeParse({ ...base, questions: [q] });
  it("accepts a multi-blank question and rejects mismatches", () => {
    expect(parse(multi).success).toBe(true);
    expect(parse({ ...multi, prompt: "Only one ___ here." }).success).toBe(false); // 1 blank, 2 lists
    expect(parse({ id: "n", topicId: "general", prompt: "No answers" }).success).toBe(false); // no answers at all
    // A single answer works with or without a blank in the prompt.
    expect(parse({ id: "p", topicId: "general", prompt: "Plain?", blanks: [{ acceptedAnswers: ["x"] }] }).success).toBe(true);
    expect(parse({ ...single, blanks: [{ acceptedAnswers: ["heart"] }], acceptedAnswers: undefined }).success).toBe(true);
  });
});
