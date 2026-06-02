import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { OSCEConfig } from "./schema.js";
import Component from "./Component.js";

const cfg: OSCEConfig = {
  version: "1.0",
  title: "55-year-old with chest pain",
  caseHeader:
    "<p>A 55-year-old man presents with sudden-onset substernal chest pain radiating to the left arm.</p><p><strong>Vitals:</strong> BP 145/92, HR 102, RR 20, SpO2 96%.</p>",
  phases: [
    {
      id: "history",
      name: "History",
      description: "<p>Take a focused history.</p>",
      actions: [
        {
          id: "h1",
          text: "Ask about pain character, onset, and duration",
          correct: true,
          feedback: "Good — SOCRATES framing.",
        },
        {
          id: "h2",
          text: "Ask about cardiac risk factors",
          correct: true,
        },
        {
          id: "h3",
          text: "Ask about recent travel to a tropical island",
          correct: false,
          feedback: "Low yield for an acute MI workup.",
        },
      ],
    },
    {
      id: "exam",
      name: "Physical exam",
      actions: [
        { id: "e1", text: "Auscultate heart and lungs", correct: true },
        { id: "e2", text: "Palpate abdomen for masses", correct: false },
      ],
    },
    {
      id: "investigations",
      name: "Investigations",
      actions: [
        { id: "i1", text: "12-lead ECG", correct: true },
        { id: "i2", text: "Troponin", correct: true },
        { id: "i3", text: "Plain abdominal X-ray", correct: false },
      ],
    },
  ],
  expectedOrder: ["history", "exam", "investigations"],
  behaviour: { enableRetry: true, allowSkipPhase: true },
};

describe("OSCE", () => {
  it("renders title, case header, and the first phase by default", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /chest pain/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/55-year-old man/i)).toBeInTheDocument();
    expect(screen.getByText(/BP 145\/92/)).toBeInTheDocument();
    // First phase is "History"
    expect(
      screen.getByRole("heading", { level: 2, name: /^history$/i }),
    ).toBeInTheDocument();
    // Phase 1 actions visible
    expect(
      screen.getByRole("button", { name: /SOCRATES|pain character/i }),
    ).toBeInTheDocument();
    // Stepper present with 3 phases
    const stepper = screen.getByRole("navigation", { name: /OSCE phases/i });
    expect(within(stepper).getAllByRole("button")).toHaveLength(3);
  });

  it("toggles action selection (multi-select) and updates aria-pressed", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /pain character.*not selected/i });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    await user.click(btn);
    expect(
      screen.getByRole("button", { name: /pain character.*selected/i }),
    ).toHaveAttribute("aria-pressed", "true");
    // Toggle off
    await user.click(screen.getByRole("button", { name: /pain character.*selected/i }));
    expect(
      screen.getByRole("button", { name: /pain character.*not selected/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("advances through phases via Next phase, then submits aggregating per-phase + order", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);

    // Phase 1: History — pick both correct actions
    await user.click(screen.getByRole("button", { name: /pain character/i }));
    await user.click(screen.getByRole("button", { name: /cardiac risk factors/i }));
    await user.click(screen.getByRole("button", { name: /next phase/i }));

    // Phase 2: Exam
    expect(
      screen.getByRole("heading", { level: 2, name: /physical exam/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /auscultate/i }));
    await user.click(screen.getByRole("button", { name: /next phase/i }));

    // Phase 3: Investigations
    expect(
      screen.getByRole("heading", { level: 2, name: /investigations/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /12-lead ECG/i }));
    await user.click(screen.getByRole("button", { name: /troponin/i }));

    // Submit
    await user.click(screen.getByRole("button", { name: /submit OSCE/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const score = onSubmit.mock.calls[0]?.[0];
    // History 2/2 + Exam 1/1 + Investigations 2/2 = 5/5 actions correct.
    // Order bonus: visited history → exam → investigations matches expected → 3/3.
    // Total raw 8, max 8.
    expect(score).toMatchObject({ raw: 8, max: 8, success: true });
  });

  it("scores partial credit and order penalties when phases visited out of order", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);

    // Skip directly to Investigations via the stepper (allowSkipPhase=true)
    const stepper = screen.getByRole("navigation", { name: /OSCE phases/i });
    const stepperBtns = within(stepper).getAllByRole("button");
    // Click the third stepper button (Investigations)
    const investigationsStep = stepperBtns[2];
    if (!investigationsStep) throw new Error("missing stepper button");
    await user.click(investigationsStep);

    // Submit with no actions selected anywhere
    await user.click(screen.getByRole("button", { name: /submit OSCE/i }));

    const score = onSubmit.mock.calls[0]?.[0];
    // No actions selected → 0/2 + 0/1 + 0/2 = 0/5 actions
    // visitOrder = [history, investigations] → only "history" matches expected[0],
    // visitOrder[1]=investigations ≠ expected[1]=exam, expected[2] missing → 1/3.
    // Total raw=1, max=8, success=false.
    expect(score).toMatchObject({ raw: 1, max: 8, success: false });
  });

  it("honors config.scoring.passPercentage for pass/fail (S11 regression)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    // Same partial scenario as the test above: raw 1 / max 8 ≈ 12.5%. With the
    // default 50% threshold this fails; an authored 10% threshold must pass.
    // Before the fix, computeScoring ignored config.scoring and always used
    // aggregate's hard-coded 50%, so this could never pass.
    const lowBar: OSCEConfig = {
      ...cfg,
      scoring: { mode: "points", passPercentage: 10 },
    };
    render(<Component config={lowBar} onSubmit={onSubmit} />);

    const stepper = screen.getByRole("navigation", { name: /OSCE phases/i });
    const investigationsStep = within(stepper).getAllByRole("button")[2];
    if (!investigationsStep) throw new Error("missing stepper button");
    await user.click(investigationsStep);
    await user.click(screen.getByRole("button", { name: /submit OSCE/i }));

    const score = onSubmit.mock.calls[0]?.[0];
    expect(score).toMatchObject({ raw: 1, max: 8, success: true });
  });

  it("Try again resets to the first phase with no selections after submit", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);

    // Walk through quickly and submit
    await user.click(screen.getByRole("button", { name: /pain character/i }));
    await user.click(screen.getByRole("button", { name: /next phase/i }));
    await user.click(screen.getByRole("button", { name: /next phase/i }));
    await user.click(screen.getByRole("button", { name: /submit OSCE/i }));

    // Per-phase summary is now visible
    expect(screen.getByText(/per-phase summary/i)).toBeInTheDocument();

    // Click Try again
    await user.click(screen.getByRole("button", { name: /try again/i }));

    // Back at phase 1, no selections, action button is "not selected"
    expect(
      screen.getByRole("heading", { level: 2, name: /^history$/i }),
    ).toBeInTheDocument();
    const a = screen.getByRole("button", { name: /pain character.*not selected/i });
    expect(a).toHaveAttribute("aria-pressed", "false");
    // Stepper buttons are no longer disabled (pre-submit) — the current phase
    // stepper button is enabled because clicking it is a no-op self-target.
  });

  it("persists state via onPersist when interactions occur, and resumes from suspendData", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    const { unmount } = render(
      <Component config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />,
    );

    await user.click(screen.getByRole("button", { name: /pain character/i }));
    await user.click(screen.getByRole("button", { name: /next phase/i }));

    expect(onPersist).toHaveBeenCalled();
    const lastSuspend = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(lastSuspend).toMatch(/"current":1/);
    expect(lastSuspend).toContain("history");

    unmount();

    // Remount with the suspendData — should land on phase 2 with phase-1
    // selection preserved.
    render(<Component config={cfg} onSubmit={vi.fn()} suspendData={lastSuspend} />);
    expect(
      screen.getByRole("heading", { level: 2, name: /physical exam/i }),
    ).toBeInTheDocument();
  });

  it("when headingLevel=2 is passed, the activity title renders as h2", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} headingLevel={2} />);
    expect(
      screen.getByRole("heading", { level: 2, name: /chest pain/i }),
    ).toBeInTheDocument();
  });

  it("guessPenalty=0 removes the penalty for wrong picks", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const noPenalty: OSCEConfig = {
      ...cfg,
      behaviour: { ...cfg.behaviour, guessPenalty: 0 },
    };
    render(<Component config={noPenalty} onSubmit={onSubmit} />);

    // Phase 1: pick BOTH correct actions AND the wrong "tropical travel" one.
    // With guessPenalty=1 (default), that'd be 2 - 1 = 1/2. With 0, it stays 2/2.
    await user.click(screen.getByRole("button", { name: /pain character/i }));
    await user.click(screen.getByRole("button", { name: /cardiac risk factors/i }));
    await user.click(screen.getByRole("button", { name: /tropical/i }));
    await user.click(screen.getByRole("button", { name: /next phase/i }));
    // Phase 2: pick only the wrong one — with no penalty, stays 0/1.
    await user.click(screen.getByRole("button", { name: /palpate abdomen/i }));
    await user.click(screen.getByRole("button", { name: /next phase/i }));
    // Phase 3: leave empty.
    await user.click(screen.getByRole("button", { name: /submit OSCE/i }));

    const score = onSubmit.mock.calls[0]?.[0];
    // Phase 1: 2/2 (no penalty for the wrong tropical pick).
    // Phase 2: 0/1.
    // Phase 3: 0/2.
    // Order: history → exam → investigations matches expected → 3/3.
    // Total raw = 2 + 0 + 0 + 3 = 5; max = 2 + 1 + 2 + 3 = 8.
    expect(score).toMatchObject({ raw: 5, max: 8 });
  });
});
