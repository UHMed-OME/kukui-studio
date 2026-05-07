import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BranchingScenarioConfig } from "@kukui/schemas/branching-scenario";
import { BranchingScenario } from "./BranchingScenario.js";

const cfg: BranchingScenarioConfig = {
  version: "1.0",
  title: "Triage call",
  startNodeId: "start",
  nodes: [
    {
      id: "start",
      prompt: "<p>The patient describes chest pain. What do you do first?</p>",
      choices: [
        {
          id: "vitals",
          text: "Take vitals",
          nextNodeId: "good",
          feedback: "Good — vitals first establishes a baseline.",
        },
        {
          id: "discharge",
          text: "Discharge them",
          nextNodeId: "bad",
          feedback: "Don't dismiss chest pain.",
        },
      ],
    },
    {
      id: "good",
      prompt: "<p>BP is 150/95. Next step?</p>",
      choices: [
        {
          id: "ekg",
          text: "Order an EKG",
          nextNodeId: "outcome-success",
        },
      ],
    },
    {
      id: "outcome-success",
      prompt: "<p>EKG ordered.</p>",
      choices: null,
      outcome: {
        score: 1,
        success: true,
        message: "<p>Correct workup. Patient stabilized.</p>",
      },
    },
    {
      id: "bad",
      prompt: "<p>The patient leaves and returns by ambulance.</p>",
      choices: null,
      outcome: { score: 0, success: false, message: "<p>Adverse outcome.</p>" },
    },
  ],
  behaviour: { enableRetry: true },
  ui: { restartButton: "Restart" },
};

const cfgNoOutcome: BranchingScenarioConfig = {
  version: "1.0",
  title: "Completion-only",
  startNodeId: "a",
  nodes: [
    {
      id: "a",
      prompt: "<p>Pick</p>",
      choices: [{ id: "go", text: "Go", nextNodeId: "end" }],
    },
    { id: "end", prompt: "<p>End.</p>", choices: null },
  ],
};

const cfgBroken: BranchingScenarioConfig = {
  version: "1.0",
  title: "Broken edge",
  startNodeId: "a",
  nodes: [
    {
      id: "a",
      prompt: "<p>Pick</p>",
      choices: [
        { id: "ok", text: "Valid", nextNodeId: "end" },
        // intentionally broken — schema validation skipped to test runtime guard.
        { id: "bad", text: "Broken", nextNodeId: "ghost" },
      ],
    },
    { id: "end", prompt: "<p>End.</p>", choices: null },
  ],
};

describe("BranchingScenario", () => {
  it("renders the start node's prompt and its choice buttons", () => {
    render(<BranchingScenario config={cfg} onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /triage call/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/chest pain/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /take vitals/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /discharge them/i }),
    ).toBeInTheDocument();
  });

  it("clicking a choice routes to the next node's prompt", async () => {
    const user = userEvent.setup();
    render(<BranchingScenario config={cfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /take vitals/i }));
    expect(screen.getByText(/bp is 150\/95/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /order an ekg/i }),
    ).toBeInTheDocument();
  });

  it("reaching a terminal node calls onSubmit with the outcome's score and a path in suspendData", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BranchingScenario config={cfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /take vitals/i }));
    await user.click(screen.getByRole("button", { name: /order an ekg/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const arg = onSubmit.mock.calls[0]?.[0];
    expect(arg).toMatchObject({ raw: 1, max: 1, success: true });
    expect(typeof arg.suspendData).toBe("string");
    const persisted = JSON.parse(arg.suspendData);
    expect(persisted.path).toEqual(["start", "good"]);
    // Outcome message rendered to the learner.
    expect(screen.getByText(/patient stabilized/i)).toBeInTheDocument();
  });

  it("defaults to score=1/success=true when a terminal node has no outcome (completion-only)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BranchingScenario config={cfgNoOutcome} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /^go$/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ raw: 1, max: 1, success: true }),
    );
  });

  it("Restart resets to the start node and clears the path when enableRetry=true", async () => {
    const user = userEvent.setup();
    render(<BranchingScenario config={cfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /discharge them/i }));
    expect(screen.getByText(/adverse outcome/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /restart/i }));
    // We're back at start.
    expect(
      screen.getByRole("button", { name: /take vitals/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/adverse outcome/i)).not.toBeInTheDocument();
  });

  it("persists state on every navigation step", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(
      <BranchingScenario
        config={cfg}
        onSubmit={vi.fn()}
        onPersist={onPersist}
      />,
    );
    const callsBefore = onPersist.mock.calls.length;
    await user.click(screen.getByRole("button", { name: /take vitals/i }));
    expect(onPersist.mock.calls.length).toBeGreaterThan(callsBefore);
    const afterFirst = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(afterFirst).toMatch(/"currentNodeId":"good"/);
    await user.click(screen.getByRole("button", { name: /order an ekg/i }));
    const afterTerminal = onPersist.mock.calls.at(-1)?.[0] as string;
    const parsed = JSON.parse(afterTerminal);
    expect(parsed.path).toEqual(["start", "good"]);
    expect(parsed.terminalReached).toBe(true);
  });

  it("handles a broken nextNodeId gracefully (no crash, no navigation, no onSubmit)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BranchingScenario config={cfgBroken} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /broken/i }));
    // Stayed on the start node — broken choice did not navigate.
    expect(screen.getByRole("button", { name: /broken/i })).toBeInTheDocument();
    expect(screen.getByText(/unknown node/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    // Valid choice still works.
    await user.click(screen.getByRole("button", { name: /valid/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("resumes from suspendData when provided", () => {
    const suspendData = JSON.stringify({
      currentNodeId: "good",
      path: ["start"],
      terminalReached: false,
      lastChoiceId: "vitals",
    });
    render(
      <BranchingScenario
        config={cfg}
        onSubmit={vi.fn()}
        suspendData={suspendData}
      />,
    );
    expect(screen.getByText(/bp is 150\/95/i)).toBeInTheDocument();
  });
});
