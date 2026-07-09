import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DDxTreeConfig } from "./schema.js";
import Component from "./Component.js";

const cfg: DDxTreeConfig = {
  version: "1.0",
  title: "Acute chest pain",
  caseHeader:
    "<p>52-year-old male, sudden substernal chest pain. BP 138/86, HR 102.</p>",
  startNodeId: "n-start",
  nodes: [
    {
      id: "n-start",
      presentation: "<p>What investigation do you order first?</p>",
      choices: [
        {
          id: "c-ecg",
          text: "12-lead ECG",
          nextNodeId: "n-ecg",
          addsToCase: "ECG: ST elevation in leads II, III, aVF.",
          feedback: "Good — ECG is first-line for acute chest pain.",
        },
        {
          id: "c-ct",
          text: "CT pulmonary angiogram",
          nextNodeId: "n-ct",
          addsToCase: "CT-PA: no filling defect, normal lung parenchyma.",
          feedback: "Reasonable for PE workup, but ECG should come first.",
        },
      ],
      diagnosis: undefined,
    },
    {
      id: "n-ecg",
      presentation: "<p>Inferior STEMI. Final diagnosis?</p>",
      choices: [
        { id: "c-mi", text: "Inferior MI", nextNodeId: "n-dx-mi" },
        {
          id: "c-pe",
          text: "Pulmonary embolism",
          nextNodeId: "n-dx-pe-wrong",
        },
      ],
    },
    {
      id: "n-ct",
      presentation: "<p>Normal CT-PA. What now?</p>",
      choices: [
        { id: "c-mi-late", text: "Inferior MI", nextNodeId: "n-dx-mi" },
      ],
    },
    {
      id: "n-dx-mi",
      presentation: "<p>You commit to inferior MI.</p>",
      choices: null,
      diagnosis: {
        name: "Inferior STEMI",
        correct: true,
        score: 1,
        explanation: "<p>Correct — ST elevation in inferior leads.</p>",
      },
    },
    {
      id: "n-dx-pe-wrong",
      presentation: "<p>You commit to PE.</p>",
      choices: null,
      diagnosis: {
        name: "Pulmonary embolism",
        correct: false,
        score: 0,
        explanation: "<p>The ECG findings point to MI, not PE.</p>",
      },
    },
  ],
  behaviour: { enableRetry: true },
  ui: { restartButton: "Start over" },
};

describe("ddx-tree Component", () => {
  it("renders the title, case header and the start node presentation", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /acute chest pain/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/52-year-old male, sudden substernal chest pain/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/what investigation do you order first/i),
    ).toBeInTheDocument();
    // Initial empty case-so-far placeholder.
    expect(
      screen.getByText(/no additional findings yet/i),
    ).toBeInTheDocument();
  });

  it("clicking a choice routes to the next node and appends to Case so far", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /12-lead ecg/i }));
    // Routed to n-ecg.
    expect(
      screen.getByText(/inferior stemi\. final diagnosis/i),
    ).toBeInTheDocument();
    // Case so far now contains the addsToCase fragment.
    expect(
      screen.getByText(/ECG: ST elevation in leads II, III, aVF/i),
    ).toBeInTheDocument();
    // Empty placeholder is gone.
    expect(
      screen.queryByText(/no additional findings yet/i),
    ).not.toBeInTheDocument();
  });

  it("reaching a correct terminal diagnosis fires onSubmit with success=true", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /12-lead ecg/i }));
    await user.click(screen.getByRole("button", { name: /^inferior mi$/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 1,
      max: 1,
      success: true,
    });
    expect(screen.getByText(/^correct:/i)).toBeInTheDocument();
    expect(screen.getByText(/inferior stemi/i)).toBeInTheDocument();
  });

  it("reaching an incorrect terminal diagnosis fires onSubmit with success=false", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /12-lead ecg/i }));
    await user.click(
      screen.getByRole("button", { name: /pulmonary embolism/i }),
    );
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 0,
      max: 1,
      success: false,
    });
    expect(screen.getByText(/^incorrect:/i)).toBeInTheDocument();
  });

  it("Restart returns to the start node and clears the Case so far panel", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /12-lead ecg/i }));
    await user.click(screen.getByRole("button", { name: /^inferior mi$/i }));
    await user.click(screen.getByRole("button", { name: /start over/i }));
    expect(
      screen.getByText(/what investigation do you order first/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no additional findings yet/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/ECG: ST elevation/i),
    ).not.toBeInTheDocument();
  });

  it("persists currentNodeId and accumulatedCase via onPersist on each step", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(
      <Component config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />,
    );
    await user.click(screen.getByRole("button", { name: /12-lead ecg/i }));
    expect(onPersist).toHaveBeenCalled();
    const lastCall = onPersist.mock.calls.at(-1);
    const persisted = JSON.parse(lastCall?.[0] as string) as {
      currentNodeId: string;
      accumulatedCase: string[];
    };
    expect(persisted.currentNodeId).toBe("n-ecg");
    expect(persisted.accumulatedCase).toEqual([
      "ECG: ST elevation in leads II, III, aVF.",
    ]);
  });

  it("resumes from suspendData (currentNodeId + accumulatedCase)", () => {
    const suspendData = JSON.stringify({
      currentNodeId: "n-ecg",
      accumulatedCase: ["ECG: ST elevation in leads II, III, aVF."],
      terminalReached: false,
      lastChoiceId: "c-ecg",
    });
    render(
      <Component config={cfg} onSubmit={vi.fn()} suspendData={suspendData} />,
    );
    // Should render the n-ecg presentation, not the start node's.
    expect(
      screen.getByText(/inferior stemi\. final diagnosis/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/ECG: ST elevation in leads II, III, aVF/i),
    ).toBeInTheDocument();
  });

  it("shows the picked choice's feedback after navigating to the next node", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /12-lead ecg/i }));
    // We are on n-ecg now; the feedback authored on the picked (previous
    // node's) choice must be visible.
    expect(
      screen.getByText(/good — ecg is first-line for acute chest pain/i),
    ).toBeInTheDocument();
    // Picking the other branch replaces it (no stale feedback).
    await user.click(screen.getByRole("button", { name: /^inferior mi$/i }));
    expect(
      screen.queryByText(/good — ecg is first-line/i),
    ).not.toBeInTheDocument();
  });

  it("falls back to the initial state when suspendData points at a deleted node", () => {
    const stale = JSON.stringify({
      currentNodeId: "n-deleted",
      accumulatedCase: ["Old finding."],
      terminalReached: false,
      lastChoiceId: null,
    });
    render(<Component config={cfg} onSubmit={vi.fn()} suspendData={stale} />);
    // No unrecoverable "can't continue" card — the case restarts cleanly.
    expect(
      screen.queryByText(/can.t continue/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/what investigation do you order first/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no additional findings yet/i),
    ).toBeInTheDocument();
  });

  it("completion mode reports success even for an incorrect terminal diagnosis", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const completion: DDxTreeConfig = {
      ...cfg,
      scoring: { mode: "completion" },
    };
    render(<Component config={completion} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /12-lead ecg/i }));
    await user.click(
      screen.getByRole("button", { name: /pulmonary embolism/i }),
    );
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 0,
      max: 1,
      success: true,
    });
  });

  it("offers a mid-case Restart once off the start node, gated on resolved retry", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Component config={cfg} onSubmit={vi.fn()} />);
    // On the start node: no mid-case restart.
    expect(
      screen.queryByRole("button", { name: /start over/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /12-lead ecg/i }));
    // Off the start node: restart is offered and works.
    await user.click(screen.getByRole("button", { name: /start over/i }));
    expect(
      screen.getByText(/what investigation do you order first/i),
    ).toBeInTheDocument();
    unmount();

    // With retry disabled via the scoring block, no mid-case restart appears.
    const noRetry: DDxTreeConfig = {
      ...cfg,
      scoring: { mode: "points", enableRetry: false },
    };
    render(<Component config={noRetry} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /12-lead ecg/i }));
    expect(
      screen.queryByRole("button", { name: /start over/i }),
    ).not.toBeInTheDocument();
  });
});
