import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BranchingScenarioConfig } from "./schema.js";
import Component from "./Component.js";

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
    render(<Component config={cfg} onSubmit={vi.fn()} />);
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
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /take vitals/i }));
    expect(screen.getByText(/bp is 150\/95/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /order an ekg/i }),
    ).toBeInTheDocument();
  });

  it("reaching a terminal node calls onSubmit with the outcome's score and a path in suspendData", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
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
    render(<Component config={cfgNoOutcome} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /^go$/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ raw: 1, max: 1, success: true }),
    );
  });

  it("Restart resets to the start node and clears the path when enableRetry=true", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
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
      <Component
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
    render(<Component config={cfgBroken} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /broken/i }));
    // Stayed on the start node — broken choice did not navigate.
    expect(screen.getByRole("button", { name: /broken/i })).toBeInTheDocument();
    expect(screen.getByText(/unknown node/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    // Valid choice still works.
    await user.click(screen.getByRole("button", { name: /valid/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows the picked choice's feedback on the NEW node (captured at pick time)", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /take vitals/i }));
    // We navigated (the picked choice unmounted), yet its feedback renders.
    expect(screen.getByText(/bp is 150\/95/i)).toBeInTheDocument();
    expect(
      screen.getByText(/vitals first establishes a baseline/i),
    ).toBeInTheDocument();
  });

  it("does not mis-attribute feedback when the new node reuses the same choice id", async () => {
    const user = userEvent.setup();
    const reused: BranchingScenarioConfig = {
      version: "1.0",
      title: "Reused ids",
      startNodeId: "n1",
      nodes: [
        {
          id: "n1",
          prompt: "<p>First.</p>",
          choices: [
            { id: "c", text: "Go on", nextNodeId: "n2", feedback: "First-node feedback." },
          ],
        },
        {
          id: "n2",
          prompt: "<p>Second.</p>",
          choices: [
            { id: "c", text: "Finish", nextNodeId: "end", feedback: "Second-node feedback." },
          ],
        },
        { id: "end", prompt: "<p>Done.</p>", choices: null },
      ],
    };
    render(<Component config={reused} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /go on/i }));
    // Feedback belongs to the choice picked on n1, not n2's same-id choice.
    expect(screen.getByText(/first-node feedback/i)).toBeInTheDocument();
    expect(screen.queryByText(/second-node feedback/i)).not.toBeInTheDocument();
    // And n2's choice is not styled as the active pick.
    const finish = screen.getByRole("button", { name: /finish/i });
    expect(finish.className).not.toMatch(/is-active/);
  });

  it("completion scoring mode reports success at any terminal, even a failing outcome", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const completion: BranchingScenarioConfig = {
      ...cfg,
      scoring: { mode: "completion" },
    };
    render(<Component config={completion} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /discharge them/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ raw: 1, max: 1, success: true }),
    );
  });

  it("moves focus to the new node's prompt after navigating", async () => {
    const user = userEvent.setup();
    const { container } = render(<Component config={cfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /take vitals/i }));
    const prompt = container.querySelector(".kukui-bs__prompt");
    expect(prompt).not.toBeNull();
    expect(prompt).toHaveFocus();
  });

  it("falls back to the start node when suspendData references a deleted node", () => {
    const suspendData = JSON.stringify({
      currentNodeId: "no-such-node",
      path: ["start"],
      terminalReached: false,
    });
    render(<Component config={cfg} onSubmit={vi.fn()} suspendData={suspendData} />);
    // No unrecoverable missing-node screen: we are back at the start.
    expect(screen.getByText(/chest pain/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("resumes from suspendData when provided", () => {
    const suspendData = JSON.stringify({
      currentNodeId: "good",
      path: ["start"],
      terminalReached: false,
      lastChoiceId: "vitals",
    });
    render(
      <Component
        config={cfg}
        onSubmit={vi.fn()}
        suspendData={suspendData}
      />,
    );
    expect(screen.getByText(/bp is 150\/95/i)).toBeInTheDocument();
  });
});

describe("images and rich end screens", () => {
  const imgCfg: BranchingScenarioConfig = {
    version: "1.0",
    title: "Scene",
    startNodeId: "n1",
    nodes: [
      {
        id: "n1",
        prompt: "<p>Look at the scene.</p>",
        image: { src: "https://example.test/scene.jpg", alt: "A busy ward", naturalWidth: 800, naturalHeight: 600 },
        choices: [{ id: "go", text: "Continue", nextNodeId: "end" }],
      },
      {
        id: "end",
        prompt: "<p>Done.</p>",
        choices: null,
        outcome: {
          score: 1,
          success: true,
          title: "Nicely handled",
          image: { src: "https://example.test/win.jpg", alt: "A calm ward", naturalWidth: 800, naturalHeight: 600 },
          message: "<p>The ward is calm.</p>",
        },
      },
    ],
  };

  it("renders a node image with its alt text", () => {
    render(<Component config={imgCfg} onSubmit={vi.fn()} />);
    expect(screen.getByAltText("A busy ward")).toBeInTheDocument();
  });

  it("renders the outcome title and image on the end screen", async () => {
    const user = userEvent.setup();
    render(<Component config={imgCfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByRole("heading", { name: /nicely handled/i })).toBeInTheDocument();
    expect(screen.getByAltText("A calm ward")).toBeInTheDocument();
  });
});

describe("path-sum scoring", () => {
  const pathCfg: BranchingScenarioConfig = {
    version: "1.0",
    title: "Points",
    startNodeId: "q1",
    behaviour: { scoreMode: "path" },
    scoring: { mode: "points", passPercentage: 50 },
    nodes: [
      {
        id: "q1",
        prompt: "<p>Q1</p>",
        choices: [
          { id: "best1", text: "Best", nextNodeId: "q2", points: 2 },
          { id: "ok1", text: "OK", nextNodeId: "q2", points: 1 },
        ],
      },
      {
        id: "q2",
        prompt: "<p>Q2</p>",
        choices: [
          { id: "best2", text: "Best", nextNodeId: "end", points: 3 },
          { id: "bad2", text: "Bad", nextNodeId: "end", points: 0 },
        ],
      },
      { id: "end", prompt: "<p>End</p>", choices: null, outcome: { score: 0, success: false } },
    ],
  };

  it("sums picked points as raw, best-per-node as max, and shows the score", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={pathCfg} onSubmit={onSubmit} />);
    // Pick OK (1 of best 2), then Best (3 of best 3) -> raw 4, max 5.
    await user.click(screen.getByRole("button", { name: /^ok$/i }));
    await user.click(screen.getByRole("button", { name: /^best$/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 4, max: 5, success: true });
    expect(screen.getByText(/4 of 5 points/i)).toBeInTheDocument();
  });

  it("marks failure when the path falls below the pass threshold", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={pathCfg} onSubmit={onSubmit} />);
    // Pick OK (1/2) then Bad (0/3) -> raw 1, max 5 = 20% < 50%.
    await user.click(screen.getByRole("button", { name: /^ok$/i }));
    await user.click(screen.getByRole("button", { name: /^bad$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 1, max: 5, success: false });
  });

  it("terminal scoreMode still emits the terminal outcome score", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const terminalCfg = { ...pathCfg, behaviour: { scoreMode: "terminal" as const } };
    render(<Component config={terminalCfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /^best$/i }));
    await user.click(screen.getByRole("button", { name: /^bad$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 0, max: 1, success: false });
  });
});
