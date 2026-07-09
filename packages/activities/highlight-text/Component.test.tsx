import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { HighlightTextConfig } from "./schema.js";
import Component from "./Component.js";

const cfg: HighlightTextConfig = {
  version: "1.0",
  title: "Verbs",
  prompt: "<p>Highlight the <strong>verbs</strong> in this sentence.</p>",
  tokens: [
    { id: "t0", text: "She", correct: false },
    { id: "t1", text: "ran", correct: true },
    { id: "t2", text: "to", correct: false },
    { id: "t3", text: "the", correct: false },
    { id: "t4", text: "store", correct: false },
    { id: "t5", text: "and", correct: false },
    { id: "t6", text: "bought", correct: true },
    { id: "t7", text: "milk", correct: false, separator: "." },
  ],
  behaviour: { enableRetry: true },
  ui: { checkAnswerButton: "Check", tryAgainButton: "Try again" },
};

describe("HighlightText", () => {
  it("renders title, prompt and a button per token", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /verbs/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/highlight the/i)).toBeInTheDocument();
    const tokens = screen
      .getAllByRole("button")
      .filter((b) => b.hasAttribute("aria-pressed"));
    expect(tokens).toHaveLength(cfg.tokens.length);
  });

  it("clicking a token toggles its highlighted/aria-pressed state", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    const ran = screen.getByRole("button", { name: /^ran,/i });
    expect(ran).toHaveAttribute("aria-pressed", "false");
    await user.click(ran);
    expect(ran).toHaveAttribute("aria-pressed", "true");
    await user.click(ran);
    expect(ran).toHaveAttribute("aria-pressed", "false");
  });

  it("partial credit: 1 correct + 1 wrong token nets raw=0/max=2 (default scoring)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /^ran,/i })); // correct
    await user.click(screen.getByRole("button", { name: /^the,/i })); // wrong
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    // scoreSelection: earned = +1 (ran) - 1 (the) = 0, clamped at 0; max = 2 correct.
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 0,
      max: 2,
      success: false,
    });
  });

  it("all-correct selection produces success=true and shows the score", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /^ran,/i }));
    await user.click(screen.getByRole("button", { name: /^bought,/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 2,
      max: 2,
      success: true,
    });
    expect(screen.getByText(/all correct tokens highlighted/i)).toBeInTheDocument();
  });

  it("Try again clears selections and returns to the answering stage", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^the,/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(screen.getByRole("button", { name: /^check$/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /^the, not highlighted/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("persists state via onPersist when interactions occur", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(
      <Component config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />,
    );
    await user.click(screen.getByRole("button", { name: /^ran,/i }));
    expect(onPersist).toHaveBeenCalled();
    const lastCall = onPersist.mock.calls.at(-1);
    expect(lastCall?.[0]).toMatch(/"selected":\["t1"\]/);
  });

  it("singlePoint behaviour scores all-or-nothing", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const sp: HighlightTextConfig = {
      ...cfg,
      behaviour: { ...cfg.behaviour, singlePoint: true },
    };
    render(<Component config={sp} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /^ran,/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 0,
      max: 1,
      success: false,
    });
  });

  it("after submit, unselected correct tokens get the reveal class (dashed)", async () => {
    const user = userEvent.setup();
    const withSolutions: HighlightTextConfig = {
      ...cfg,
      behaviour: { ...cfg.behaviour, showSolutionsButton: true },
    };
    render(<Component config={withSolutions} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^ran,/i })); // got one
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    // Not auto-revealed at submit: reveal is opt-in.
    expect(
      screen.queryByRole("button", { name: /^bought, not highlighted, was correct/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^show solution$/i }));
    const missed = screen.getByRole("button", {
      name: /^bought, not highlighted, was correct/i,
    });
    expect(missed.className).toMatch(/is-reveal/);
    // The reveal treatment is a dashed border at constant width (not
    // color-only, not a reflow).
    const css = readFileSync(
      join(process.cwd(), "packages", "activities", "highlight-text", "Component.css"),
      "utf8",
    );
    expect(css).toMatch(/\.kukui-ht__token\.is-reveal\s*\{[^}]*border-style:\s*dashed/);
  });

  it("no Show solution button when showSolutionsButton is not enabled", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^ran,/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(
      screen.queryByRole("button", { name: /^show solution$/i }),
    ).not.toBeInTheDocument();
  });

  it("suspendData passed to onSubmit carries the incremented attempts", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /^ran,/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    const payload = onSubmit.mock.calls[0]?.[0] as { suspendData: string };
    const suspended = JSON.parse(payload.suspendData) as { stage: string; attempts: number };
    expect(suspended.stage).toBe("submitted");
    expect(suspended.attempts).toBe(1);
  });

  it("stylesheet uses on-primary and canonical token fallbacks", () => {
    const css = readFileSync(
      join(process.cwd(), "packages", "activities", "highlight-text", "Component.css"),
      "utf8",
    );
    expect(css).toContain("color: var(--color-on-primary, #ffffff)");
    expect(css).not.toMatch(/color:\s*#ffffff\s*;/);
    for (const stale of ["#dad2c6", "#bbae9a", "#7b4324", "#9b5830", "#1c1e20"]) {
      expect(css).not.toContain(stale);
    }
    expect(css).toContain("var(--color-primary, #4a7a5f)");
    expect(css).toContain("var(--color-primary-hover, #3f6b52)");
    expect(css).toContain("var(--color-border, #d1d7df)");
    expect(css).toContain("var(--color-border-hover, #adb6c0)");
  });
});
