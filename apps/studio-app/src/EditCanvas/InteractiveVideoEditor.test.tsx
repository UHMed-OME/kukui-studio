import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { InteractiveVideoEditor } from "./InteractiveVideoEditor.js";

// Use an html5 source so the test doesn't try to load the YouTube IFrame API.
const baseConfig = {
  version: "1.0",
  title: "Demo",
  video: { src: "https://example.test/clip.mp4", type: "html5" as const },
  interactions: [],
};

type IVConfig = Record<string, unknown>;

/**
 * Stateful wrapper: echoes each onChange back into props like the Studio shell,
 * so flows that depend on the committed config re-rendering behave as in the app.
 */
function Harness({
  initial,
  onChange = () => {},
}: {
  initial: IVConfig;
  onChange?: (next: IVConfig) => void;
}) {
  const [cfg, setCfg] = useState(initial);
  return (
    <InteractiveVideoEditor
      config={cfg}
      onChange={(next) => {
        onChange(next as IVConfig);
        setCfg(next as IVConfig);
      }}
    />
  );
}

/** An MC interaction at 0:30, pre-selected by clicking its 0:30 marker. */
const mcConfig = {
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

  const selectFirstMarker = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: /0:30/ }));
  };

  it("toggles pauseOnReach and shows/clears the no-pause warning banner", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={mcConfig} onChange={onChange} />);
    await selectFirstMarker(user);

    // A pausing MC checkpoint exists, so no warning yet.
    expect(screen.queryByText(/no checkpoint pauses the video/i)).not.toBeInTheDocument();

    // Uncheck "Pause and wait for an answer" -> pauseOnReach false + warning.
    await user.click(screen.getByRole("checkbox", { name: /pause and wait for an answer/i }));
    let next = onChange.mock.calls.at(-1)![0] as {
      interactions: Array<{ pauseOnReach?: boolean }>;
    };
    expect(next.interactions[0]!.pauseOnReach).toBe(false);
    expect(screen.getByText(/no checkpoint pauses the video/i)).toBeInTheDocument();
    expect(
      screen.getByText(/plays through without stopping; auto-counts as viewed/i),
    ).toBeInTheDocument();

    // Re-check -> warning clears.
    await user.click(screen.getByRole("checkbox", { name: /pause and wait for an answer/i }));
    next = onChange.mock.calls.at(-1)![0] as {
      interactions: Array<{ pauseOnReach?: boolean }>;
    };
    expect(next.interactions[0]!.pauseOnReach).toBe(true);
    expect(screen.queryByText(/no checkpoint pauses the video/i)).not.toBeInTheDocument();
  });

  it("switches kind to fill-in-the-blanks, seeds a valid config, and shows the cloze editor", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={mcConfig} onChange={onChange} />);
    await selectFirstMarker(user);

    await user.selectOptions(
      screen.getByRole("combobox", { name: /type/i }),
      "fillInTheBlanks",
    );

    const next = onChange.mock.calls.at(-1)![0] as {
      interactions: Array<{ kind: string; config: { text?: unknown } }>;
    };
    expect(next.interactions[0]!.kind).toBe("fillInTheBlanks");
    expect(typeof next.interactions[0]!.config.text).toBe("string");
    expect(screen.getByText(/cloze text/i)).toBeInTheDocument();
  });

  it("switches kind to reflection and shows the prompt editor with a seeded config", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={mcConfig} onChange={onChange} />);
    await selectFirstMarker(user);

    await user.selectOptions(
      screen.getByRole("combobox", { name: /type/i }),
      "reflection",
    );

    const next = onChange.mock.calls.at(-1)![0] as {
      interactions: Array<{ kind: string; config: { prompt?: unknown } }>;
    };
    expect(next.interactions[0]!.kind).toBe("reflection");
    expect(typeof next.interactions[0]!.config.prompt).toBe("string");
    expect(screen.getByLabelText(/reflection prompt/i)).toBeInTheDocument();
  });

  it("switches kind to an info card (label) and shows its content editor", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={mcConfig} onChange={onChange} />);
    await selectFirstMarker(user);

    await user.selectOptions(
      screen.getByRole("combobox", { name: /type/i }),
      "label",
    );

    const next = onChange.mock.calls.at(-1)![0] as {
      interactions: Array<{ kind: string; config: { html?: unknown } }>;
    };
    expect(next.interactions[0]!.kind).toBe("label");
    expect(typeof next.interactions[0]!.config.html).toBe("string");
    expect(screen.getByLabelText(/info card content/i)).toBeInTheDocument();
  });

  it("round-trips a fill-in-the-blanks cloze edit into config.text", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={mcConfig} onChange={onChange} />);
    await selectFirstMarker(user);
    await user.selectOptions(
      screen.getByRole("combobox", { name: /type/i }),
      "fillInTheBlanks",
    );

    const cloze = screen.getByLabelText(/cloze text/i) as HTMLTextAreaElement;
    await user.clear(cloze);
    await user.type(cloze, "Water is *H2O*.");

    const next = onChange.mock.calls.at(-1)![0] as {
      interactions: Array<{ config: { text?: string } }>;
    };
    expect(next.interactions[0]!.config.text).toBe("Water is *H2O*.");
  });

  it("writes video.startAt/endAt and rejects an end at or before the start", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={baseConfig} onChange={onChange} />);

    const start = screen.getByLabelText(/start \(m:ss\)/i) as HTMLInputElement;
    await user.clear(start);
    await user.type(start, "0:05");
    fireEvent.blur(start);

    const end = screen.getByLabelText(/end \(m:ss\)/i) as HTMLInputElement;
    await user.clear(end);
    await user.type(end, "0:20");
    fireEvent.blur(end);

    let next = onChange.mock.calls.at(-1)![0] as {
      video: { startAt?: number; endAt?: number };
    };
    expect(next.video.startAt).toBe(5);
    expect(next.video.endAt).toBe(20);

    // An end at or before the start is rejected (config unchanged) with an error.
    const calls = onChange.mock.calls.length;
    await user.clear(end);
    await user.type(end, "0:03");
    fireEvent.blur(end);

    expect(screen.getByText(/end must be after start/i)).toBeInTheDocument();
    expect(onChange.mock.calls.length).toBe(calls); // no new commit
    next = onChange.mock.calls.at(-1)![0] as {
      video: { startAt?: number; endAt?: number };
    };
    expect(next.video.endAt).toBe(20);
  });

  it("adds a chapter at the playhead", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={baseConfig} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /add chapter at/i }));

    const next = onChange.mock.calls.at(-1)![0] as {
      chapters: Array<{ id: string; atSeconds: number; title: string }>;
    };
    expect(next.chapters).toHaveLength(1);
    expect(next.chapters[0]!.atSeconds).toBe(0);
    expect(typeof next.chapters[0]!.id).toBe("string");
  });

  it("writes onWrong.seekTo on Rewatch and clears it on Continue", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={mcConfig} onChange={onChange} />);
    await selectFirstMarker(user);

    const behaviour = screen.getByRole("combobox", { name: /^behaviour$/i });
    await user.selectOptions(behaviour, "rewatch");

    let next = onChange.mock.calls.at(-1)![0] as {
      interactions: Array<{ onWrong?: { seekTo: number; maxReplays?: number } }>;
    };
    expect(next.interactions[0]!.onWrong).toBeDefined();
    expect(typeof next.interactions[0]!.onWrong!.seekTo).toBe("number");

    await user.selectOptions(behaviour, "continue");
    next = onChange.mock.calls.at(-1)![0] as {
      interactions: Array<{ onWrong?: { seekTo: number } }>;
    };
    expect(next.interactions[0]!.onWrong).toBeUndefined();
  });

  it("toggles the end-of-video summary behaviour", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={baseConfig} onChange={onChange} />);

    await user.click(screen.getByRole("checkbox", { name: /show an end-of-video summary/i }));

    const next = onChange.mock.calls.at(-1)![0] as {
      behaviour: { showSummary?: boolean };
    };
    expect(next.behaviour.showSummary).toBe(false);
  });
});
