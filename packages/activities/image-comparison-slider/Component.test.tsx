import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ImageComparisonSliderConfig } from "./schema.js";
import Component from "./Component.js";

/**
 * jsdom's PointerEvent ignores clientX from the init dict (it only honors
 * coordinates on MouseEvent), so a plain fireEvent.pointerMove(el,{clientX})
 * arrives with clientX === 0. Force the coordinate onto the event before
 * dispatch so the drag math sees a real pointer position.
 */
function firePointer(
  kind: "pointerDown" | "pointerMove" | "pointerUp",
  el: HTMLElement,
  init: { pointerId: number; clientX: number; button?: number },
) {
  const ev = createEvent[kind](el, init);
  Object.defineProperty(ev, "clientX", { value: init.clientX, configurable: true });
  fireEvent(el, ev);
}

const cfg: ImageComparisonSliderConfig = {
  version: "1.0",
  title: "Wrist X-ray",
  prompt: "<p>Slide the seam to compare a healthy and fractured wrist.</p>",
  before: {
    src: "https://placehold.co/600x450?text=Before",
    alt: "Healthy wrist X-ray",
    caption: "Healthy",
  },
  after: {
    src: "https://placehold.co/600x450?text=After",
    alt: "Fractured wrist X-ray",
    caption: "Fractured",
  },
  initialPosition: 0.5,
};

/**
 * Mock the stage's bounding rect so click coordinates map to deterministic
 * seam positions. JSDOM otherwise reports 0×0 for layout-less elements.
 */
function mockStageRect(width = 400, left = 0): () => void {
  const original = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.classList.contains("kukui-ics__stage")) {
      return {
        x: left,
        y: 0,
        left,
        top: 0,
        right: left + width,
        bottom: 300,
        width,
        height: 300,
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

describe("ImageComparisonSlider", () => {
  let restoreRect: () => void = () => {};

  beforeEach(() => {
    restoreRect = mockStageRect(400, 0);
  });

  afterEach(() => {
    restoreRect();
  });

  it("renders title, prompt, both images, and the seam slider", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /wrist x-ray/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/slide the seam/i)).toBeInTheDocument();
    expect(screen.getByAltText(/healthy wrist x-ray/i)).toBeInTheDocument();
    expect(screen.getByAltText(/fractured wrist x-ray/i)).toBeInTheDocument();
    const seam = screen.getByRole("slider", { name: /comparison seam/i });
    expect(seam).toHaveAttribute("aria-valuenow", "50");
    expect(seam).toHaveAttribute("aria-valuemin", "0");
    expect(seam).toHaveAttribute("aria-valuemax", "100");
  });

  it("clicking the stage at 25% jumps the seam to 25", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    const stage = document.querySelector(".kukui-ics__stage") as HTMLElement;
    expect(stage).not.toBeNull();
    // Click at clientX=100 in a 400-px-wide stage → 25%.
    await user.pointer({ target: stage, coords: { clientX: 100, clientY: 50 }, keys: "[MouseLeft]" });
    const seam = screen.getByRole("slider", { name: /comparison seam/i });
    expect(seam).toHaveAttribute("aria-valuenow", "25");
  });

  it("Left/Right arrow keys nudge by 1%, Home/End jump to ends", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    const seam = screen.getByRole("slider", { name: /comparison seam/i });
    seam.focus();
    expect(seam).toHaveAttribute("aria-valuenow", "50");

    await user.keyboard("{ArrowRight}");
    expect(seam).toHaveAttribute("aria-valuenow", "51");

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(seam).toHaveAttribute("aria-valuenow", "49");

    await user.keyboard("{Home}");
    expect(seam).toHaveAttribute("aria-valuenow", "0");

    await user.keyboard("{End}");
    expect(seam).toHaveAttribute("aria-valuenow", "100");
  });

  it("Done calls onSubmit with raw=1, max=1, success=true", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /^done$/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 1,
      max: 1,
      success: true,
    });
    expect(typeof onSubmit.mock.calls[0]?.[0].suspendData).toBe("string");
  });

  it("persists state via onPersist when the seam moves", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(
      <Component
        config={cfg}
        onSubmit={vi.fn()}
        onPersist={onPersist}
      />,
    );
    const seam = screen.getByRole("slider", { name: /comparison seam/i });
    seam.focus();
    await user.keyboard("{ArrowRight}");
    expect(onPersist).toHaveBeenCalled();
    const lastCall = onPersist.mock.calls.at(-1);
    expect(lastCall?.[0]).toMatch(/"position":/);
  });

  it("when headingLevel=2 is passed, the title renders as h2", () => {
    render(
      <Component
        config={cfg}
        onSubmit={vi.fn()}
        headingLevel={2}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: /wrist x-ray/i }),
    ).toBeInTheDocument();
  });

  /** Stub pointer-capture APIs jsdom doesn't implement, then drag the seam. */
  function dragSeam(seam: HTMLElement, fromX: number, toX: number) {
    Object.assign(seam, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
    });
    fireEvent.pointerDown(seam, { pointerId: 1, button: 0, clientX: fromX });
    fireEvent.pointerMove(seam, { pointerId: 1, clientX: toX });
    fireEvent.pointerUp(seam, { pointerId: 1, clientX: toX });
  }

  it("dragging the seam persists once on release, not per pointermove", () => {
    // jsdom reports zero-size rects, so give the measured wrapper a real
    // geometry (left 0, width 400) for the drag math: clientX 100 -> 25%.
    const rectSpy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockReturnValue({
        left: 0,
        width: 400,
        top: 0,
        height: 300,
        right: 400,
        bottom: 300,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);
    const onPersist = vi.fn();
    render(<Component config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />);
    const seam = screen.getByRole("slider", { name: /comparison seam/i });
    Object.assign(seam, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
    });

    firePointer("pointerDown", seam, { pointerId: 1, button: 0, clientX: 200 });
    firePointer("pointerMove", seam, { pointerId: 1, clientX: 160 });
    firePointer("pointerMove", seam, { pointerId: 1, clientX: 120 });
    firePointer("pointerMove", seam, { pointerId: 1, clientX: 100 });
    // The seam tracks the pointer live, but nothing has been persisted yet.
    expect(seam).toHaveAttribute("aria-valuenow", "25");
    expect(onPersist).not.toHaveBeenCalled();

    firePointer("pointerUp", seam, { pointerId: 1, clientX: 100 });
    expect(onPersist).toHaveBeenCalledTimes(1);
    expect(onPersist.mock.calls[0]?.[0]).toMatch(/"position":0\.25/);
    rectSpy.mockRestore();
  });

  it("autoSnap returns the seam to 50% on release", () => {
    const snapCfg: ImageComparisonSliderConfig = {
      ...cfg,
      behaviour: { autoSnap: true },
    };
    render(<Component config={snapCfg} onSubmit={vi.fn()} />);
    const seam = screen.getByRole("slider", { name: /comparison seam/i });
    dragSeam(seam, 200, 100);
    expect(seam).toHaveAttribute("aria-valuenow", "50");
  });

  it("resumes seam position and done stage from suspendData", () => {
    const { unmount } = render(
      <Component
        config={cfg}
        onSubmit={vi.fn()}
        suspendData={JSON.stringify({ position: 0.3, done: false })}
      />,
    );
    expect(
      screen.getByRole("slider", { name: /comparison seam/i }),
    ).toHaveAttribute("aria-valuenow", "30");
    unmount();

    render(
      <Component
        config={cfg}
        onSubmit={vi.fn()}
        suspendData={JSON.stringify({ position: 0.7, done: true })}
      />,
    );
    expect(screen.getByText(/marked complete/i)).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /comparison seam/i })).toBeDisabled();
  });

  it("empty state: without both images, Done is disabled and guidance shows", () => {
    const onSubmit = vi.fn();
    const empty: ImageComparisonSliderConfig = {
      ...cfg,
      before: undefined,
      after: undefined,
    };
    render(<Component config={empty} onSubmit={onSubmit} />);
    expect(
      screen.getByText(/add a before and an after image/i),
    ).toBeInTheDocument();
    const done = screen.getByRole("button", { name: /^done$/i });
    expect(done).toBeDisabled();
    fireEvent.click(done);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Try again after Done re-enables the seam and resets to the initial position", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    const seam = screen.getByRole("slider", { name: /comparison seam/i });
    seam.focus();
    await user.keyboard("{End}");
    expect(seam).toHaveAttribute("aria-valuenow", "100");

    await user.click(screen.getByRole("button", { name: /^done$/i }));
    expect(screen.getByText(/marked complete/i)).toBeInTheDocument();

    // scoring.enableRetry defaults on for completion activities.
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(seam).toBeEnabled();
    expect(seam).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByRole("button", { name: /^done$/i })).toBeInTheDocument();
  });

  it("scoring.enableRetry:false hides Try again after Done", async () => {
    const user = userEvent.setup();
    const noRetry: ImageComparisonSliderConfig = {
      ...cfg,
      scoring: { mode: "completion", enableRetry: false },
    };
    render(<Component config={noRetry} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^done$/i }));
    expect(screen.getByText(/marked complete/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
  });

  it("checkpoint positions are exposed to screen readers, not aria-hidden", () => {
    const withPrompts: ImageComparisonSliderConfig = {
      ...cfg,
      prompts: [{ position: 0.25, question: "Find the fracture line." }],
    };
    render(<Component config={withPrompts} onSubmit={vi.fn()} />);
    const item = screen.getByText(/find the fracture line/i).closest("li")!;
    const pos = item.querySelector(".kukui-ics__prompt-pos")!;
    expect(pos.getAttribute("aria-hidden")).toBeNull();
    expect(pos.textContent).toMatch(/seam position\s*25%/i);
  });
});
