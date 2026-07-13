import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { CoursePresentationEditor } from "./CoursePresentationEditor.js";

// An image slide with a direct src (no assetId) so the editor needs no
// IndexedDB to render its canvas in jsdom.
const baseConfig = {
  version: "1.0",
  title: "Deck",
  slides: [
    {
      id: "slide-1",
      title: "One",
      background: {
        kind: "image" as const,
        src: "https://example.test/s1.png",
        alt: "Slide one",
        naturalWidth: 1280,
        naturalHeight: 720,
      },
      overlays: [] as unknown[],
    },
  ],
};

const infoOverlay = {
  kind: "info" as const,
  id: "info-1",
  rect: { x: 0.4, y: 0.42, w: 0.2, h: 0.14 },
  label: "Spot",
  html: "<p>Detail</p>",
};

const overlayConfig = {
  ...baseConfig,
  slides: [{ ...baseConfig.slides[0]!, overlays: [infoOverlay] }],
};

/**
 * Stateful wrapper: applies each onChange back into props, like the Studio
 * shell does, so flows that depend on the committed config re-rendering
 * (auto-select after add, confirm-then-convert) behave as in the app.
 */
function Harness({
  initial,
  onChange = () => {},
}: {
  initial: Record<string, unknown>;
  onChange?: (next: unknown) => void;
}) {
  const [cfg, setCfg] = useState(initial);
  return (
    <CoursePresentationEditor
      config={cfg}
      onChange={(next) => {
        onChange(next);
        setCfg(next as Record<string, unknown>);
      }}
    />
  );
}

const getRail = () =>
  screen.getByRole("complementary", { name: /slide and interaction settings/i });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CoursePresentationEditor", () => {
  it("adds a valid checkpoint overlay seeded with a real MC config", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CoursePresentationEditor config={baseConfig} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /\+ checkpoint/i }));

    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)![0] as {
      slides: Array<{ overlays: Array<Record<string, unknown>> }>;
    };
    const overlays = next.slides[0]!.overlays;
    expect(overlays).toHaveLength(1);
    const o = overlays[0] as {
      kind: string;
      rect: Record<string, number>;
      activity: { kind: string; config: { answers?: unknown[] } };
    };
    expect(o.kind).toBe("checkpoint");
    expect(o.activity.kind).toBe("multipleChoice");
    expect(Array.isArray(o.activity.config.answers)).toBe(true);
    expect(o.activity.config.answers!.length).toBeGreaterThanOrEqual(2);
    // Rect is normalized 0..1.
    expect(o.rect.x).toBeGreaterThanOrEqual(0);
    expect(o.rect.w).toBeLessThanOrEqual(1);
  });

  it("adds an info hotspot overlay", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CoursePresentationEditor config={baseConfig} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /\+ hotspot/i }));

    const next = onChange.mock.calls.at(-1)![0] as {
      slides: Array<{ overlays: Array<{ kind: string; label: string }> }>;
    };
    expect(next.slides[0]!.overlays[0]!.kind).toBe("info");
    expect(typeof next.slides[0]!.overlays[0]!.label).toBe("string");
  });

  it("appends a blank slide via the add-slides menu", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CoursePresentationEditor config={baseConfig} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /\+ add slides/i }));
    await user.click(screen.getByRole("menuitem", { name: /blank slide/i }));

    const next = onChange.mock.calls.at(-1)![0] as { slides: unknown[] };
    expect(next.slides).toHaveLength(2);
  });

  it("guides to PDF when a Google Slides link is imported", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CoursePresentationEditor config={baseConfig} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /\+ add slides/i }));
    await user.click(screen.getByRole("menuitem", { name: /google slides link/i }));
    await user.type(
      screen.getByLabelText(/google slides link/i),
      "https://docs.google.com/presentation/d/ABC/edit",
    );
    await user.click(screen.getByRole("button", { name: /import link/i }));

    expect(await screen.findByText(/can't be snapshotted directly/i)).toBeInTheDocument();
  });

  it("renders the overlay inspector in the rail when an overlay is selected", async () => {
    const user = userEvent.setup();
    render(<Harness initial={overlayConfig} />);

    // Before selection the rail shows the slide panel.
    expect(within(getRail()).getByLabelText(/slide title/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /info hotspot: spot/i }));

    const rail = getRail();
    expect(within(rail).getByLabelText(/hotspot label/i)).toBeInTheDocument();
    expect(within(rail).getByLabelText(/revealed content/i)).toBeInTheDocument();
  });

  it("moves the focused overlay right by 0.01 on ArrowRight", () => {
    const onChange = vi.fn();
    render(<CoursePresentationEditor config={overlayConfig} onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole("button", { name: /info hotspot: spot/i }), {
      key: "ArrowRight",
    });

    const next = onChange.mock.calls.at(-1)![0] as {
      slides: Array<{ overlays: Array<{ rect: { x: number; w: number } }> }>;
    };
    expect(next.slides[0]!.overlays[0]!.rect.x).toBeCloseTo(0.41, 5);
    expect(next.slides[0]!.overlays[0]!.rect.w).toBeCloseTo(0.2, 5);
  });

  it("grows the focused overlay by 0.01 on Shift+ArrowRight", () => {
    // Give the board a real size so minNormalized's 44px floor stays below
    // the rect (jsdom reports 0x0 otherwise, forcing a 0.5 minimum).
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
    const onChange = vi.fn();
    render(<CoursePresentationEditor config={overlayConfig} onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole("button", { name: /info hotspot: spot/i }), {
      key: "ArrowRight",
      shiftKey: true,
    });

    const next = onChange.mock.calls.at(-1)![0] as {
      slides: Array<{ overlays: Array<{ rect: { x: number; w: number } }> }>;
    };
    expect(next.slides[0]!.overlays[0]!.rect.w).toBeCloseTo(0.21, 5);
    expect(next.slides[0]!.overlays[0]!.rect.x).toBeCloseTo(0.4, 5);
  });

  it("removes the focused overlay on Delete", () => {
    const onChange = vi.fn();
    render(<CoursePresentationEditor config={overlayConfig} onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole("button", { name: /info hotspot: spot/i }), {
      key: "Delete",
    });

    const next = onChange.mock.calls.at(-1)![0] as {
      slides: Array<{ overlays: unknown[] }>;
    };
    expect(next.slides[0]!.overlays).toHaveLength(0);
  });

  it("opens the rail inspector and focuses its first field on Enter", () => {
    render(<Harness initial={overlayConfig} />);

    fireEvent.keyDown(screen.getByRole("button", { name: /info hotspot: spot/i }), {
      key: "Enter",
    });

    const rail = getRail();
    const label = within(rail).getByLabelText(/hotspot label/i);
    expect(label).toBeInTheDocument();
    expect(label).toHaveFocus();
  });

  it("warns before converting a slide with interactions to blank, and only converts on confirm", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={overlayConfig} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /convert to blank/i }));

    expect(
      screen.getByText(/this slide has 1 interaction; a blank slide hides them\. convert anyway\?/i),
    ).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    // Cancel keeps the image background.
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/a blank slide hides them/i),
    ).not.toBeInTheDocument();

    // Confirm converts.
    await user.click(screen.getByRole("button", { name: /convert to blank/i }));
    await user.click(screen.getByRole("button", { name: /^convert$/i }));

    const next = onChange.mock.calls.at(-1)![0] as {
      slides: Array<{ background: { kind: string } }>;
    };
    expect(next.slides[0]!.background.kind).toBe("blank");
  });

  it("renders the staged three-step card when there are no slides", () => {
    render(<CoursePresentationEditor config={{ ...baseConfig, slides: [] }} onChange={vi.fn()} />);

    expect(screen.getByText(/import your slides \(pdf\)/i)).toBeInTheDocument();
    expect(screen.getByText(/drop hotspots and checkpoints onto them/i)).toBeInTheDocument();
    expect(screen.getByText(/preview as a learner with the live toggle/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^import pdf$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start from a blank slide/i })).toBeInTheDocument();
    expect(screen.getByText(/have a google slides link\?/i)).toBeInTheDocument();
  });

  it("auto-selects a newly added checkpoint and shows its inspector in the rail", async () => {
    const user = userEvent.setup();
    render(<Harness initial={baseConfig} />);

    await user.click(screen.getByRole("button", { name: /\+ checkpoint/i }));

    const rail = getRail();
    expect(within(rail).getByRole("checkbox", { name: /required/i })).toBeInTheDocument();
    expect(within(rail).getByRole("combobox", { name: /type/i })).toHaveValue("multipleChoice");
  });
});
