import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ConceptMapConfig } from "./schema.js";
import Component from "./Component.js";

/**
 * JSDOM's PointerEvent constructor strips clientX/clientY from the dispatched
 * event when the synthetic event is built via fireEvent.pointerXxx. Construct
 * the event manually and define the pointer-specific properties so React sees
 * real coordinates.
 */
function firePointer(
  element: Element,
  type: "pointerDown" | "pointerMove" | "pointerUp" | "pointerCancel",
  init: { clientX?: number; clientY?: number; pointerId?: number; button?: number } = {},
) {
  const event = createEvent[type](element, init);
  const props: Record<string, number> = {
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    pointerId: init.pointerId ?? 1,
    button: init.button ?? 0,
  };
  for (const [k, v] of Object.entries(props)) {
    Object.defineProperty(event, k, { get: () => v, configurable: true });
  }
  fireEvent(element, event);
}

const baseCfg: ConceptMapConfig = {
  version: "1.0",
  title: "Map cell organelles",
  prompt: "<p>Connect each organelle to its function.</p>",
  seedNodes: [
    { id: "nucleus", label: "Nucleus", position: { x: 0.2, y: 0.3 } },
    { id: "mitochondrion", label: "Mitochondrion", position: { x: 0.6, y: 0.3 } },
  ],
  availableConcepts: [
    { id: "ribosome", label: "Ribosome" },
    { id: "er", label: "Endoplasmic Reticulum" },
  ],
  expected: {
    nodes: ["nucleus", "mitochondrion", "ribosome"],
    edges: [{ from: "nucleus", to: "mitochondrion" }],
  },
  behaviour: { enableRetry: true, allowFreeText: true },
};

/**
 * JSDOM reports 0×0 for layout-less elements. Mock the canvas bounding rect
 * so pointer-event clientX/clientY values map to deterministic 0..1 coords.
 * Width 500, height 400, top-left at (0, 0).
 */
function mockCanvasRect(width = 500, height = 400): () => void {
  const original = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.classList.contains("kukui-cm__canvas")) {
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: width,
        bottom: height,
        width,
        height,
        toJSON() {
          return {};
        },
      } as DOMRect;
    }
    return original.call(this);
  };
  return () => {
    HTMLElement.prototype.getBoundingClientRect = original;
  };
}

describe("ConceptMap", () => {
  let restoreRect: () => void = () => {};

  beforeEach(() => {
    restoreRect = mockCanvasRect(500, 400);
  });

  afterEach(() => {
    restoreRect();
  });

  it("renders title, prompt, toolbar, canvas, and seed nodes", () => {
    render(<Component config={baseCfg} onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /map cell organelles/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/connect each organelle/i)).toBeInTheDocument();

    const toolbar = screen.getByRole("toolbar", { name: /concept map tools/i });
    expect(toolbar).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /add a node/i })).toBeInTheDocument();
    expect(
      within(toolbar).getByRole("button", { name: /draw an edge between two nodes/i }),
    ).toBeInTheDocument();
    expect(
      within(toolbar).getByRole("button", { name: /delete the selected/i }),
    ).toBeInTheDocument();
    expect(
      within(toolbar).getByRole("button", { name: /clear all nodes and edges/i }),
    ).toBeInTheDocument();

    // Both seed nodes render as buttons on the canvas.
    expect(screen.getByRole("button", { name: /node nucleus/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /node mitochondrion/i })).toBeInTheDocument();

    // Palette concepts not yet placed.
    expect(
      screen.getByRole("button", { name: /add concept ribosome to canvas/i }),
    ).toBeInTheDocument();
  });

  it("clicking a palette chip adds a node to the canvas at canvas centre (keyboard fallback)", async () => {
    const user = userEvent.setup();
    render(<Component config={baseCfg} onSubmit={vi.fn()} />);
    const ribosomePaletteBtn = screen.getByRole("button", {
      name: /add concept ribosome to canvas/i,
    });
    await user.click(ribosomePaletteBtn);
    // Ribosome now lives on the canvas as a node.
    expect(screen.getByRole("button", { name: /node ribosome/i })).toBeInTheDocument();
    // And the palette chip for that concept disappears.
    expect(
      screen.queryByRole("button", { name: /add concept ribosome to canvas/i }),
    ).toBeNull();
  });

  it("entering Edge mode and clicking two nodes draws an edge between them", async () => {
    const user = userEvent.setup();
    render(<Component config={baseCfg} onSubmit={vi.fn()} />);
    await user.click(
      screen.getByRole("button", { name: /draw an edge between two nodes/i }),
    );
    // Hint text appears
    expect(screen.getByText(/click a node to start an edge/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /node nucleus/i }));
    expect(screen.getByText(/click another node to connect/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /node mitochondrion/i }));

    // Off-screen edge handle list reveals the new edge for AT users.
    expect(
      screen.getByRole("button", { name: /edge from nucleus to mitochondrion/i }),
    ).toBeInTheDocument();
  });

  it("Delete on a focused node removes the node and any incident edges", async () => {
    const user = userEvent.setup();
    render(<Component config={baseCfg} onSubmit={vi.fn()} />);
    // First make an edge from nucleus to mitochondrion.
    await user.click(screen.getByRole("button", { name: /draw an edge/i }));
    await user.click(screen.getByRole("button", { name: /node nucleus/i }));
    await user.click(screen.getByRole("button", { name: /node mitochondrion/i }));
    expect(
      screen.getByRole("button", { name: /edge from nucleus to mitochondrion/i }),
    ).toBeInTheDocument();

    // Focus nucleus and press Delete.
    const nucleusBtn = screen.getByRole("button", { name: /node nucleus/i });
    nucleusBtn.focus();
    await user.keyboard("{Delete}");

    expect(screen.queryByRole("button", { name: /node nucleus/i })).toBeNull();
    // Edge should also be gone since one endpoint vanished.
    expect(
      screen.queryByRole("button", { name: /edge from nucleus to mitochondrion/i }),
    ).toBeNull();
  });

  it("Submit scores correct nodes + correct edges and reports success when all expected items present", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={baseCfg} onSubmit={onSubmit} />);

    // Add ribosome from palette to fulfill the third expected node.
    await user.click(
      screen.getByRole("button", { name: /add concept ribosome to canvas/i }),
    );

    // Connect nucleus → mitochondrion to fulfill the expected edge.
    await user.click(screen.getByRole("button", { name: /draw an edge/i }));
    await user.click(screen.getByRole("button", { name: /node nucleus/i }));
    await user.click(screen.getByRole("button", { name: /node mitochondrion/i }));

    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      // 3 expected nodes + 1 expected edge = 4
      raw: 4,
      max: 4,
      success: true,
    });
    expect(typeof onSubmit.mock.calls[0]?.[0].suspendData).toBe("string");
  });

  it("partial correctness yields partial credit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={baseCfg} onSubmit={onSubmit} />);
    // Don't add ribosome; don't connect anything. Submit with just the seeds.
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 2, // nucleus + mitochondrion seeds match expected nodes; no edges
      max: 4,
      success: false,
    });
  });

  it("completion-only mode (no expected) scores 1/1 once the learner has placed at least one node", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const noExpected: ConceptMapConfig = {
      version: "1.0",
      title: "Free-form map",
      prompt: "<p>Build a map of any concepts you choose.</p>",
      availableConcepts: [{ id: "a", label: "Alpha" }],
    };
    render(<Component config={noExpected} onSubmit={onSubmit} />);
    // Submit is disabled with zero nodes.
    expect(screen.getByRole("button", { name: /^submit$/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /add concept alpha to canvas/i }));
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 1,
      max: 1,
      success: true,
    });
  });

  it("dragging a node updates its position via pointer events", () => {
    const onPersist = vi.fn();
    render(<Component config={baseCfg} onSubmit={vi.fn()} onPersist={onPersist} />);

    const nucleusBtn = screen.getByRole("button", { name: /node nucleus/i });
    const canvas = document.querySelector(".kukui-cm__canvas") as HTMLElement;

    // Seed nucleus is at (0.2, 0.3) which on a 500×400 canvas is (100, 120).
    firePointer(nucleusBtn, "pointerDown", {
      clientX: 100,
      clientY: 120,
      button: 0,
      pointerId: 1,
    });
    firePointer(canvas, "pointerMove", {
      clientX: 350,
      clientY: 280,
      pointerId: 1,
    });
    firePointer(canvas, "pointerUp", {
      clientX: 350,
      clientY: 280,
      pointerId: 1,
    });

    // Persisted position should reflect the new normalized coords (0.7, 0.7).
    const lastPersistCall = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(lastPersistCall).toBeTruthy();
    const parsed = JSON.parse(lastPersistCall);
    const movedNode = parsed.nodes.find((n: { id: string }) => n.id === "nucleus");
    expect(movedNode).toBeDefined();
    expect(movedNode.position.x).toBeCloseTo(0.7, 2);
    expect(movedNode.position.y).toBeCloseTo(0.7, 2);
  });

  it("arrow keys nudge a focused node", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(<Component config={baseCfg} onSubmit={vi.fn()} onPersist={onPersist} />);
    const nucleusBtn = screen.getByRole("button", { name: /node nucleus/i });
    nucleusBtn.focus();
    // Initial nucleus is at (0.2, 0.3).
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowDown}");
    const lastPersistCall = onPersist.mock.calls.at(-1)?.[0] as string;
    const parsed = JSON.parse(lastPersistCall);
    const moved = parsed.nodes.find((n: { id: string }) => n.id === "nucleus");
    // Two right nudges = +0.04, one down = +0.02.
    expect(moved.position.x).toBeCloseTo(0.24, 2);
    expect(moved.position.y).toBeCloseTo(0.32, 2);
  });

  it("Clear all empties the canvas of nodes and edges", async () => {
    const user = userEvent.setup();
    render(<Component config={baseCfg} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /node nucleus/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /clear all nodes and edges/i }));
    expect(screen.queryByRole("button", { name: /node nucleus/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /node mitochondrion/i })).toBeNull();
  });

  it("persists state via onPersist on each meaningful change", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(<Component config={baseCfg} onSubmit={vi.fn()} onPersist={onPersist} />);
    // Initial mount fires once.
    const initialCallCount = onPersist.mock.calls.length;
    expect(initialCallCount).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /add concept ribosome to canvas/i }));
    expect(onPersist.mock.calls.length).toBeGreaterThan(initialCallCount);
    const last = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(last).toMatch(/"ribosome"/);
  });

  it("resumes submitted from suspendData (stage + attempts round-trip)", () => {
    const suspend = JSON.stringify({
      stage: "submitted",
      attempts: 2,
      nodes: [
        { id: "nucleus", label: "Nucleus", position: { x: 0.2, y: 0.3 } },
        { id: "ribosome", label: "Ribosome", position: { x: 0.5, y: 0.5 } },
      ],
      edges: [],
    });
    const onPersist = vi.fn();
    render(
      <Component
        config={baseCfg}
        onSubmit={vi.fn()}
        onPersist={onPersist}
        suspendData={suspend}
      />,
    );
    // Submitted learner resumes submitted: no Submit button, Try again shown.
    expect(screen.queryByRole("button", { name: /^submit$/i })).toBeNull();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    // Nodes restored but locked.
    expect(screen.getByRole("button", { name: /node ribosome/i })).toBeDisabled();
    // Persisted payload round-trips stage + attempts.
    const persisted = JSON.parse(onPersist.mock.calls.at(-1)?.[0] as string);
    expect(persisted.stage).toBe("submitted");
    expect(persisted.attempts).toBe(2);
  });

  it("palette chip: pointerdown + plain click places the node and clears pending placement", () => {
    render(<Component config={baseCfg} onSubmit={vi.fn()} />);
    const chip = screen.getByRole("button", { name: /add concept ribosome to canvas/i });
    const canvas = document.querySelector(".kukui-cm__canvas") as HTMLElement;

    // Press starts a pending placement…
    firePointer(chip, "pointerDown", { clientX: 600, clientY: 100, pointerId: 1 });
    expect(canvas.classList.contains("is-placing")).toBe(true);

    // …and releasing on the chip itself (a plain click) places at centre and
    // clears the pending state instead of leaving the canvas stuck in
    // "is-placing" mode.
    fireEvent.click(chip, { clientX: 600, clientY: 100 });
    expect(screen.getByRole("button", { name: /node ribosome/i })).toBeInTheDocument();
    expect(canvas.classList.contains("is-placing")).toBe(false);
  });

  it("palette chip: press then release over the canvas places the node at the pointerup coords", () => {
    const onPersist = vi.fn();
    render(<Component config={baseCfg} onSubmit={vi.fn()} onPersist={onPersist} />);
    const chip = screen.getByRole("button", { name: /add concept ribosome to canvas/i });
    const canvas = document.querySelector(".kukui-cm__canvas") as HTMLElement;

    firePointer(chip, "pointerDown", { clientX: 600, clientY: 100, pointerId: 1 });
    // Release over the canvas at (250, 100) on a 500x400 rect -> (0.5, 0.25).
    firePointer(canvas, "pointerUp", { clientX: 250, clientY: 100, pointerId: 1 });

    expect(screen.getByRole("button", { name: /node ribosome/i })).toBeInTheDocument();
    expect(canvas.classList.contains("is-placing")).toBe(false);
    const persisted = JSON.parse(onPersist.mock.calls.at(-1)?.[0] as string);
    const placed = persisted.nodes.find((n: { id: string }) => n.id === "ribosome");
    expect(placed.position.x).toBeCloseTo(0.5, 2);
    expect(placed.position.y).toBeCloseTo(0.25, 2);
  });

  it("edge handles are real buttons: Enter selects, Delete removes", async () => {
    const user = userEvent.setup();
    render(<Component config={baseCfg} onSubmit={vi.fn()} />);
    // Draw nucleus -> mitochondrion.
    await user.click(screen.getByRole("button", { name: /draw an edge/i }));
    await user.click(screen.getByRole("button", { name: /node nucleus/i }));
    await user.click(screen.getByRole("button", { name: /node mitochondrion/i }));

    const handle = screen.getByRole("button", {
      name: /edge from nucleus to mitochondrion/i,
    });
    const deleteTool = screen.getByRole("button", { name: /delete the selected/i });
    expect(deleteTool).toBeDisabled();

    // Native <button>: Enter activates it, selecting the edge.
    handle.focus();
    await user.keyboard("{Enter}");
    expect(deleteTool).toBeEnabled();

    // Delete on the focused handle removes the edge.
    await user.keyboard("{Delete}");
    expect(
      screen.queryByRole("button", { name: /edge from nucleus to mitochondrion/i }),
    ).toBeNull();
  });

  it("free-text modal traps focus, adds on Enter, and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<Component config={baseCfg} onSubmit={vi.fn()} />);
    const addNodeBtn = screen.getByRole("button", { name: /add a node/i });
    addNodeBtn.focus();
    await user.click(addNodeBtn);

    // Input autofocuses.
    const input = screen.getByLabelText(/node label/i);
    expect(input).toHaveFocus();

    // Tab cycles inside the dialog: input -> Cancel -> (Add node disabled while
    // empty) -> back to input. Shift+Tab from the input wraps to the end.
    await user.tab();
    expect(screen.getByRole("button", { name: /cancel/i })).toHaveFocus();
    await user.tab();
    expect(input).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: /cancel/i })).toHaveFocus();

    // Escape closes and returns focus to the trigger.
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(addNodeBtn).toHaveFocus();

    // Re-open, type a label, Enter adds the node and restores focus again.
    await user.click(addNodeBtn);
    await user.keyboard("Golgi apparatus{Enter}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: /node golgi apparatus/i })).toBeInTheDocument();
    expect(addNodeBtn).toHaveFocus();
  });

  it("after submit, Try again resets the canvas to seed state when enableRetry is on", async () => {
    const user = userEvent.setup();
    render(<Component config={baseCfg} onSubmit={vi.fn()} />);
    // Add a node, then submit.
    await user.click(screen.getByRole("button", { name: /add concept ribosome to canvas/i }));
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    // Submit replaced by Try again
    expect(screen.queryByRole("button", { name: /^submit$/i })).toBeNull();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    // Ribosome was placed during the answering pass — seeds remain.
    expect(screen.getByRole("button", { name: /node ribosome/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /try again/i }));
    // After reset, seeds remain; ribosome is back in the palette.
    expect(screen.queryByRole("button", { name: /node ribosome/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: /add concept ribosome to canvas/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^submit$/i })).toBeInTheDocument();
  });
});
