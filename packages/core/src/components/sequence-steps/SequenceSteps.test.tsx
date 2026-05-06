import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SequenceStepsConfig } from "@kukui/schemas";
import { SequenceSteps } from "./SequenceSteps.js";

/**
 * Tests target the keyboard / button-driven reorder path. Pointer-driven
 * dnd-kit reorders rely on layout measurements jsdom doesn't provide, so we
 * exercise the same state transitions through the explicit Up / Down nudge
 * controls (which are also the screen-reader / keyboard-only fallback).
 */

const cfg: SequenceStepsConfig = {
  version: "1.0",
  title: "Mitosis stages",
  prompt: "<p>Order the stages of mitosis from first to last.</p>",
  steps: [
    { id: "s1", text: "Prophase" },
    { id: "s2", text: "Metaphase" },
    { id: "s3", text: "Anaphase" },
    { id: "s4", text: "Telophase" },
  ],
  // Disable randomize so the initial order is deterministic for assertions.
  behaviour: { enableRetry: true, randomize: false },
};

const cfgRandomized: SequenceStepsConfig = {
  ...cfg,
  behaviour: { enableRetry: true, randomize: true },
};

const cfgSinglePoint: SequenceStepsConfig = {
  ...cfg,
  behaviour: { enableRetry: true, randomize: false, singlePoint: true },
};

function readOrder(): string[] {
  // Each item's accessible label starts with "Step: <text>, ..."
  return screen
    .getAllByRole("button", { name: /^Step:/i })
    .map((b) => b.getAttribute("aria-label") ?? "")
    .map((l) => l.replace(/^Step:\s*/, "").split(",")[0]?.trim() ?? "");
}

describe("SequenceSteps", () => {
  it("renders title, prompt, and one row per step with index badges 1..N", () => {
    render(<SequenceSteps config={cfg} onSubmit={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: /mitosis/i })).toBeInTheDocument();
    expect(screen.getByText(/order the stages of mitosis/i)).toBeInTheDocument();
    const rows = screen.getAllByRole("button", { name: /^Step:/i });
    expect(rows).toHaveLength(4);
    // With randomize=false the initial visible order matches the config order.
    expect(readOrder()).toEqual(["Prophase", "Metaphase", "Anaphase", "Telophase"]);
  });

  it("reordering via the keyboard-accessible nudge buttons updates the visible order", async () => {
    const user = userEvent.setup();
    render(<SequenceSteps config={cfg} onSubmit={vi.fn()} />);
    // Move "Telophase" (last) up twice → ends up at index 1.
    await user.click(screen.getByRole("button", { name: /move "telophase" up/i }));
    await user.click(screen.getByRole("button", { name: /move "telophase" up/i }));
    expect(readOrder()).toEqual(["Prophase", "Telophase", "Metaphase", "Anaphase"]);
  });

  it("submitting in the correct order scores full credit and reports success", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    // randomize=false → already in correct order.
    render(<SequenceSteps config={cfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 4, max: 4, success: true });
  });

  it("partial-correct order scores partial credit per item in correct position", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SequenceSteps config={cfg} onSubmit={onSubmit} />);
    // Swap rows 1 and 2 → Metaphase, Prophase, Anaphase, Telophase.
    // Prophase (idx 0 → 1, wrong), Metaphase (idx 1 → 0, wrong),
    // Anaphase (idx 2 → 2, right), Telophase (idx 3 → 3, right) = 2/4.
    await user.click(screen.getByRole("button", { name: /move "metaphase" up/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 2, max: 4, success: false });
    // Check feedback strings appear for incorrect items.
    expect(screen.getByText(/2 of 4 steps in the correct position/i)).toBeInTheDocument();
    // And per-item "correct position" hints rendered for the wrong rows.
    expect(screen.getAllByText(/correct position: #/i).length).toBeGreaterThanOrEqual(2);
  });

  it("singlePoint behaviour scores 0/1 unless every step is correct", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SequenceSteps config={cfgSinglePoint} onSubmit={onSubmit} />);
    // Move Telophase up by 1 → wrong order.
    await user.click(screen.getByRole("button", { name: /move "telophase" up/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 0, max: 1, success: false });
  });

  it("Try again returns to the answering stage with a fresh shuffle (different from correct order)", async () => {
    const user = userEvent.setup();
    // Use the deterministic-initial config but allow retry to randomize.
    render(<SequenceSteps config={cfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    // Submitted state — Check is gone, Try again is shown.
    expect(screen.queryByRole("button", { name: /^check$/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /try again/i }));
    // Back to answering — Check is shown again.
    expect(screen.getByRole("button", { name: /^check$/i })).toBeInTheDocument();
    // The shuffled order on retry must differ from the correct order.
    const order = readOrder();
    expect(order).not.toEqual(["Prophase", "Metaphase", "Anaphase", "Telophase"]);
  });

  it("persists state via onPersist on each reorder", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(<SequenceSteps config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />);
    onPersist.mockClear();
    await user.click(screen.getByRole("button", { name: /move "telophase" up/i }));
    expect(onPersist).toHaveBeenCalled();
    const last = onPersist.mock.calls.at(-1)?.[0] as string;
    // Telophase should now appear at index 2 (after one up-move from the tail).
    expect(last).toMatch(/"order":\["s1","s2","s4","s3"\]/);
  });

  it("resumes from a valid suspendData payload", () => {
    const valid = JSON.stringify({
      stage: "answering",
      order: ["s4", "s3", "s2", "s1"],
      attempts: 2,
    });
    const { unmount } = render(
      <SequenceSteps config={cfg} onSubmit={vi.fn()} suspendData={valid} />,
    );
    expect(readOrder()).toEqual(["Telophase", "Anaphase", "Metaphase", "Prophase"]);
    unmount();
  });

  it("falls back to the initial order when suspendData is invalid JSON", () => {
    render(<SequenceSteps config={cfg} onSubmit={vi.fn()} suspendData={"{not json"} />);
    expect(readOrder()).toEqual(["Prophase", "Metaphase", "Anaphase", "Telophase"]);
  });

  it("rejects suspendData whose ids don't match the current config", () => {
    const stale = JSON.stringify({
      stage: "answering",
      // Different id set — should be rejected and the initial order rendered.
      order: ["x1", "x2", "x3", "x4"],
      attempts: 0,
    });
    render(<SequenceSteps config={cfg} onSubmit={vi.fn()} suspendData={stale} />);
    expect(readOrder()).toEqual(["Prophase", "Metaphase", "Anaphase", "Telophase"]);
  });

  it("renders an initial order distinct from the correct order when randomize=true", () => {
    // Run a few times to dodge a 1-in-many rare identity shuffle (the
    // implementation re-shuffles up to 6 times to avoid this).
    for (let i = 0; i < 3; i += 1) {
      const { unmount } = render(<SequenceSteps config={cfgRandomized} onSubmit={vi.fn()} />);
      const order = readOrder();
      expect(order).not.toEqual(["Prophase", "Metaphase", "Anaphase", "Telophase"]);
      unmount();
    }
  });

  it("when headingLevel=2 is passed, the title renders as h2 (used by QS / CP nesting)", () => {
    render(<SequenceSteps config={cfg} onSubmit={vi.fn()} headingLevel={2} />);
    expect(screen.getByRole("heading", { level: 2, name: /mitosis/i })).toBeInTheDocument();
  });

  it("after submit, each row's badge announces correct vs. correct-position hint", async () => {
    const user = userEvent.setup();
    render(<SequenceSteps config={cfg} onSubmit={vi.fn()} />);
    // Swap rows 1 and 2 so 2/4 are wrong.
    await user.click(screen.getByRole("button", { name: /move "metaphase" up/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    // The two right rows show "Correct"; the two wrong rows show #N hints.
    const list = screen.getByRole("list");
    expect(within(list).getAllByText(/^Correct$/i)).toHaveLength(2);
    expect(within(list).getAllByText(/Correct position: #/i)).toHaveLength(2);
  });
});
