import { describe, expect, it } from "vitest";
import { systemPromptFor } from "./index.js";

describe("systemPromptFor", () => {
  it("tells flashcards AI to put prompts on fronts and answers on backs", () => {
    const prompt = systemPromptFor("flashcards");

    expect(prompt).toContain("Front = the recall prompt");
    expect(prompt).toContain("WITHOUT revealing the answer");
    expect(prompt).toContain("Back = the answer plus brief explanation");
    expect(prompt).not.toContain("Front = a terse cue");
  });
});
