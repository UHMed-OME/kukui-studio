import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { VideoReflectionConfig } from "./schema.js";
import Component from "./Component.js";

/* ---------- MediaRecorder + getUserMedia stubs ---------- */

type DataAvailableHandler = (ev: { data: Blob }) => void;
type StopHandler = () => void;

class MockMediaRecorder {
  static lastInstance: MockMediaRecorder | null = null;
  state: "inactive" | "recording" | "paused" = "inactive";
  mimeType = "video/webm";
  ondataavailable: DataAvailableHandler | null = null;
  onstop: StopHandler | null = null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_stream: MediaStream) {
    MockMediaRecorder.lastInstance = this;
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["x"], { type: this.mimeType }) });
    this.onstop?.();
  }
}

class MockMediaStream {
  getTracks() {
    return [...this.getAudioTracks(), ...this.getVideoTracks()];
  }
  getAudioTracks() {
    return [mockTrack()] as unknown as MediaStreamTrack[];
  }
  getVideoTracks() {
    return [mockTrack()] as unknown as MediaStreamTrack[];
  }
}

function mockTrack() {
  return {
    stop: () => undefined,
    addEventListener: () => undefined,
    enabled: true,
    readyState: "live" as const,
    getSettings: () => ({ deviceId: "mock-device" }),
  };
}

function installRecorderStubs(getUserMedia: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("MediaRecorder", MockMediaRecorder as unknown as typeof MediaRecorder);
  vi.stubGlobal("navigator", {
    ...globalThis.navigator,
    mediaDevices: {
      getUserMedia,
      enumerateDevices: vi.fn().mockResolvedValue([]),
    },
  });
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:mock-recording"),
    revokeObjectURL: vi.fn(),
  });
}

const baseConfig: VideoReflectionConfig = {
  version: "1.0",
  title: "Reflection",
  prompt: "<p>Reflect on the case.</p>",
  maxDurationSeconds: 120,
  minDurationSeconds: 1,
  behaviour: { allowReRecord: true, allowScreenShare: true },
  appearance: { theme: "auto" },
} as unknown as VideoReflectionConfig;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  MockMediaRecorder.lastInstance = null;
});

describe("video-reflection Component", () => {
  // Real-time 3-2-1 countdown runs in this flow, so allow extra headroom.
  it("records, reviews, and marks complete", async () => {
    const getUserMedia = vi
      .fn()
      .mockResolvedValue(new MockMediaStream() as unknown as MediaStream);
    installRecorderStubs(getUserMedia);
    // Controllable clock so the take clears the minimum-duration gate.
    let now = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Component config={baseConfig} onSubmit={onSubmit} />);

    expect(screen.getByText(/reflect on the case/i)).toBeInTheDocument();

    // One-click Record: acquires the camera + mic, runs the 3-2-1 countdown
    // (real 1s ticks), then records.
    await user.click(screen.getByRole("button", { name: /^record$/i }));
    expect(getUserMedia).toHaveBeenCalled();
    await waitFor(
      () => expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument(),
      { timeout: 6000 },
    );

    now += 5000; // 5 seconds elapsed
    await user.click(screen.getByRole("button", { name: /stop/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /mark complete/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /mark complete/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const arg = onSubmit.mock.calls[0]?.[0];
    expect(arg).toMatchObject({ raw: 1, max: 1, success: true });
    expect(JSON.parse(arg.suspendData)).toMatchObject({ submitted: true, recorded: true });
  }, 15000);

  it("surfaces an error when camera/mic access is denied", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new Error("Permission denied"));
    installRecorderStubs(getUserMedia);

    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Component config={baseConfig} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /record/i }));
    await waitFor(() =>
      expect(screen.getByText(/permission denied/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
