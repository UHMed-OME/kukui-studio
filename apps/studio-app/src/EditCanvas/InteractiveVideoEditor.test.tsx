import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InteractiveVideoEditor } from "./InteractiveVideoEditor.js";

// Use an html5 source so the test doesn't try to load the YouTube IFrame API.
const baseConfig = {
  version: "1.0",
  title: "Demo",
  video: { src: "https://example.test/clip.mp4", type: "html5" as const },
  interactions: [],
};

describe("InteractiveVideoEditor", () => {
  it("adds a valid multiple-choice interaction when '+ Add interaction' is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<InteractiveVideoEditor config={baseConfig} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /add interaction/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]![0] as { interactions: unknown[] };
    expect(next.interactions).toHaveLength(1);
    const it0 = next.interactions[0] as Record<string, unknown>;
    expect(it0.kind).toBe("multipleChoice");
    expect(typeof it0.id).toBe("string");
    expect((it0.id as string).length).toBeGreaterThan(0);
    // The seeded config must be a real MC config, not an empty object.
    const cfg = it0.config as { answers?: unknown[] };
    expect(Array.isArray(cfg.answers)).toBe(true);
    expect(cfg.answers!.length).toBeGreaterThanOrEqual(2);
  });

  it("shows an inspector for an existing interaction and edits its time as a timecode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const cfg = {
      ...baseConfig,
      interactions: [
        {
          id: "iv-1",
          atSeconds: 30,
          required: true,
          kind: "multipleChoice" as const,
          config: {
            version: "1.0",
            title: "Q",
            question: "<p>Q?</p>",
            answers: [
              { text: "A", correct: true },
              { text: "B", correct: false },
            ],
          },
        },
      ],
    };
    render(<InteractiveVideoEditor config={cfg} onChange={onChange} />);

    // Select the marker (labelled with its timecode 0:30).
    await user.click(screen.getByRole("button", { name: /0:30/ }));
    // Inspector appears.
    const timeInput = screen.getByLabelText("Time (m:ss)") as HTMLInputElement;
    expect(timeInput).toBeInTheDocument();

    // Type a new timecode and commit on blur — 0:45 → 45 seconds (within the
    // 60s fallback clip length, so it isn't clamped).
    await user.clear(timeInput);
    await user.type(timeInput, "0:45");
    fireEvent.blur(timeInput);

    const lastCall = onChange.mock.calls.at(-1)![0] as {
      interactions: Array<{ atSeconds: number }>;
    };
    expect(lastCall.interactions[0]!.atSeconds).toBe(45);
  });
});
