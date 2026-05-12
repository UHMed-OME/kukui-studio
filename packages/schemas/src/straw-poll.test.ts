import { describe, expect, it } from "vitest";
import { StrawPollConfigSchema } from "./straw-poll.js";

describe("StrawPollConfigSchema", () => {
  it("accepts a minimal valid config", () => {
    const result = StrawPollConfigSchema.safeParse({
      version: "1.0",
      title: "Pulse check",
      prompt: "How are you?",
      choices: [
        { id: "a", label: "Good" },
        { id: "b", label: "Bad" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects fewer than 2 choices", () => {
    const result = StrawPollConfigSchema.safeParse({
      version: "1.0",
      title: "x",
      prompt: "x",
      choices: [{ id: "a", label: "Only one" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 8 choices", () => {
    const choices = Array.from({ length: 9 }, (_, i) => ({
      id: `c${i}`,
      label: `Choice ${i}`,
    }));
    const result = StrawPollConfigSchema.safeParse({
      version: "1.0",
      title: "x",
      prompt: "x",
      choices,
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate choice ids", () => {
    const result = StrawPollConfigSchema.safeParse({
      version: "1.0",
      title: "x",
      prompt: "x",
      choices: [
        { id: "a", label: "A" },
        { id: "a", label: "Also A" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty labels and prompts", () => {
    expect(
      StrawPollConfigSchema.safeParse({
        version: "1.0",
        title: "x",
        prompt: "",
        choices: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
      }).success,
    ).toBe(false);
    expect(
      StrawPollConfigSchema.safeParse({
        version: "1.0",
        title: "x",
        prompt: "x",
        choices: [
          { id: "a", label: "" },
          { id: "b", label: "B" },
        ],
      }).success,
    ).toBe(false);
  });

  it("accepts optional behaviour and ui overrides", () => {
    const result = StrawPollConfigSchema.safeParse({
      version: "1.0",
      title: "x",
      prompt: "x",
      choices: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      behaviour: {
        showLiveResultsToStudents: false,
        allowChangeVote: false,
        showIndividualVotes: true,
      },
      ui: {
        openPollButton: "Go",
        closePollButton: "Stop",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects strict-mode extras", () => {
    const result = StrawPollConfigSchema.safeParse({
      version: "1.0",
      title: "x",
      prompt: "x",
      choices: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      mystery: "extra",
    });
    expect(result.success).toBe(false);
  });
});
