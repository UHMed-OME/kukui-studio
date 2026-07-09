import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MultipleChoiceConfig } from "@kukui/schemas";
import Component from "./Component.js";
import uiSchema from "./ui-schema.js";

// jsdom rewrites import.meta.url to a non-file scheme, and Vitest's CSS
// handling intercepts `?raw` imports, so resolve from the vitest root
// (repo root) instead — same approach as reflection-prompt.
const css = readFileSync(
  join(process.cwd(), "packages", "activities", "multiple-choice", "Component.css"),
  "utf8",
);

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

describe("Component", () => {
  it("renders title, question and answer buttons", () => {
    render(<Component config={cfgSingle} onSubmit={vi.fn()} />);
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
    render(<Component config={cfgSingle} onSubmit={onSubmit} />);
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
    render(<Component config={cfgSingle} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /carbon dioxide/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(screen.getByText(/co2 fixed in calvin cycle/i)).toBeInTheDocument();
  });

  it("handles multi-correct selection (multiple aria-pressed=true after picks)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfgMulti} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /co2/i }));
    await user.click(screen.getByRole("button", { name: /^h2o/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 2, max: 3, success: false });
  });

  it("Try again returns to the answering stage when enableRetry=true", async () => {
    const user = userEvent.setup();
    render(<Component config={cfgSingle} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /oxygen/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(screen.getByRole("button", { name: /^check$/i })).toBeDisabled();
  });

  it("persists state via onPersist when interactions occur", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(<Component config={cfgSingle} onSubmit={vi.fn()} onPersist={onPersist} />);
    await user.click(screen.getByRole("button", { name: /carbon dioxide/i }));
    expect(onPersist).toHaveBeenCalled();
    const lastCall = onPersist.mock.calls.at(-1);
    expect(lastCall?.[0]).toMatch(/"selected":\[1\]/);
  });

  it("aria-label on each option includes the state", () => {
    render(<Component config={cfgSingle} onSubmit={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /carbon dioxide, not selected/i });
    expect(btn).toBeInTheDocument();
  });

  it("when headingLevel=2 is passed, the title renders as h2 (used by QS / CP nesting)", () => {
    render(<Component config={cfgSingle} onSubmit={vi.fn()} headingLevel={2} />);
    expect(screen.getByRole("heading", { level: 2, name: /photosynthesis/i })).toBeInTheDocument();
  });

  it("randomAnswers shuffles display order but scoring stays by stable identity", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const cfg: MultipleChoiceConfig = {
      ...cfgSingle,
      behaviour: { ...cfgSingle.behaviour, randomAnswers: true },
    };
    render(<Component config={cfg} onSubmit={onSubmit} />);
    // Selecting the correct answer by its accessible name still scores 1/1,
    // regardless of where the shuffle put it in the DOM.
    await user.click(screen.getByRole("button", { name: /carbon dioxide/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 1,
      max: 1,
      success: true,
    });
  });

  it("shows the answer tip next to a selected answer after submit", async () => {
    const user = userEvent.setup();
    const cfg: MultipleChoiceConfig = {
      version: "1.0",
      title: "With tip",
      question: "<p>Pick the right one.</p>",
      answers: [
        {
          text: "Alpha",
          correct: true,
          tip: "Greek letter A is the first.",
        },
        { text: "Beta", correct: false },
      ],
    };
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /alpha/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    const tip = screen.getByText(/greek letter a is the first/i);
    expect(tip).toBeInTheDocument();
    expect(tip.className).toContain("is-visible");
  });

  it("makes the tip visible pre-submit once the answer is selected (not tooltip-only)", async () => {
    const user = userEvent.setup();
    const cfg: MultipleChoiceConfig = {
      version: "1.0",
      title: "With tip",
      question: "<p>Pick the right one.</p>",
      answers: [
        { text: "Alpha", correct: true, tip: "Greek letter A is the first." },
        { text: "Beta", correct: false },
      ],
    };
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    // Tip row is always mounted (layout-stable) but dimmed to invisible
    // until its answer is selected.
    const tip = screen.getByText(/greek letter a is the first/i);
    expect(tip.className).not.toContain("is-visible");
    await user.click(screen.getByRole("button", { name: /alpha/i }));
    expect(tip.className).toContain("is-visible");
    // Deselecting hides it again.
    await user.click(screen.getByRole("button", { name: /alpha/i }));
    expect(tip.className).not.toContain("is-visible");
  });

  it("suspendData passed to onSubmit carries the incremented attempts (no stale spread)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfgSingle} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /carbon dioxide/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    const payload = onSubmit.mock.calls[0]?.[0] as { suspendData: string };
    const suspended = JSON.parse(payload.suspendData) as {
      stage: string;
      attempts: number;
      selected: number[];
    };
    expect(suspended.stage).toBe("submitted");
    expect(suspended.attempts).toBe(1);
    expect(suspended.selected).toEqual([1]);
  });

  it("solution reveal is opt-in: only after pressing the Show solution button", async () => {
    const user = userEvent.setup();
    render(<Component config={cfgSingle} onSubmit={vi.fn()} />);
    // Answer wrongly so the correct answer stays unselected.
    await user.click(screen.getByRole("button", { name: /oxygen/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    // Not auto-revealed at submit.
    expect(
      screen.queryByRole("button", { name: /carbon dioxide, correct, not selected/i }),
    ).not.toBeInTheDocument();
    // No fake "active" hint text either.
    expect(screen.queryByText(/active — correct answers shown above/i)).not.toBeInTheDocument();
    // A real button, labeled with solutionLabel.
    const showBtn = screen.getByRole("button", { name: /^show solution$/i });
    await user.click(showBtn);
    expect(
      screen.getByRole("button", { name: /carbon dioxide, correct, not selected/i }),
    ).toBeInTheDocument();
    // Button disappears once revealed.
    expect(screen.queryByRole("button", { name: /^show solution$/i })).not.toBeInTheDocument();
    // Try again resets the reveal.
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await user.click(screen.getByRole("button", { name: /oxygen/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(
      screen.queryByRole("button", { name: /carbon dioxide, correct, not selected/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^show solution$/i })).toBeInTheDocument();
  });

  it("no Show solution button when enableSolutionsButton is false", async () => {
    const user = userEvent.setup();
    const cfg: MultipleChoiceConfig = {
      ...cfgSingle,
      behaviour: { enableRetry: true, enableSolutionsButton: false },
    };
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /oxygen/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(screen.queryByRole("button", { name: /^show solution$/i })).not.toBeInTheDocument();
  });

  it("shuffled display order is stable across re-renders of the same config", async () => {
    const cfg: MultipleChoiceConfig = {
      ...cfgSingle,
      behaviour: { ...cfgSingle.behaviour, randomAnswers: true },
    };
    const { rerender } = render(<Component config={cfg} onSubmit={vi.fn()} />);
    const order = () =>
      screen
        .getAllByRole("button")
        .filter((b) => b.hasAttribute("aria-pressed"))
        .map((b) => b.textContent);
    const first = order();
    // Re-render with the SAME config object: the displayOrder memo is keyed
    // on config identity, so the shuffle must not regenerate.
    rerender(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(order()).toEqual(first);
  });
});

describe("Component.css tokens", () => {
  it("uses the on-primary token for text on primary fills", () => {
    expect(css).toContain("var(--color-on-primary, #ffffff)");
    expect(css).not.toMatch(/color:\s*#ffffff\s*;/);
  });

  it("has no stale fallback hexes", () => {
    for (const stale of ["#7b4324", "#9b5830", "#dad2c6", "#606069", "#bbae9a"]) {
      expect(css).not.toContain(stale);
    }
    expect(css).toContain("var(--color-primary, #4a7a5f)");
    expect(css).toContain("var(--color-primary-hover, #3f6b52)");
    expect(css).toContain("var(--color-border, #d1d7df)");
    expect(css).toContain("var(--color-text-secondary, #49515b)");
    expect(css).toContain("var(--color-border-hover, #adb6c0)");
  });
});

describe("ui-schema", () => {
  it("inlines the APPEARANCE fragment with the curated Color scheme label", () => {
    const appearance = (uiSchema as Record<string, unknown>).appearance as {
      "ui:title": string;
      theme: { "ui:title": string; "ui:help": string };
    };
    expect(appearance["ui:title"]).toBe("Appearance");
    expect(appearance.theme["ui:title"]).toBe("Color scheme");
    expect(appearance.theme["ui:help"]).toMatch(/auto.*lets the os decide/i);
  });
});
