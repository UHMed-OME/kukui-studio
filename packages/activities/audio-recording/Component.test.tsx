import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AudioRecordingConfig } from "./schema.js";
import Component from "./Component.js";

/* ---------- MediaRecorder + getUserMedia stubs ---------- */

type DataAvailableHandler = (ev: { data: Blob }) => void;
type StopHandler = () => void;

class MockMediaRecorder {
  static lastInstance: MockMediaRecorder | null = null;
  state: "inactive" | "recording" | "paused" = "inactive";
  mimeType = "audio/webm";
  ondataavailable: DataAvailableHandler | null = null;
  onstop: StopHandler | null = null;
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  constructor(_stream: MediaStream) {
    MockMediaRecorder.lastInstance = this;
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    // Synthesize a small chunk so the resulting Blob isn't empty.
    this.ondataavailable?.({ data: new Blob(["x"], { type: this.mimeType }) });
    this.onstop?.();
  }
}

class MockMediaStream {
  getTracks() {
    return [{ stop: () => undefined }];
  }
}

function installRecorderStubs() {
  vi.stubGlobal(
    "MediaRecorder",
    MockMediaRecorder as unknown as typeof MediaRecorder,
  );
  vi.stubGlobal("navigator", {
    ...globalThis.navigator,
    mediaDevices: {
      getUserMedia: vi
        .fn()
        .mockResolvedValue(new MockMediaStream() as unknown as MediaStream),
    },
  });
  // JSDOM lacks createObjectURL — return a stable string the component
  // hands to fetch() at submit time.
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:mock-recording"),
    revokeObjectURL: vi.fn(),
  });
  // fetch(blob:mock-recording) returns a tiny Blob so FileReader can encode it.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      ({
        blob: async () => new Blob(["x"], { type: "audio/webm" }),
      }) as unknown as Response,
    ),
  );
}

function installDeniedGetUserMedia() {
  vi.stubGlobal(
    "MediaRecorder",
    MockMediaRecorder as unknown as typeof MediaRecorder,
  );
  vi.stubGlobal("navigator", {
    ...globalThis.navigator,
    mediaDevices: {
      getUserMedia: vi
        .fn()
        .mockRejectedValue(new Error("Permission denied")),
    },
  });
}

/* ---------- Config fixtures ---------- */

const cfgBasic: AudioRecordingConfig = {
  version: "1.0",
  title: "Pronounce: haematopoiesis",
  prompt: "<p>Say the term clearly into your microphone.</p>",
  // 0.001s lets a single-tick Stop produce a >= min recording.
  minDurationSeconds: 0.001,
  maxDurationSeconds: 5,
};

/* ---------- Tests ---------- */

describe("AudioRecording", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the title, prompt, and an initial Record button", () => {
    installRecorderStubs();
    render(<Component config={cfgBasic} onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /pronounce/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/say the term clearly/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /record/i }),
    ).toBeInTheDocument();
  });

  it("shows an error and a Try Again button when getUserMedia is denied", async () => {
    installDeniedGetUserMedia();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Component config={cfgBasic} onSubmit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /record/i }));

    await waitFor(() => {
      expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });

  it("a mocked MediaRecorder run produces a recording in review state", async () => {
    installRecorderStubs();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Component config={cfgBasic} onSubmit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /record/i }));

    // Wait for the recorder to be wired up (getUserMedia is async).
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^stop$/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/^recording$/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^stop$/i }));

    expect(
      screen.getByRole("button", { name: /^submit$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^re-record$/i }),
    ).toBeInTheDocument();
    // Playback audio element is rendered.
    expect(screen.getByLabelText(/playback/i)).toBeInTheDocument();
  });

  it("restores the submitted stage from suspendData on mount", () => {
    installRecorderStubs();
    const suspendData = JSON.stringify({
      stage: "submitted",
      audioDataUrl: "data:audio/webm;base64,eA==",
      durationSeconds: 3,
    });
    render(
      <Component
        config={cfgBasic}
        onSubmit={vi.fn()}
        suspendData={suspendData}
      />,
    );
    // Submitted-with-audio shape: playback audio + "submitted" confirmation.
    expect(screen.getByLabelText(/playback/i)).toBeInTheDocument();
    // Both the status strip and the confirmation div say "submitted".
    expect(screen.getAllByText(/recording submitted/i).length).toBeGreaterThan(
      0,
    );
    // No Record button: stage is terminal.
    expect(screen.queryByRole("button", { name: /^record$/i })).toBeNull();
  });

  it("falls back to idle when suspendData is malformed", () => {
    installRecorderStubs();
    render(
      <Component
        config={cfgBasic}
        onSubmit={vi.fn()}
        suspendData="not-json"
      />,
    );
    expect(screen.getByRole("button", { name: /record/i })).toBeInTheDocument();
  });

  it("Submit calls onSubmit with audioDataUrl + durationSeconds in suspendData", async () => {
    installRecorderStubs();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSubmit = vi.fn();
    render(<Component config={cfgBasic} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /record/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^stop$/i })).toBeInTheDocument();
    });
    // Advance long enough that the timer reports ≥ minDurationSeconds before stop.
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    await user.click(screen.getByRole("button", { name: /^stop$/i }));

    const submitBtn = await screen.findByRole("button", { name: /^submit$/i });
    expect(submitBtn).toBeEnabled();
    await user.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    const arg = onSubmit.mock.calls[0]?.[0];
    expect(arg).toMatchObject({ raw: 1, max: 1, success: true });
    expect(typeof arg.suspendData).toBe("string");
    const parsed = JSON.parse(arg.suspendData);
    expect(typeof parsed.audioDataUrl).toBe("string");
    expect(parsed.audioDataUrl.startsWith("data:")).toBe(true);
    expect(typeof parsed.durationSeconds).toBe("number");
  });
});
