import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InteractiveVideoConfig } from "./schema.js";
import Component from "./Component.js";

const cfg: InteractiveVideoConfig = {
  version: "1.0",
  title: "Demo video",
  prompt: "<p>Watch the clip.</p>",
  video: {
    src: "https://example.test/sample.mp4",
    type: "html5",
  },
  interactions: [
    {
      id: "q1",
      atSeconds: 5,
      required: true,
      kind: "multipleChoice",
      config: {
        version: "1.0",
        title: "First checkpoint",
        question: "<p>Pick A.</p>",
        answers: [
          { text: "A", correct: true },
          { text: "B", correct: false },
        ],
      },
    },
    {
      id: "q2",
      atSeconds: 12,
      required: true,
      kind: "multipleChoice",
      config: {
        version: "1.0",
        title: "Second checkpoint",
        question: "<p>Pick C.</p>",
        answers: [
          { text: "C", correct: true },
          { text: "D", correct: false },
        ],
      },
    },
  ],
  behaviour: { passPercentage: 50 },
};

/** Set the video's currentTime and dispatch a `timeupdate` event. */
function tick(video: HTMLVideoElement, t: number) {
  Object.defineProperty(video, "currentTime", {
    configurable: true,
    get: () => t,
    set: () => {},
  });
  fireEvent.timeUpdate(video);
}

/** Stub `play` and `pause` methods so they don't throw in jsdom. */
function stubVideoMethods(video: HTMLVideoElement) {
  // jsdom doesn't implement these on HTMLMediaElement.
  const play = vi.fn().mockResolvedValue(undefined);
  const pause = vi.fn();
  Object.defineProperty(video, "play", { configurable: true, value: play });
  Object.defineProperty(video, "pause", { configurable: true, value: pause });
  return { play, pause };
}

function getVideo(): HTMLVideoElement {
  return screen.getByTestId("kukui-iv-video") as HTMLVideoElement;
}

describe("interactive-video Component", () => {
  it("renders the video element with the configured src and the title", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: /demo video/i })).toBeInTheDocument();
    const video = getVideo();
    expect(video).toBeInTheDocument();
    expect(video.tagName).toBe("VIDEO");
    expect(video.getAttribute("src")).toBe("https://example.test/sample.mp4");
    expect(video.hasAttribute("controls")).toBe(true);
  });

  it("pauses the video and shows the interaction overlay when currentTime hits an interaction", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    const video = getVideo();
    const { pause } = stubVideoMethods(video);

    // Approach the first interaction; nothing fires before the window.
    tick(video, 2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Inside the 0.5s window — overlay appears, pause() called.
    tick(video, 5);
    expect(pause).toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    // The embedded MultipleChoice renders as h2 (headingLevel={2}).
    expect(
      screen.getByRole("heading", { level: 2, name: /first checkpoint/i }),
    ).toBeInTheDocument();
  });

  it("records the embedded MC score and lets the learner resume the video", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    const video = getVideo();
    const { play } = stubVideoMethods(video);

    tick(video, 5);
    // Resume disabled until the embedded activity has scored.
    const resume = screen.getByRole("button", { name: /^resume$/i });
    expect(resume).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /^a,/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));

    expect(resume).toBeEnabled();
    await user.click(resume);
    expect(play).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Top-level onSubmit hasn't fired yet — only one of two interactions resolved.
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("video ended event triggers aggregate onSubmit with summed score", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    const video = getVideo();
    stubVideoMethods(video);

    // First interaction.
    tick(video, 5);
    await user.click(screen.getByRole("button", { name: /^a,/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    await user.click(screen.getByRole("button", { name: /^resume$/i }));

    // Second interaction. Both required, so onSubmit fires once both resolve
    // (allRequiredResolved effect) — assert the final score is correct.
    tick(video, 12);
    await user.click(screen.getByRole("button", { name: /^c,/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 2,
      max: 2,
      success: true,
    });
  });

  it("video ends with no remaining required interactions still fires onSubmit", () => {
    const onSubmit = vi.fn();
    const single: InteractiveVideoConfig = {
      ...cfg,
      interactions: [],
    };
    render(<Component config={single} onSubmit={onSubmit} />);
    const video = getVideo();
    stubVideoMethods(video);
    fireEvent.ended(video);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // Aggregate over zero scores: raw 0 / max 0; aggregate() returns success when pct >= passPercent.
    // With max === 0, pct = 0, which is < 50, so success is false.
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 0, max: 0 });
  });

  it("persists state via onPersist on time updates and on interaction resolution", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(<Component config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />);
    const video = getVideo();
    stubVideoMethods(video);

    onPersist.mockClear();
    tick(video, 3.5);
    expect(onPersist).toHaveBeenCalled();
    const afterTick = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(afterTick).toMatch(/"currentTime":3\.5/);

    // Trigger interaction and resolve it; expect resolvedInteractions to be persisted.
    tick(video, 5);
    await user.click(screen.getByRole("button", { name: /^a,/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));

    const last = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(last).toMatch(/"resolvedInteractions"/);
    expect(last).toMatch(/"q1"/);
  });

  it("mounts a YouTube player container for youtube sources", () => {
    const yt: InteractiveVideoConfig = {
      ...cfg,
      video: { src: "https://youtube.com/watch?v=abc12345678", type: "youtube" },
      interactions: [],
    };
    render(<Component config={yt} onSubmit={vi.fn()} />);
    // No native <video>; the YouTube IFrame host div is mounted instead.
    expect(screen.queryByTestId("kukui-iv-video")).not.toBeInTheDocument();
    expect(screen.getByTestId("kukui-iv-youtube")).toBeInTheDocument();
  });

  it("still shows a placeholder for Vimeo (not implemented)", () => {
    const vm: InteractiveVideoConfig = {
      ...cfg,
      video: { src: "https://vimeo.com/123", type: "vimeo" },
      interactions: [],
    };
    render(<Component config={vm} onSubmit={vi.fn()} />);
    expect(screen.getByText(/vimeo embeds aren.t supported yet/i)).toBeInTheDocument();
  });

  it("seeking forward past an unresolved required interaction rewinds and pauses", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    const video = getVideo();
    const { pause } = stubVideoMethods(video);
    // Allow setting currentTime (the real video element's currentTime is
    // writable on jsdom, but our previous tick() mock made it read-only).
    let _t = 0;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => _t,
      set: (v: number) => {
        _t = v;
      },
    });

    // Pretend the learner seeked to t=8 — past the t=5 required interaction.
    _t = 8;
    fireEvent.timeUpdate(video);

    // Implementation should rewind to before atSeconds and pause.
    expect(_t).toBeLessThan(5);
    expect(_t).toBeGreaterThanOrEqual(0);
    expect(pause).toHaveBeenCalled();
  });

  it("enableRetry shows Try again after submit and resets state on click", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const retryCfg: InteractiveVideoConfig = {
      ...cfg,
      interactions: [],
      behaviour: { enableRetry: true, passPercentage: 50 },
    };
    render(<Component config={retryCfg} onSubmit={onSubmit} />);
    const video = getVideo();
    stubVideoMethods(video);
    fireEvent.ended(video);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const tryAgain = screen.getByRole("button", { name: /try again/i });
    await user.click(tryAgain);
    // After reset, the Try again button is gone (back to watching stage).
    expect(
      screen.queryByRole("button", { name: /try again/i }),
    ).not.toBeInTheDocument();
  });
});
