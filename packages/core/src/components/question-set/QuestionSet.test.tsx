import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { QuestionSetConfig } from "@kukui/schemas";
import { QuestionSet } from "./QuestionSet.js";

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
    render(<QuestionSet config={cfg} onSubmit={vi.fn()} />);
    expect(screen.getByText(/Question 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: /q1/i })).toBeInTheDocument();
  });

  it("Submit set is disabled until both questions are answered", async () => {
    const user = userEvent.setup();
    render(<QuestionSet config={cfg} onSubmit={vi.fn()} />);
    const submit = screen.getByRole("button", { name: /submit set/i });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: /jupiter/i }));
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
    render(<QuestionSet config={cfg} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("radio", { name: /jupiter/i }));
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
    render(<QuestionSet config={cfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("radio", { name: /earth/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.type(screen.getByRole("textbox"), "AU");
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    await user.click(screen.getByRole("button", { name: /submit set/i }));
    await user.click(screen.getByRole("button", { name: /try again/i }));
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
    render(<QuestionSet config={broken} onSubmit={vi.fn()} />);
    expect(screen.getByText(/Question 1 of 1/i)).toBeInTheDocument();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("persists state via onPersist on each interaction", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(<QuestionSet config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />);
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(onPersist).toHaveBeenCalled();
    const last = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(last).toMatch(/"current":1/);
  });
});
