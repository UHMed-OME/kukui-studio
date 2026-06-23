import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("appends a blank slide", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CoursePresentationEditor config={baseConfig} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /blank slide/i }));

    const next = onChange.mock.calls.at(-1)![0] as { slides: unknown[] };
    expect(next.slides).toHaveLength(2);
  });

  it("guides to PDF when a Google Slides link is imported", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CoursePresentationEditor config={baseConfig} onChange={onChange} />);

    await user.type(
      screen.getByLabelText(/google slides link/i),
      "https://docs.google.com/presentation/d/ABC/edit",
    );
    await user.click(screen.getByRole("button", { name: /import link/i }));

    expect(await screen.findByText(/can't be snapshotted directly/i)).toBeInTheDocument();
  });
});
