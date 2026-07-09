import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ImageAnnotationConfig } from "./schema.js";
import Component from "./Component.js";

// Raw CSS source, so the stroke-width fix can be asserted directly (JSDOM
// does not apply imported stylesheets to computed style). Vitest runs with
// the repo root as cwd.
const cssText = readFileSync(
  resolve(process.cwd(), "packages/activities/image-annotation/Component.css"),
  "utf8",
);

/**
 * JSDOM 25 doesn't expose a working `PointerEvent` constructor, so
 * `fireEvent.pointerDown(el, { clientX, clientY })` falls through to a
 * generic Event and React reads `clientX`/`clientY` as NaN. We construct
 * the event ourselves and define the pointer-specific properties before
 * dispatch so React sees real coordinates.
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

const cfg: ImageAnnotationConfig = {
  version: "1.0",
  title: "Annotate the chest X-ray",
  prompt: "<p>Circle any visible <strong>findings</strong> in the image.</p>",
  image: {
    src: "https://placehold.co/800x600?text=Chest+X-ray",
    alt: "Frontal chest X-ray",
  },
  behaviour: { enableRetry: true },
  ui: { submitButtonLabel: "Submit", clearButton: "Clear all" },
};

const cfgWithExpected: ImageAnnotationConfig = {
  ...cfg,
  expectedAnnotations: [
    { id: "lesion", rect: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 }, label: "Lesion" },
  ],
};

/**
 * JSDOM reports 0×0 for layout-less SVG. Mock the SVG bounding rect so
 * pointer-event clientX/clientY values map to deterministic 0..1 coords.
 * Width 400, height 300, top-left at (0, 0).
 */
function mockSvgRect(width = 400, height = 300): () => void {
  const original = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    if (this instanceof SVGElement) {
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
    Element.prototype.getBoundingClientRect = original;
  };
}

describe("ImageAnnotation", () => {
  let restoreRect: () => void = () => {};

  beforeEach(() => {
    restoreRect = mockSvgRect(400, 300);
  });

  afterEach(() => {
    restoreRect();
  });

  it("renders title, prompt, image, and the toolbar with all default tools", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /annotate the chest x-ray/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/circle any visible/i)).toBeInTheDocument();
    expect(screen.getByAltText(/frontal chest x-ray/i)).toBeInTheDocument();

    const toolbar = screen.getByRole("toolbar", { name: /annotation tools/i });
    expect(toolbar).toBeInTheDocument();

    // Rectangle, Circle, Arrow, Freehand, Eraser tools (each has aria-pressed).
    const toolButtons = within(toolbar)
      .getAllByRole("button")
      .filter((b) => b.hasAttribute("aria-pressed"));
    expect(toolButtons).toHaveLength(5);

    // Rectangle is selected by default.
    expect(
      within(toolbar).getByRole("button", { name: /^rectangle$/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("clicking a different tool selects it (aria-pressed flips)", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    const circle = screen.getByRole("button", { name: /^circle$/i });
    expect(circle).toHaveAttribute("aria-pressed", "false");
    await user.click(circle);
    expect(circle).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /^rectangle$/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("draws a rectangle via simulated pointer events and persists the shape", () => {
    const onPersist = vi.fn();
    render(
      <Component
        config={cfg}
        onSubmit={vi.fn()}
        onPersist={onPersist}
      />,
    );
    const svg = screen.getByTestId("kukui-ia-svg");

    // Stage 400x300; rectangle from (40, 30) → (200, 180) ≈ (0.1, 0.1) → (0.5, 0.6).
    firePointer(svg, "pointerDown", { clientX: 40, clientY: 30, button: 0, pointerId: 1 });
    firePointer(svg, "pointerMove", { clientX: 200, clientY: 180, pointerId: 1 });
    firePointer(svg, "pointerUp", { clientX: 200, clientY: 180, pointerId: 1 });

    // One rect in the SVG, with the rectangle data-kind.
    const shape = svg.querySelector('[data-kind="rectangle"]');
    expect(shape).not.toBeNull();

    // Persist payload includes the shape with kind=rectangle.
    expect(onPersist).toHaveBeenCalled();
    const last = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(last).toMatch(/"kind":"rectangle"/);
  });

  it("Clear all removes every shape", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    const svg = screen.getByTestId("kukui-ia-svg");

    // Draw two rectangles.
    firePointer(svg, "pointerDown", { clientX: 10, clientY: 10, button: 0, pointerId: 1 });
    firePointer(svg, "pointerMove", { clientX: 80, clientY: 80, pointerId: 1 });
    firePointer(svg, "pointerUp", { clientX: 80, clientY: 80, pointerId: 1 });

    firePointer(svg, "pointerDown", { clientX: 100, clientY: 100, button: 0, pointerId: 2 });
    firePointer(svg, "pointerMove", { clientX: 180, clientY: 180, pointerId: 2 });
    firePointer(svg, "pointerUp", { clientX: 180, clientY: 180, pointerId: 2 });

    expect(svg.querySelectorAll("[data-kind]")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));
    expect(svg.querySelectorAll("[data-kind]")).toHaveLength(0);
  });

  it("Submit (no expectedAnnotations) calls onSubmit with raw=1, max=1, success=true", () => {
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    const svg = screen.getByTestId("kukui-ia-svg");

    firePointer(svg, "pointerDown", { clientX: 40, clientY: 30, button: 0, pointerId: 1 });
    firePointer(svg, "pointerMove", { clientX: 200, clientY: 180, pointerId: 1 });
    firePointer(svg, "pointerUp", { clientX: 200, clientY: 180, pointerId: 1 });

    fireEvent.click(screen.getByRole("button", { name: /^submit$/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const arg = onSubmit.mock.calls[0]?.[0];
    expect(arg).toMatchObject({ raw: 1, max: 1, success: true });
    expect(typeof arg.suspendData).toBe("string");
    expect(arg.suspendData).toMatch(/"shapes":/);
  });

  it("submit with no shapes is disabled", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^submit$/i })).toBeDisabled();
  });

  it("scores by IoU when expectedAnnotations is set; ≥50% overlap = correct", () => {
    const onSubmit = vi.fn();
    render(<Component config={cfgWithExpected} onSubmit={onSubmit} />);
    const svg = screen.getByTestId("kukui-ia-svg");

    // Expected normalized rect: x 0.4..0.6, y 0.4..0.6 (i.e. 160..240 px in x,
    // 120..180 px in y on our 400×300 stage). Draw the same rect → IoU = 1.
    firePointer(svg, "pointerDown", { clientX: 160, clientY: 120, button: 0, pointerId: 1 });
    firePointer(svg, "pointerMove", { clientX: 240, clientY: 180, pointerId: 1 });
    firePointer(svg, "pointerUp", { clientX: 240, clientY: 180, pointerId: 1 });

    fireEvent.click(screen.getByRole("button", { name: /^submit$/i }));

    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 1,
      max: 1,
      success: true,
    });
  });

  it("when headingLevel=2 is passed, the title renders as h2", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} headingLevel={2} />);
    expect(
      screen.getByRole("heading", { level: 2, name: /annotate the chest x-ray/i }),
    ).toBeInTheDocument();
  });

  // Finding 1: shape strokes must be a visible width, not the old 0.005 user
  // units that (with non-scaling-stroke) rendered as an invisible hairline.
  it("renders shape strokes at a visible screen-pixel width", () => {
    // The .kukui-ia__shape rule sets stroke-width: 2 and never 0.005.
    expect(cssText).toMatch(/\.kukui-ia__shape\s*\{[^}]*stroke-width:\s*2\b/);
    expect(cssText).not.toMatch(/stroke-width:\s*0\.005/);
  });

  // Finding 2: the arrowhead marker must be sized off the (non-scaling) stroke
  // width, not in user space where 6 units is 6x the whole 0..1 canvas.
  it("sizes the arrowhead marker in strokeWidth units", () => {
    const { container } = render(<Component config={cfg} onSubmit={vi.fn()} />);
    const marker = container.querySelector("marker");
    expect(marker).not.toBeNull();
    expect(marker).toHaveAttribute("markerUnits", "strokeWidth");
    expect(marker).toHaveAttribute("markerWidth", "5");
    expect(marker).toHaveAttribute("markerHeight", "5");
  });

  // Finding 3: a non-pointer path to create and adjust an annotation.
  it("adds a rectangle via the button and nudges it with the keyboard", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    const svg = screen.getByTestId("kukui-ia-svg");

    fireEvent.click(screen.getByRole("button", { name: /add rectangle/i }));
    const rect = svg.querySelector('[data-kind="rectangle"]') as SVGRectElement;
    expect(rect).not.toBeNull();
    const x0 = parseFloat(rect.getAttribute("x") ?? "0");

    // The shape list exposes a focusable handle for the placed shape.
    const handle = screen.getByRole("button", { name: /rectangle 1\./i });
    handle.focus();
    fireEvent.keyDown(handle, { key: "ArrowRight" });

    const x1 = parseFloat(
      (svg.querySelector('[data-kind="rectangle"]') as SVGRectElement).getAttribute("x") ?? "0",
    );
    expect(x1).toBeGreaterThan(x0);

    // Delete removes it.
    fireEvent.keyDown(handle, { key: "Delete" });
    expect(svg.querySelector('[data-kind="rectangle"]')).toBeNull();
  });

  // Finding 5: submit's suspendData must carry submitted + attempts, not just shapes.
  it("submit serializes the full resume state (submitted + attempts)", () => {
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: /add rectangle/i }));
    fireEvent.click(screen.getByRole("button", { name: /^submit$/i }));

    const suspend = JSON.parse(onSubmit.mock.calls[0]?.[0].suspendData as string);
    expect(suspend.submitted).toBe(true);
    expect(suspend.attempts).toBe(1);
    expect(Array.isArray(suspend.shapes)).toBe(true);
  });

  // Finding 6: freehand + arrow marks are scored (they previously scored zero).
  it("scores a freehand mark that covers the expected region", () => {
    const onSubmit = vi.fn();
    render(<Component config={cfgWithExpected} onSubmit={onSubmit} />);
    const svg = screen.getByTestId("kukui-ia-svg");

    // Select freehand, then trace the expected rect (x 160..240, y 120..180).
    fireEvent.click(screen.getByRole("button", { name: /^freehand$/i }));
    firePointer(svg, "pointerDown", { clientX: 160, clientY: 120, button: 0, pointerId: 1 });
    firePointer(svg, "pointerMove", { clientX: 240, clientY: 120, pointerId: 1 });
    firePointer(svg, "pointerMove", { clientX: 240, clientY: 180, pointerId: 1 });
    firePointer(svg, "pointerMove", { clientX: 160, clientY: 180, pointerId: 1 });
    firePointer(svg, "pointerUp", { clientX: 160, clientY: 180, pointerId: 1 });

    fireEvent.click(screen.getByRole("button", { name: /^submit$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 1, max: 1, success: true });
  });

  it("scores an arrow by whether its tip lands inside the expected region", () => {
    // Miss: tip outside the region → 0.
    const onSubmitMiss = vi.fn();
    const { unmount } = render(<Component config={cfgWithExpected} onSubmit={onSubmitMiss} />);
    let svg = screen.getByTestId("kukui-ia-svg");
    fireEvent.click(screen.getByRole("button", { name: /^arrow$/i }));
    firePointer(svg, "pointerDown", { clientX: 10, clientY: 10, button: 0, pointerId: 1 });
    firePointer(svg, "pointerMove", { clientX: 40, clientY: 40, pointerId: 1 });
    firePointer(svg, "pointerUp", { clientX: 40, clientY: 40, pointerId: 1 });
    fireEvent.click(screen.getByRole("button", { name: /^submit$/i }));
    expect(onSubmitMiss.mock.calls[0]?.[0]).toMatchObject({ raw: 0, success: false });
    unmount();

    // Hit: tip inside the region (200,150 → 0.5,0.5) → 1.
    const onSubmitHit = vi.fn();
    render(<Component config={cfgWithExpected} onSubmit={onSubmitHit} />);
    svg = screen.getByTestId("kukui-ia-svg");
    fireEvent.click(screen.getByRole("button", { name: /^arrow$/i }));
    firePointer(svg, "pointerDown", { clientX: 300, clientY: 250, button: 0, pointerId: 2 });
    firePointer(svg, "pointerMove", { clientX: 200, clientY: 150, pointerId: 2 });
    firePointer(svg, "pointerUp", { clientX: 200, clientY: 150, pointerId: 2 });
    fireEvent.click(screen.getByRole("button", { name: /^submit$/i }));
    expect(onSubmitHit.mock.calls[0]?.[0]).toMatchObject({ raw: 1, max: 1, success: true });
  });

  // Finding 7: freehand drag must not persist on every vertex; only at drag end.
  it("persists once at the end of a freehand drag, not on every move", () => {
    const onPersist = vi.fn();
    render(<Component config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />);
    const svg = screen.getByTestId("kukui-ia-svg");
    fireEvent.click(screen.getByRole("button", { name: /^freehand$/i }));
    onPersist.mockClear();

    firePointer(svg, "pointerDown", { clientX: 40, clientY: 40, button: 0, pointerId: 1 });
    firePointer(svg, "pointerMove", { clientX: 60, clientY: 60, pointerId: 1 });
    firePointer(svg, "pointerMove", { clientX: 80, clientY: 80, pointerId: 1 });
    firePointer(svg, "pointerMove", { clientX: 100, clientY: 100, pointerId: 1 });
    // No persist mid-drag.
    expect(onPersist).not.toHaveBeenCalled();

    firePointer(svg, "pointerUp", { clientX: 100, clientY: 100, pointerId: 1 });
    expect(onPersist).toHaveBeenCalledTimes(1);
  });
});
