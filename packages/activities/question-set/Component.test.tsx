import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { QuestionSetConfig } from "./schema.js";
import Component from "./Component.js";

const cfg: QuestionSetConfig = {
  version: "1.0",
  title: "Quick check",
  questions: [
    {
      type: "multipleChoice",
      config: {
        version: "1.0",
        title: "Q1",
        question: "<p>Largest planet?</p>",
        answers: [
          { text: "Earth", correct: false },
          { text: "Jupiter", correct: true },
        ],
      },
    },
    {
      type: "fillInTheBlanks",
      config: {
        version: "1.0",
        title: "Q2",
        text: "An *AU* is the Earth-Sun distance.",
      },
    },
  ],
  passPercentage: 50,
  behaviour: { enableRetry: true, showProgressBar: true },
};

describe("QuestionSet", () => {
  it("renders the first question and a progress indicator", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(screen.getByText(/Question 1 of 2/i)).toBeInTheDocument();
    // Embedded MC renders as h2 inside Question Set (heading hierarchy).
    expect(screen.getByRole("heading", { level: 2, name: /q1/i })).toBeInTheDocument();
  });

  it("Submit set is disabled until both questions are answered", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    const submit = screen.getByRole("button", { name: /submit set/i });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /jupiter/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /next/i }));
    const fibInput = screen.getByRole("textbox");
    await user.type(fibInput, "AU");
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(submit).toBeEnabled();
  });

  it("Submit set aggregates with weighted percent and triggers onSubmit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /jupiter/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));
    const fibInput = screen.getByRole("textbox");
    await user.type(fibInput, "AU");
    await user.click(screen.getByRole("button", { name: /^check$/i }));

    await user.click(screen.getByRole("button", { name: /submit set/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const call = onSubmit.mock.calls[0]?.[0];
    expect(call?.success).toBe(true);
    expect(call?.max).toBeGreaterThan(0);
  });

  it("Try again resets state when enableRetry=true", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /earth/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.type(screen.getByRole("textbox"), "AU");
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    await user.click(screen.getByRole("button", { name: /submit set/i }));
    // Both the set-level results row and the restored child render a
    // retry control; this test drives the set-level one.
    const retries = screen.getAllByRole("button", { name: /try again/i });
    const setRetry = retries.find((b) => b.className.includes("kukui-qs__"));
    expect(setRetry).toBeDefined();
    await user.click(setRetry!);
    expect(screen.getByText(/Question 1 of 2/i)).toBeInTheDocument();
  });

  it("invalid nested config skipped without crashing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const broken: QuestionSetConfig = {
      version: "1.0",
      title: "Mixed",
      questions: [
        {
          type: "multipleChoice",
          // @ts-expect-error intentionally malformed
          config: { version: "1.0", title: "broken" },
        },
        {
          type: "multipleChoice",
          config: {
            version: "1.0",
            title: "Good",
            question: "<p>Q?</p>",
            answers: [
              { text: "Yes", correct: true },
              { text: "No", correct: false },
            ],
          },
        },
      ],
    };
    render(<Component config={broken} onSubmit={vi.fn()} />);
    expect(screen.getByText(/Question 1 of 1/i)).toBeInTheDocument();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("randomQuestions shuffles display order, stable across re-renders", () => {
    // Pin the per-mount seed: Math.random() -> 0 means seed 0, and
    // shuffleIndices(2, 0) yields [1, 0] — Q2 displays first.
    const rand = vi.spyOn(Math, "random").mockReturnValue(0);
    const cfgShuffled: QuestionSetConfig = {
      ...cfg,
      behaviour: { ...cfg.behaviour, randomQuestions: true },
    };
    const { rerender } = render(<Component config={cfgShuffled} onSubmit={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 2, name: /q2/i })).toBeInTheDocument();
    // Re-render with the same props: order must not re-shuffle.
    rerender(<Component config={cfgShuffled} onSubmit={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 2, name: /q2/i })).toBeInTheDocument();
    rand.mockRestore();
  });

  it("randomQuestions keeps scoring by stable identity", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const cfgShuffled: QuestionSetConfig = {
      ...cfg,
      behaviour: { ...cfg.behaviour, randomQuestions: true },
    };
    render(<Component config={cfgShuffled} onSubmit={onSubmit} />);
    // Answer both questions by content, regardless of display order.
    for (let i = 0; i < 2; i += 1) {
      const jupiter = screen.queryByRole("button", { name: /jupiter/i });
      if (jupiter) {
        await user.click(jupiter);
      } else {
        await user.type(screen.getByRole("textbox"), "AU");
      }
      await user.click(screen.getByRole("button", { name: /^check$/i }));
      if (i === 0) await user.click(screen.getByRole("button", { name: /next/i }));
    }
    await user.click(screen.getByRole("button", { name: /submit set/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ success: true });
  });

  it("clamps an out-of-range suspended `current` to the last question", () => {
    const suspend = JSON.stringify({ stage: "answering", scores: {}, current: 99, attempts: 0 });
    render(<Component config={cfg} onSubmit={vi.fn()} suspendData={suspend} />);
    expect(screen.getByText(/Question 2 of 2/i)).toBeInTheDocument();
  });

  it("per-question state survives Previous/Next navigation", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    // Answer Q1.
    await user.click(screen.getByRole("button", { name: /jupiter/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    // Navigate away and back.
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByRole("heading", { level: 2, name: /q2/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /previous/i }));
    // Q1 is still in its submitted state: the selection was not lost.
    expect(
      screen.getByRole("button", { name: /jupiter, correct/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^check$/i })).not.toBeInTheDocument();
  });

  it("includes child suspend strings in the set's own persisted payload", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(<Component config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />);
    await user.click(screen.getByRole("button", { name: /jupiter/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    const last = onPersist.mock.calls.at(-1)?.[0] as string;
    const parsed = JSON.parse(last) as { childSuspend: Record<string, string> };
    expect(typeof parsed.childSuspend?.["0"]).toBe("string");
    expect(JSON.parse(parsed.childSuspend["0"]!)).toMatchObject({
      stage: "submitted",
      selected: [1],
    });
  });

  it("post-submit re-answers do not mutate the recorded scores", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const retryChildren: QuestionSetConfig = {
      ...cfg,
      questions: [
        {
          type: "multipleChoice",
          config: {
            version: "1.0",
            title: "Q1",
            question: "<p>Largest planet?</p>",
            answers: [
              { text: "Earth", correct: false },
              { text: "Jupiter", correct: true },
            ],
            behaviour: { enableRetry: true },
          },
        },
      ],
      behaviour: { enableRetry: true, showProgressBar: true, showResults: true },
    };
    const { container } = render(<Component config={retryChildren} onSubmit={onSubmit} />);
    // Answer wrong, submit the set.
    await user.click(screen.getByRole("button", { name: /earth/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    await user.click(screen.getByRole("button", { name: /submit set/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ success: false });
    // Re-answer via the CHILD's own Try again (inside the body), not the
    // set-level one in the nav.
    const body = container.querySelector(".kukui-qs__body") as HTMLElement;
    await user.click(within(body).getByRole("button", { name: /try again/i }));
    await user.click(within(body).getByRole("button", { name: /jupiter/i }));
    await user.click(within(body).getByRole("button", { name: /^check$/i }));
    // The recorded (reported) result must still be the failing one.
    expect(screen.getByText(/^review$/i)).toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // The per-question results row still shows the original failing score.
    expect(screen.getByText(/0 \/ 1/)).toBeInTheDocument();
  });

  it("results heading derives from headingLevel", async () => {
    const user = userEvent.setup();
    const withResults: QuestionSetConfig = {
      ...cfg,
      behaviour: { ...cfg.behaviour, showResults: true },
    };
    render(<Component config={withResults} onSubmit={vi.fn()} headingLevel={2} />);
    await user.click(screen.getByRole("button", { name: /jupiter/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.type(screen.getByRole("textbox"), "AU");
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    await user.click(screen.getByRole("button", { name: /submit set/i }));
    expect(
      screen.getByRole("heading", { level: 3, name: /per-question results/i }),
    ).toBeInTheDocument();
  });

  it("ignores malformed scores entries in suspendData", () => {
    const suspend = JSON.stringify({
      stage: "answering",
      scores: { 0: { raw: "oops" }, 7: { raw: 1, max: 1, success: true }, 1: null },
      childSuspend: { 0: 42 },
      current: 0,
      attempts: 0,
    });
    render(<Component config={cfg} onSubmit={vi.fn()} suspendData={suspend} />);
    // Malformed entries dropped: nothing counts as answered yet.
    expect(screen.getByText(/answered 0 of 2/i)).toBeInTheDocument();
  });

  it("persists state via onPersist on each interaction", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(<Component config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />);
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(onPersist).toHaveBeenCalled();
    const last = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(last).toMatch(/"current":1/);
  });
});
