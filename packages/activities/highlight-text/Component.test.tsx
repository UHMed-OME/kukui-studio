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
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^ran,/i })); // got one
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    const missed = screen.getByRole("button", {
      name: /^bought, not highlighted, was correct/i,
    });
    expect(missed.className).toMatch(/is-reveal/);
  });
});
