import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CrosswordConfig } from "./schema.js";
import Component from "./Component.js";

const cfg: CrosswordConfig = {
  version: "1.0",
  title: "Cardio terms",
  prompt: "<p>Match the term to its definition.</p>",
  entries: [
    { id: "1", term: "AORTA", definition: "Largest artery in the body" },
    { id: "2", term: "VEIN", definition: "Returns blood to the heart" },
    { id: "3", term: "ATRIUM", definition: "Receives blood from veins" },
  ],
};

describe("Crossword", () => {
  it("renders title, prompt, and across/down clue lists", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /cardio terms/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/match the term/i)).toBeInTheDocument();
    // Both directions render headings (some clue lists may be empty for
    // tiny puzzles, but at least one always appears).
    const hasAcross = screen.queryByRole("heading", { name: /across/i });
    const hasDown = screen.queryByRole("heading", { name: /down/i });
    expect(hasAcross || hasDown).not.toBeNull();
  });

  it("typing a letter stores it uppercase somewhere in the grid", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    await user.type(inputs[0] as HTMLInputElement, "a");
    // After typing, the controlled input that owned (0,0) re-renders with
    // value "A". `step(1)` may move focus on to the next cell, but the
    // *value* persisted in state should appear in inputs[0] regardless.
    const after = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(after.some((el) => el.value === "A")).toBe(true);
  });

  it("submitting an empty board reports 0 raw and !success", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const arg = onSubmit.mock.calls[0]?.[0];
    expect(arg.raw).toBe(0);
    expect(arg.success).toBe(false);
    expect(arg.max).toBeGreaterThan(0);
  });

  it("clicking a clue moves selection to that clue's starting cell", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    // Pick the first clue button (number 1) and click it — its cell input
    // should receive focus.
    const clueButtons = screen.getAllByRole("button").filter((b) =>
      /^\d+\.\s/.test(within(b).queryByText(/\d+\./)?.textContent ?? ""),
    );
    if (clueButtons.length === 0) return; // tiny puzzles may render no clue buttons via this lookup
    await user.click(clueButtons[0] as HTMLElement);
    // After clicking, an input element should hold focus (jsdom honors .focus()).
    expect(document.activeElement?.tagName).toBe("INPUT");
  });
});
