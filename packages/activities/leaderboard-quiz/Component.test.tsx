import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Component from "./Component.js";
import { LeaderboardQuizConfigSchema, type LeaderboardQuizConfig } from "./schema.js";
import starter from "./starter.js";

const cfg = LeaderboardQuizConfigSchema.parse({
  ...starter,
  questions: [
    {
      id: "q1",
      topicId: "general",
      prompt: "Heart attack?",
      acceptedAnswers: ["myocardial infarction", "MI"],
    },
  ],
  round: { questionCount: 1, shuffle: false, timeLimitSeconds: 30 },
}) as LeaderboardQuizConfig;

describe("LeaderboardQuiz", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => vi.useRealTimers());

  it("renders the title and a Start button", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: /leaderboard quiz/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start/i })).toBeEnabled();
  });

  it("scores a normalized synonym as correct and submits after the last question", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /start/i }));
    await user.type(screen.getByRole("textbox", { name: /your answer/i }), " m.i. ");
    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/correct/i);
    // Feedback waits for the learner; it does not auto-advance.
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 10, max: 10, success: true });
    expect(JSON.parse(localStorage.getItem("leaderboardquiz:Leaderboard Quiz")!)).toMatchObject({
      bestScore: 10,
      attempts: 1,
    });
  });

  it("lets the learner turn the time limit off", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("checkbox", { name: /no time limit/i }));
    await user.click(screen.getByRole("button", { name: /start/i }));
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits when the timer runs out", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /start/i }));
    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 0, max: 10, success: false });
    expect(screen.getByText(/time's up/i)).toBeInTheDocument();
  });

  it("puts the answer box inline where a ___ blank is, and scores it", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSubmit = vi.fn();
    const blankCfg = {
      ...cfg,
      questions: [{ id: "b1", topicId: "general", prompt: "Blood leaves the heart via the ___.", acceptedAnswers: ["aorta"] }],
    } as LeaderboardQuizConfig;
    render(<Component config={blankCfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /start/i }));
    const input = screen.getByRole("textbox", { name: /your answer/i });
    expect(input.parentElement).toHaveTextContent("Blood leaves the heart via the .");
    await user.type(input, "Aorta");
    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/correct/i);
  });

  it("multi-blank: one inline box per blank, correct only when all are right", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const multiCfg = {
      ...cfg,
      questions: [
        {
          id: "m1",
          topicId: "general",
          prompt: "The ___ ventricle pumps blood to the ___.",
          blanks: [{ acceptedAnswers: ["left"] }, { acceptedAnswers: ["body", "aorta"] }],
        },
      ],
    } as LeaderboardQuizConfig;
    render(<Component config={multiCfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /start/i }));
    expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Blank 1" }), "Left");
    expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Blank 2" }), "aorta");
    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/correct/i);
  });
});
