import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MultipleChoiceConfig } from "@kukui/schemas";
import { MultipleChoice } from "./MultipleChoice.js";

const cfgSingle: MultipleChoiceConfig = {
  version: "1.0",
  title: "Photosynthesis",
  question: "<p>Which gas do plants take in?</p>",
  answers: [
    { text: "Oxygen", correct: false, feedback: "Plants release O2." },
    { text: "Carbon dioxide", correct: true, feedback: "Yes — CO2 fixed in Calvin cycle." },
    { text: "Nitrogen", correct: false, feedback: "Mostly inert." },
  ],
  behaviour: { enableRetry: true, enableSolutionsButton: true },
};

const cfgMulti: MultipleChoiceConfig = {
  version: "1.0",
  title: "Inputs",
  question: "<p>Photosynthesis inputs?</p>",
  answers: [
    { text: "CO2", correct: true },
    { text: "H2O", correct: true },
    { text: "Sunlight", correct: true },
    { text: "Glucose", correct: false },
  ],
};

describe("MultipleChoice", () => {
  it("renders title, question and answer buttons", () => {
    render(<MultipleChoice config={cfgSingle} onSubmit={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: /photosynthesis/i })).toBeInTheDocument();
    expect(screen.getByText(/which gas do plants take in/i)).toBeInTheDocument();
    // 3 answer buttons + Check (4 total). Filter by aria-pressed to count answers.
    const answers = screen
      .getAllByRole("button")
      .filter((b) => b.hasAttribute("aria-pressed"));
    expect(answers).toHaveLength(3);
  });

  it("disables Check until something is selected, then submits and posts a score", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<MultipleChoice config={cfgSingle} onSubmit={onSubmit} />);
    const check = screen.getByRole("button", { name: /^check$/i });
    expect(check).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /carbon dioxide/i }));
    expect(check).toBeEnabled();
    await user.click(check);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 1, max: 1, success: true });
  });

  it("shows feedback inline below the chosen answer after submit", async () => {
    const user = userEvent.setup();
    render(<MultipleChoice config={cfgSingle} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /carbon dioxide/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(screen.getByText(/co2 fixed in calvin cycle/i)).toBeInTheDocument();
  });

  it("handles multi-correct selection (multiple aria-pressed=true after picks)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<MultipleChoice config={cfgMulti} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /co2/i }));
    await user.click(screen.getByRole("button", { name: /^h2o/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 2, max: 3, success: false });
  });

  it("Try again returns to the answering stage when enableRetry=true", async () => {
    const user = userEvent.setup();
    render(<MultipleChoice config={cfgSingle} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /oxygen/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(screen.getByRole("button", { name: /^check$/i })).toBeDisabled();
  });

  it("persists state via onPersist when interactions occur", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(<MultipleChoice config={cfgSingle} onSubmit={vi.fn()} onPersist={onPersist} />);
    await user.click(screen.getByRole("button", { name: /carbon dioxide/i }));
    expect(onPersist).toHaveBeenCalled();
    const lastCall = onPersist.mock.calls.at(-1);
    expect(lastCall?.[0]).toMatch(/"selected":\[1\]/);
  });

  it("aria-label on each option includes the state", () => {
    render(<MultipleChoice config={cfgSingle} onSubmit={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /carbon dioxide, not selected/i });
    expect(btn).toBeInTheDocument();
  });

  it("when headingLevel=2 is passed, the title renders as h2 (used by QS / CP nesting)", () => {
    render(<MultipleChoice config={cfgSingle} onSubmit={vi.fn()} headingLevel={2} />);
    expect(screen.getByRole("heading", { level: 2, name: /photosynthesis/i })).toBeInTheDocument();
  });
});
