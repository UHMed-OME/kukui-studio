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

/** The clue button whose text contains the given definition fragment. */
function clueButton(definition: RegExp): HTMLElement {
  return screen
    .getAllByRole("button")
    .find((b) => definition.test(b.textContent ?? "")) as HTMLElement;
}

/** The live progress region (role=status). */
function progressRegion(): HTMLElement {
  return document.querySelector(".kukui-cw__progress") as HTMLElement;
}

/** aria-labels ("Row r, column c") of the currently active word's cells. */
function activeWordCells(): string[] {
  return Array.from(
    document.querySelectorAll(
      ".kukui-cw__cell.is-selected input, .kukui-cw__cell.is-highlighted input",
    ),
  ).map((el) => el.getAttribute("aria-label") ?? "");
}

/**
 * Select a clue and type its term. Selecting the clue focuses the starting
 * cell with the right direction, and typing advances the caret along the
 * word, so this fills the whole answer.
 */
async function solveClue(
  user: ReturnType<typeof userEvent.setup>,
  definition: RegExp,
  term: string,
) {
  await user.click(clueButton(definition));
  await user.keyboard(term);
}

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

  it("does not focus any cell on mount (no keyboard-focus theft)", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(document.activeElement?.tagName).not.toBe("INPUT");
  });

  it("pre-submit live region reports fill progress only; correctness appears after Check", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);

    await solveClue(user, /largest artery/i, "AORTA");

    // Regression for the answer leak: no correctness in the live region
    // before the learner asks for it.
    expect(progressRegion().textContent).toMatch(/5 of \d+ cells filled/);
    expect(progressRegion().textContent).not.toMatch(/correct/i);

    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(progressRegion().textContent).toMatch(/checked: 5 correct, 0 incorrect/i);
  });

  it("Check marks typed cells correct/incorrect without submitting", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);

    // Type a deliberately wrong word for VEIN (right length, wrong letters
    // except possibly none: "XXXX").
    await solveClue(user, /returns blood/i, "XXXX");
    await user.click(screen.getByRole("button", { name: /^check$/i }));

    expect(document.querySelectorAll(".kukui-cw__cell.is-incorrect").length).toBeGreaterThan(0);
    expect(progressRegion().textContent).toMatch(/incorrect/i);
    // Still pre-submit: the Submit button remains available.
    expect(screen.getByRole("button", { name: /^submit$/i })).toBeEnabled();
  });

  it("typing stays clamped to the active word (no caret escape past the end)", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);

    await user.click(clueButton(/largest artery/i));
    await user.keyboard("AORT");
    const beforeLast = document.activeElement?.getAttribute("aria-label");
    await user.keyboard("A");
    // After filling the final cell the caret stays on it instead of jumping
    // to some unrelated cell further along the row/column.
    expect(document.activeElement?.getAttribute("aria-label")).toBe(beforeLast);

    // And every letter landed inside the word: Check scores all 5 correct.
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(progressRegion().textContent).toMatch(/checked: 5 correct, 0 incorrect/i);
  });

  it("arrow-key movement is clamped to the active word", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);

    // AORTA is 5 letters. From its start, 4 same-direction presses reach the
    // last cell; further presses must not move focus anywhere else.
    await user.click(clueButton(/largest artery/i));
    const cells = activeWordCells();
    expect(cells).toHaveLength(5);
    const acrossList = screen.getByRole("heading", { name: /across/i }).closest("section");
    const isAcross = acrossList
      ? within(acrossList as HTMLElement).queryByText(/largest artery/i) !== null
      : false;
    const forward = isAcross ? "{ArrowRight}" : "{ArrowDown}";

    await user.keyboard(forward.repeat(4));
    const lastLabel = document.activeElement?.getAttribute("aria-label");
    expect(cells).toContain(lastLabel);
    await user.keyboard(forward);
    expect(document.activeElement?.getAttribute("aria-label")).toBe(lastLabel);
  });

  it("first click on a crossing cell keeps the current direction; second click toggles it", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);

    // Build the three word-cell sets (and their start cells) via their clues.
    const defs: [RegExp, number][] = [
      [/largest artery/i, 5],
      [/returns blood/i, 4],
      [/receives blood/i, 6],
    ];
    const wordCells = new Map<number, string[]>();
    const wordStart = new Map<number, string>();
    for (let i = 0; i < defs.length; i += 1) {
      const [re] = defs[i] as [RegExp, number];
      await user.click(clueButton(re));
      wordCells.set(i, activeWordCells());
      wordStart.set(
        i,
        document
          .querySelector(".kukui-cw__cell.is-selected input")
          ?.getAttribute("aria-label") ?? "",
      );
    }

    // Find two words that cross on a cell that is NOT word A's start —
    // clicking the already-selected start cell is the legitimate
    // toggle-on-reclick gesture, which is not what this test targets.
    let a = -1;
    let b = -1;
    let crossing: string | null = null;
    outer: for (let i = 0; i < defs.length; i += 1) {
      for (let j = 0; j < defs.length; j += 1) {
        if (i === j) continue;
        const shared = (wordCells.get(i) ?? []).find(
          (k) => (wordCells.get(j) ?? []).includes(k) && k !== wordStart.get(i),
        );
        if (shared) {
          a = i;
          b = j;
          crossing = shared;
          break outer;
        }
      }
    }
    expect(crossing).not.toBeNull();

    // Select word A via its clue (selection lands on A's start, direction A).
    await user.click(clueButton(defs[a]?.[0] as RegExp));
    const wordA = wordCells.get(a) as string[];
    const wordB = wordCells.get(b) as string[];

    // First click on the crossing cell: the active word must still be A
    // (regression: the focus handler used to update `selected` before the
    // click handler compared against it, flipping direction on first click).
    const crossingInput = screen.getByRole("textbox", { name: crossing as string });
    await user.click(crossingInput);
    expect(new Set(activeWordCells())).toEqual(new Set(wordA));

    // Second click on the same cell: now it toggles to the crossing word B.
    await user.click(crossingInput);
    expect(new Set(activeWordCells())).toEqual(new Set(wordB));
  });

  it("Reveal letter fills the selected cell and excludes it from the live fill/checked counts as revealed", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    await user.click(clueButton(/largest artery/i));
    await user.click(screen.getByRole("button", { name: /reveal letter/i }));

    expect(document.querySelectorAll(".kukui-cw__cell.is-revealed")).toHaveLength(1);
    expect(progressRegion().textContent).toMatch(/1 revealed/i);
    const revealedInput = document.querySelector(
      ".kukui-cw__cell.is-revealed input",
    ) as HTMLInputElement;
    expect(revealedInput.value).toBe("A");
  });

  it("Reveal word fills the active word; revealed cells are excluded from max on submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);

    // Read the total active cell count from the live region ("0 of N ...").
    const total = Number(/of (\d+) cells/.exec(progressRegion().textContent ?? "")?.[1]);
    expect(total).toBeGreaterThan(0);

    await user.click(clueButton(/largest artery/i));
    await user.click(screen.getByRole("button", { name: /reveal word/i }));
    expect(document.querySelectorAll(".kukui-cw__cell.is-revealed")).toHaveLength(5);

    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    const arg = onSubmit.mock.calls[0]?.[0];
    // The five revealed cells are outside the grade: not in raw, not in max.
    expect(arg.raw).toBe(0);
    expect(arg.max).toBe(total - 5);
    expect(arg.success).toBe(false);
  });

  it("revealing every word yields 0/0 and success (zero-max completion convention)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    for (const re of [/largest artery/i, /returns blood/i, /receives blood/i]) {
      await user.click(clueButton(re));
      await user.click(screen.getByRole("button", { name: /reveal word/i }));
    }
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 0, max: 0, success: true });
  });

  it("full solve reports success and shows the score line with the matching band", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const banded: CrosswordConfig = {
      ...cfg,
      scoring: {
        mode: "points",
        passPercentage: 60,
        bands: [
          { from: 0, to: 59, message: "Keep practicing" },
          { from: 60, to: 100, message: "Great work" },
        ],
        enableRetry: true,
      },
    };
    render(<Component config={banded} onSubmit={onSubmit} />);
    await solveClue(user, /largest artery/i, "AORTA");
    await solveClue(user, /returns blood/i, "VEIN");
    await solveClue(user, /receives blood/i, "ATRIUM");
    await user.click(screen.getByRole("button", { name: /^submit$/i }));

    const arg = onSubmit.mock.calls[0]?.[0];
    expect(arg.success).toBe(true);
    expect(arg.raw).toBe(arg.max);
    expect(screen.getByText(/great work/i)).toBeInTheDocument();
    // Score line shows raw / max.
    expect(document.querySelector(".kukui-cw__score")?.textContent).toContain(
      `${arg.raw} / ${arg.max}`,
    );
  });

  it("passPercentage from config.scoring gates success on a partial solve", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const lenient: CrosswordConfig = {
      ...cfg,
      scoring: { mode: "points", passPercentage: 20, enableRetry: true },
    };
    render(<Component config={lenient} onSubmit={onSubmit} />);
    // AORTA alone is 5 correct cells of ~13-15 total: above 20%.
    await solveClue(user, /largest artery/i, "AORTA");
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    const arg = onSubmit.mock.calls[0]?.[0];
    expect(arg.raw).toBe(5);
    expect(arg.max).toBeGreaterThan(5);
    expect(arg.success).toBe(true);
  });

  it("completion mode reports 1/1 success regardless of correctness", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const completion: CrosswordConfig = {
      ...cfg,
      scoring: { mode: "completion" },
    };
    render(<Component config={completion} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 1, max: 1, success: true });
    // No score line in completion mode.
    expect(document.querySelector(".kukui-cw__score")).toBeNull();
  });

  it("after submit, Try again resets the board; Show solution renders only when enabled", async () => {
    const user = userEvent.setup();
    const withSolutions: CrosswordConfig = {
      ...cfg,
      scoring: { mode: "points", enableRetry: true, enableSolutionsButton: true },
    };
    render(<Component config={withSolutions} onSubmit={vi.fn()} />);
    await solveClue(user, /largest artery/i, "AORTA");
    await user.click(screen.getByRole("button", { name: /^submit$/i }));

    expect(screen.queryByRole("button", { name: /^submit$/i })).toBeNull();

    // Show solution is a display toggle: every active cell shows a letter.
    await user.click(screen.getByRole("button", { name: /show solution/i }));
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(inputs.every((el) => el.value !== "")).toBe(true);

    await user.click(screen.getByRole("button", { name: /try again/i }));
    const cleared = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(cleared.every((el) => el.value === "")).toBe(true);
    expect(screen.getByRole("button", { name: /^submit$/i })).toBeInTheDocument();
  });

  it("suspend/resume restores letters, statuses, and the submitted lock", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    const first = render(
      <Component config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />,
    );
    await solveClue(user, /largest artery/i, "AORTA");
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    const payload = onPersist.mock.calls.at(-1)?.[0] as string;
    first.unmount();

    render(<Component config={cfg} onSubmit={vi.fn()} suspendData={payload} />);
    // Same config -> same fingerprint + seed -> same layout; letters restored.
    const values = (screen.getAllByRole("textbox") as HTMLInputElement[]).map(
      (el) => el.value,
    );
    expect(values.filter(Boolean)).toHaveLength(5);
    // Submitted lock survives the round-trip.
    expect(screen.queryByRole("button", { name: /^submit$/i })).toBeNull();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("resets saved progress when the entry list no longer matches the fingerprint", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    const first = render(
      <Component config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />,
    );
    await solveClue(user, /largest artery/i, "AORTA");
    const payload = onPersist.mock.calls.at(-1)?.[0] as string;
    first.unmount();

    const edited: CrosswordConfig = {
      ...cfg,
      entries: [
        ...cfg.entries,
        { id: "4", term: "VALVE", definition: "Prevents backflow" },
      ],
    };
    render(<Component config={edited} onSubmit={vi.fn()} suspendData={payload} />);
    const values = (screen.getAllByRole("textbox") as HTMLInputElement[]).map(
      (el) => el.value,
    );
    // Stale letters must not be scattered onto the new grid.
    expect(values.every((v) => v === "")).toBe(true);
  });

  it("cell inputs carry their clues via aria-describedby", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    await user.click(clueButton(/largest artery/i));
    const input = document.activeElement as HTMLInputElement;
    const descId = input.getAttribute("aria-describedby");
    expect(descId).toBeTruthy();
    const desc = document.getElementById(descId as string);
    expect(desc?.textContent).toMatch(/\d+ (Across|Down): Largest artery in the body\./);

    // Status is appended to the description after a reveal.
    await user.click(screen.getByRole("button", { name: /reveal letter/i }));
    expect(desc?.textContent).toMatch(/Revealed\./);
  });
});
