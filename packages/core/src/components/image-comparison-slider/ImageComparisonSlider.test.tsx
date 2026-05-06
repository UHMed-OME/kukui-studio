import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ImageComparisonSliderConfig } from "@kukui/schemas";
import { ImageComparisonSlider } from "./ImageComparisonSlider.js";

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
    render(<ImageComparisonSlider config={cfg} onSubmit={vi.fn()} />);
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
    render(<ImageComparisonSlider config={cfg} onSubmit={vi.fn()} />);
    const stage = document.querySelector(".kukui-ics__stage") as HTMLElement;
    expect(stage).not.toBeNull();
    // Click at clientX=100 in a 400-px-wide stage → 25%.
    await user.pointer({ target: stage, coords: { clientX: 100, clientY: 50 }, keys: "[MouseLeft]" });
    const seam = screen.getByRole("slider", { name: /comparison seam/i });
    expect(seam).toHaveAttribute("aria-valuenow", "25");
  });

  it("Left/Right arrow keys nudge by 1%, Home/End jump to ends", async () => {
    const user = userEvent.setup();
    render(<ImageComparisonSlider config={cfg} onSubmit={vi.fn()} />);
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
    render(<ImageComparisonSlider config={cfg} onSubmit={onSubmit} />);
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
      <ImageComparisonSlider
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
      <ImageComparisonSlider
        config={cfg}
        onSubmit={vi.fn()}
        headingLevel={2}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: /wrist x-ray/i }),
    ).toBeInTheDocument();
  });
});
