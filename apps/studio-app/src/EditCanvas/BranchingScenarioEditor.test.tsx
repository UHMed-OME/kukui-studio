import { describe, expect, it, vi } from "vitest";
import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { BranchingScenarioEditor } from "./BranchingScenarioEditor.js";
import { BranchingScenarioConfigSchema } from "../../../../packages/activities/branching-scenario/schema.js";

/**
 * A three-node tree (start decision + two endings), schema-valid as-is. Editor
 * reads `nodes` / `startNodeId` and emits a full replacement config.
 */
const baseConfig = {
  version: "1.0",
  title: "Triage",
  startNodeId: "n1",
  nodes: [
    {
      id: "n1",
      prompt: "What is your first move?",
      position: { x: 0.5, y: 0.2 },
      choices: [
        { id: "c1", text: "Option A", nextNodeId: "n2" },
        { id: "c2", text: "Option B", nextNodeId: "n3" },
      ],
    },
    {
      id: "n2",
      prompt: "Outcome A.",
      position: { x: 0.3, y: 0.7 },
      choices: null,
      outcome: { score: 1, success: true, message: "Good call." },
    },
    {
      id: "n3",
      prompt: "Outcome B.",
      position: { x: 0.7, y: 0.7 },
      choices: null,
      outcome: { score: 0, success: false, message: "Try again." },
    },
  ],
  behaviour: { enableRetry: true },
};

/**
 * JSDOM strips clientX/clientY from fireEvent.pointerXxx; build the event
 * manually and define the pointer props so React sees real coordinates.
 */
function firePointer(
  element: Element,
  type: "pointerDown" | "pointerMove" | "pointerUp" | "pointerCancel",
  init: { clientX?: number; clientY?: number; pointerId?: number } = {},
) {
  const event = createEvent[type](element, init);
  const props: Record<string, number> = {
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    pointerId: init.pointerId ?? 1,
  };
  for (const [k, v] of Object.entries(props)) {
    Object.defineProperty(event, k, { get: () => v, configurable: true });
  }
  fireEvent(element, event);
}

/** Stateful wrapper: echoes each onChange back into props, like the Studio shell. */
function Harness({
  initial,
  onChange = () => {},
}: {
  initial: Record<string, unknown>;
  onChange?: (next: unknown) => void;
}) {
  const [cfg, setCfg] = useState(initial);
  return (
    <BranchingScenarioEditor
      config={cfg}
      onChange={(next) => {
        onChange(next);
        setCfg(next as Record<string, unknown>);
      }}
    />
  );
}

/** Give the board a real size so drag deltas exceed the px threshold. */
function stubBoardRect() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 1000,
    bottom: 600,
    width: 1000,
    height: 600,
    toJSON: () => ({}),
  } as DOMRect);
}

const expectValid = (cfg: unknown) => {
  const res = BranchingScenarioConfigSchema.safeParse(cfg);
  if (!res.success) {
    throw new Error(`config not schema-valid: ${JSON.stringify(res.error.issues, null, 2)}`);
  }
};

const getRail = () => screen.getByRole("complementary", { name: /step settings/i });

describe("BranchingScenarioEditor", () => {
  it("seeds a valid start node from the empty state", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BranchingScenarioEditor config={{ version: "1.0", title: "T", nodes: [] }} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /add first node/i }));

    const next = onChange.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect((next.nodes as unknown[]).length).toBe(1);
    expect(next.startNodeId).toBe((next.nodes as Array<{ id: string }>)[0]!.id);
    expectValid(next);
  });

  it("adding a choice auto-creates and links a terminal node, staying schema-valid", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={baseConfig} onChange={onChange} />);

    // Select the decision node n1 and add a choice; it seeds a new terminal node.
    await user.click(screen.getByRole("button", { name: /start step: what is your first move/i }));
    await user.click(within(getRail()).getByRole("button", { name: /^\+ add choice$/i }));

    const next = onChange.mock.calls.at(-1)![0] as {
      nodes: Array<{ id: string; choices: Array<{ nextNodeId: string }> | null }>;
    };
    // A new node was appended and n1 now has a third choice pointing at it.
    expect(next.nodes.length).toBe(4);
    const n1 = next.nodes.find((n) => n.id === "n1")!;
    expect(n1.choices).toHaveLength(3);
    const targetId = n1.choices![2]!.nextNodeId;
    expect(next.nodes.some((n) => n.id === targetId)).toBe(true);
    expectValid(next);
  });

  it("rebinds a choice's nextNodeId via the connect gesture", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={baseConfig} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /start step: what is your first move/i }));
    // Choice 1 currently targets n2; retarget it to n3 via "Set target on canvas".
    const setTargetButtons = within(getRail()).getAllByRole("button", {
      name: /set target on canvas/i,
    });
    await user.click(setTargetButtons[0]!);
    await user.click(screen.getByRole("button", { name: /end step: outcome b\./i }));

    const next = onChange.mock.calls.at(-1)![0] as {
      nodes: Array<{ id: string; choices: Array<{ id: string; nextNodeId: string }> | null }>;
    };
    const n1 = next.nodes.find((n) => n.id === "n1")!;
    expect(n1.choices!.find((c) => c.id === "c1")!.nextNodeId).toBe("n3");
    expectValid(next);
  });

  it("commits a rounded position when a node is dragged", () => {
    stubBoardRect();
    const onChange = vi.fn();
    render(<BranchingScenarioEditor config={baseConfig} onChange={onChange} />);

    const node = screen.getByRole("button", { name: /start step: what is your first move/i });
    const board = node.parentElement!;
    firePointer(node, "pointerDown", { clientX: 500, clientY: 120, pointerId: 1 });
    // Move well past the 6px threshold, to board coords (700, 300) => (0.7, 0.5).
    firePointer(board, "pointerMove", { clientX: 700, clientY: 300, pointerId: 1 });
    firePointer(board, "pointerUp", { clientX: 700, clientY: 300, pointerId: 1 });

    const next = onChange.mock.calls.at(-1)![0] as {
      nodes: Array<{ id: string; position?: { x: number; y: number } }>;
    };
    const n1 = next.nodes.find((n) => n.id === "n1")!;
    expect(n1.position!.x).toBeCloseTo(0.7, 5);
    expect(n1.position!.y).toBeCloseTo(0.5, 5);
    // Rounded to 2 dp.
    expect(Number.isInteger(n1.position!.x * 100)).toBe(true);
  });

  it("removes a node on keyboard Delete and warns about repointed choices", () => {
    const onChange = vi.fn();
    render(<Harness initial={baseConfig} onChange={onChange} />);

    // n2 is targeted by n1.c1; deleting it should clear that link and warn.
    fireEvent.keyDown(screen.getByRole("button", { name: /end step: outcome a\./i }), {
      key: "Delete",
    });

    const next = onChange.mock.calls.at(-1)![0] as {
      nodes: Array<{ id: string; choices: Array<{ nextNodeId: string }> | null }>;
    };
    expect(next.nodes.some((n) => n.id === "n2")).toBe(false);
    const n1 = next.nodes.find((n) => n.id === "n1")!;
    expect(n1.choices!.some((c) => c.nextNodeId === "n2")).toBe(false);
    expect(screen.getByText(/cleared 1 choice link/i)).toBeInTheDocument();
    expectValid(next);
  });

  it("writes behaviour.scoreMode from the graph panel select", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={baseConfig} onChange={onChange} />);

    // Nothing selected => graph panel with the scoring-mode select.
    await user.selectOptions(within(getRail()).getByLabelText(/scoring mode/i), "path");

    const next = onChange.mock.calls.at(-1)![0] as {
      behaviour?: { scoreMode?: string };
    };
    expect(next.behaviour?.scoreMode).toBe("path");
    expectValid(next);
  });
});
