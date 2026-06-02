import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { VideoReflectionConfig } from "./schema.js";
import { SafeHtml, type ActivityProps } from "@kukui/core";
import { cuesToVtt, transcribe, type Cue, type TranscribeProgress } from "./transcribe.js";
import { burnCaptions, burnInSupported } from "./burn.js";
import "./Component.css";

type Stage =
  | "idle"
  | "requesting"
  | "ready"
  | "countdown"
  | "recording"
  | "reviewing"
  | "submitted"
  | "error";

type State = {
  stage: Stage;
  /** Object URL for the current take, valid only in `reviewing` / `submitted`. */
  blobUrl: string | null;
  /** Recording length in seconds (rounded). */
  durationSeconds: number;
  /** Whether the learner has downloaded the current take. */
  downloaded: boolean;
  /** Last error message — surfaced to the learner; empty in non-error states. */
  errorMessage: string;
};

const DEFAULT_MAX_SECONDS = 120;
const DEFAULT_MIN_SECONDS = 1;
const CANVAS_W = 1280;
const CANVAS_H = 720;

/**
 * Screen capture (`getDisplayMedia`) plus canvas compositing is only
 * available on desktop browsers — notably NOT on iOS Safari. Feature-detect
 * once so the "Share screen" affordance is hidden where it can't work
 * rather than offering a button that throws.
 */
const SCREEN_SHARE_SUPPORTED =
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getDisplayMedia === "function" &&
  typeof HTMLCanvasElement !== "undefined" &&
  typeof HTMLCanvasElement.prototype.captureStream === "function";

/**
 * The core record path needs both `getUserMedia` (camera/mic) and
 * `MediaRecorder` (encoding). Some locked-down LMS webviews and older iOS
 * Safari builds lack one or both; calling `new MediaRecorder` there throws
 * *after* the camera has already been turned on. Feature-detect at render
 * time so we can show an unsupported notice instead of an affordance that
 * crashes. Note: `getUserMedia` also requires a secure context, so
 * `mediaDevices` is undefined on plain `http://` — covered by the
 * `!!navigator.mediaDevices` check.
 */
function isRecordingSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}

/** Mic constraints that clean up speech (Loom/Flip lean on these heavily). */
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

/** Camera constraints — ask for 720p/30fps; the browser clamps to what it has. */
function videoConstraints(facingMode: "user" | "environment"): MediaTrackConstraints {
  return {
    facingMode,
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  };
}

/**
 * Preferred recorder mime types, MP4 first (far more portable for upload —
 * Safari and recent Chrome support it; Firefox/older Chrome fall back to
 * WebM). Returns options with an explicit bitrate so quality doesn't depend
 * on the browser's low default.
 */
const RECORDER_MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.640028,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
] as const;

function pickRecorderOptions(): MediaRecorderOptions {
  const base: MediaRecorderOptions = {
    videoBitsPerSecond: 2_500_000,
    audioBitsPerSecond: 128_000,
  };
  if (
    typeof MediaRecorder !== "undefined" &&
    typeof MediaRecorder.isTypeSupported === "function"
  ) {
    for (const mimeType of RECORDER_MIME_CANDIDATES) {
      if (MediaRecorder.isTypeSupported(mimeType)) return { ...base, mimeType };
    }
  }
  return base;
}

function extForMime(mime: string): string {
  return mime.includes("mp4") ? "mp4" : "webm";
}

/**
 * Combine the audio tracks from several streams into one track. With a
 * single source we return its track directly; with multiple (mic + shared
 * screen/tab audio) we mix them through a Web Audio destination so the
 * recorder captures both. Returns the AudioContext so the caller can close
 * it on teardown.
 */
function mixAudioTracks(streams: Array<MediaStream | null>): {
  track: MediaStreamTrack | null;
  ctx: AudioContext | null;
} {
  const sources = streams.filter(
    (s): s is MediaStream => !!s && s.getAudioTracks().length > 0,
  );
  if (sources.length === 0) return { track: null, ctx: null };
  const first = sources[0]?.getAudioTracks()[0] ?? null;
  if (sources.length === 1) return { track: first, ctx: null };
  const Ctor =
    typeof AudioContext !== "undefined"
      ? AudioContext
      : (globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
  if (!Ctor) return { track: first, ctx: null };
  const ctx = new Ctor();
  const dest = ctx.createMediaStreamDestination();
  for (const s of sources) ctx.createMediaStreamSource(s).connect(dest);
  return { track: dest.stream.getAudioTracks()[0] ?? first, ctx };
}

function parseSuspend(s: string | undefined): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as { submitted?: unknown; durationSeconds?: unknown };
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.submitted === true) {
      const duration =
        typeof parsed.durationSeconds === "number" && parsed.durationSeconds >= 0
          ? Math.round(parsed.durationSeconds)
          : 0;
      // The video itself is never persisted (too large for SCORM), so on
      // resume we can only restore the "submitted" acknowledgement.
      return {
        stage: "submitted",
        blobUrl: null,
        durationSeconds: duration,
        downloaded: true,
        errorMessage: "",
      };
    }
    return null;
  } catch {
    return null;
  }
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "reflection"
  );
}

const PIP_MARGIN = 28;

/** Rounded-rectangle path, with a manual fallback for engines lacking roundRect. */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Draw the webcam as a masked picture-in-picture in the bottom-right corner,
 * with a soft drop shadow and a white ring so it lifts off the shared screen.
 * "circle" crops a centered square to a face bubble; "rounded" keeps the full
 * 16:9 frame with rounded corners.
 */
function drawCameraPip(
  ctx: CanvasRenderingContext2D,
  cam: HTMLVideoElement,
  shape: "rounded" | "circle",
): void {
  const vw = cam.videoWidth;
  const vh = cam.videoHeight;
  if (vw <= 0 || vh <= 0) return;

  if (shape === "circle") {
    const d = Math.round(CANVAS_W * 0.2);
    const x = CANVAS_W - d - PIP_MARGIN;
    const y = CANVAS_H - d - PIP_MARGIN;
    const cx = x + d / 2;
    const cy = y + d / 2;
    const radius = d / 2;
    // Shadow caster (filled disc), then turn the shadow off for image + ring.
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#000000";
    ctx.fill();
    ctx.restore();
    // Clip to the circle and cover-fit a centered square crop of the camera.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;
    ctx.drawImage(cam, sx, sy, side, side, x, y, d, d);
    ctx.restore();
    // White ring.
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.stroke();
    return;
  }

  const w = Math.round(CANVAS_W * 0.25);
  const h = Math.round(w * (vh / vw));
  const x = CANVAS_W - w - PIP_MARGIN;
  const y = CANVAS_H - h - PIP_MARGIN;
  const r = 20;
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 8;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = "#000000";
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(cam, x, y, w, h);
  ctx.restore();
  // White ring.
  roundRectPath(ctx, x, y, w, h, r);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  ctx.stroke();
}

/** Set a MediaStream on a media element, ignoring environments (jsdom) that lack support. */
function attachStream(el: HTMLVideoElement | null, stream: MediaStream | null): void {
  if (!el) return;
  try {
    el.srcObject = stream;
  } catch {
    /* jsdom / unsupported — preview just won't show */
  }
}

/** Best-effort play() that never rejects the caller (autoplay/jsdom guards). */
function safePlay(el: HTMLVideoElement | null): void {
  if (!el || typeof el.play !== "function") return;
  try {
    const p = el.play() as unknown as Promise<void> | undefined;
    if (p && typeof p.catch === "function") p.catch(() => undefined);
  } catch {
    /* not implemented (jsdom) / blocked — non-fatal */
  }
}

/** Shared stroke-SVG props for the small control glyphs. */
const glyphProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function MicGlyph({ on }: { on: boolean }) {
  return (
    <svg {...glyphProps}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="21" />
      {!on ? <line x1="3" y1="3" x2="21" y2="21" /> : null}
    </svg>
  );
}

function CamGlyph({ on }: { on: boolean }) {
  return (
    <svg {...glyphProps}>
      <rect x="2" y="6" width="13" height="12" rx="2" />
      <path d="M15 10l6-3v10l-6-3" />
      {!on ? <line x1="3" y1="3" x2="21" y2="21" /> : null}
    </svg>
  );
}

function GearGlyph() {
  return (
    <svg {...glyphProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export default function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<VideoReflectionConfig>) {
  const HeadingTag = `h${headingLevel}` as "h1" | "h2" | "h3";
  const headingId = useId();

  const maxSeconds = config.maxDurationSeconds ?? DEFAULT_MAX_SECONDS;
  const minSeconds = config.minDurationSeconds ?? DEFAULT_MIN_SECONDS;
  const allowReRecord = config.behaviour?.allowReRecord ?? true;
  const screenShareOffered =
    (config.behaviour?.allowScreenShare ?? true) && SCREEN_SHARE_SUPPORTED;
  const cameraShape = config.behaviour?.cameraShape ?? "rounded";
  const countdownSeconds = config.behaviour?.countdownSeconds ?? 3;

  const recordLabel = config.ui?.recordButton ?? "Record";
  const stopLabel = config.ui?.stopButton ?? "Stop";
  const reRecordLabel = config.ui?.reRecordButton ?? "Re-record";
  const downloadLabel = config.ui?.downloadButton ?? "Download video";
  const submitLabel = config.ui?.submitButton ?? "Mark complete";

  const [state, setState] = useState<State>(
    () =>
      parseSuspend(suspendData) ?? {
        stage: "idle",
        blobUrl: null,
        durationSeconds: 0,
        downloaded: false,
        errorMessage: "",
      },
  );

  // Author-time options the learner picks before recording.
  const [useScreen, setUseScreen] = useState(false);
  // Which composition is live right now — drives which preview surface shows.
  const [activeScreen, setActiveScreen] = useState(false);
  // Countdown value shown over the preview before recording starts (3→2→1).
  const [countdown, setCountdown] = useState(0);
  // Pre-join controls (start OFF): camera + mic enabled state, acquiring
  // flag, device lists/selection, settings disclosure, and mic input level.
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [selectedAudioId, setSelectedAudioId] = useState<string>("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  // On-device captioning state for the review step.
  const [cc, setCc] = useState<{
    status: "idle" | "transcribing" | "ready" | "burning" | "error";
    progress: number;
    cues: Cue[];
    error: string;
  }>({ status: "idle", progress: 0, cues: [], error: "" });

  // Reset when `config` changes externally (Studio Preview edits).
  useEffect(() => {
    setState(
      parseSuspend(suspendData) ?? {
        stage: "idle",
        blobUrl: null,
        durationSeconds: 0,
        downloaded: false,
        errorMessage: "",
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  // The exact stream handed to MediaRecorder (camera, or the composite
  // canvas stream). Built during setup, consumed when the countdown ends.
  const recordStreamRef = useRef<MediaStream | null>(null);
  // AudioContext used to mix mic + screen audio; closed on teardown.
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Mime type of the finished recording, for the download file extension.
  const recordedMimeRef = useRef<string>("video/webm");
  // The finished recording Blob — needed for transcription + caption burn-in.
  const recordedBlobRef = useRef<Blob | null>(null);
  // Bumped whenever the take changes (re-record); async caption jobs capture
  // it and bail out of state writes if it moved on under them.
  const ccGenRef = useRef(0);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const camElRef = useRef<HTMLVideoElement | null>(null);
  const screenElRef = useRef<HTMLVideoElement | null>(null);
  const recordButtonRef = useRef<HTMLButtonElement | null>(null);
  // Mirror the live blob URL so the unmount cleanup (empty deps) revokes the
  // *current* URL, not the `null` captured at first render.
  const blobUrlRef = useRef<string | null>(null);
  // Sync mirrors of the toggle state so async acquire callbacks read the
  // current intent rather than a stale closure value.
  const micOnRef = useRef(false);
  const camOnRef = useRef(false);
  // Mic level-meter (preview only): its own AudioContext + rAF loop.
  const meterCtxRef = useRef<AudioContext | null>(null);
  const meterRafRef = useRef<number | null>(null);

  const stopMediaTracks = useCallback(() => {
    // Include recordStreamRef: in the composite path it's the canvas
    // captureStream (its own video track) plus the mixed-audio destination
    // track — none of which live on cam/screen, so they'd otherwise leak.
    for (const ref of [camStreamRef, screenStreamRef, recordStreamRef]) {
      if (ref.current) {
        for (const track of ref.current.getTracks()) track.stop();
        ref.current = null;
      }
    }
    if (audioCtxRef.current) {
      try {
        void audioCtxRef.current.close();
      } catch {
        /* already closed */
      }
      audioCtxRef.current = null;
    }
    if (meterRafRef.current !== null) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    if (meterCtxRef.current) {
      try {
        void meterCtxRef.current.close();
      } catch {
        /* already closed */
      }
      meterCtxRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const stopMeter = useCallback(() => {
    if (meterRafRef.current !== null) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    if (meterCtxRef.current) {
      try {
        void meterCtxRef.current.close();
      } catch {
        /* already closed */
      }
      meterCtxRef.current = null;
    }
    setMicLevel(0);
  }, []);

  // Drive a simple RMS level meter from the live mic track (preview only).
  const startMeter = useCallback(
    (stream: MediaStream) => {
      stopMeter();
      const Ctor =
        typeof AudioContext !== "undefined"
          ? AudioContext
          : (globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext;
      if (!Ctor || stream.getAudioTracks().length === 0) return;
      try {
        const ctx = new Ctor();
        meterCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i += 1) {
            const v = (data[i] ?? 128) / 128 - 1;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          setMicLevel(Math.min(1, rms * 2.5));
          meterRafRef.current = requestAnimationFrame(tick);
        };
        meterRafRef.current = requestAnimationFrame(tick);
      } catch {
        stopMeter();
      }
    },
    [stopMeter],
  );

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Keep the blob-URL ref in sync with state so unmount cleanup revokes the
  // current take rather than a stale value.
  useEffect(() => {
    blobUrlRef.current = state.blobUrl;
  }, [state.blobUrl]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stopMediaTracks();
      clearTimer();
      if (countdownTimerRef.current !== null) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          /* noop */
        }
      }
      if (blobUrlRef.current && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist a lightweight resume hint. The actual video is never persisted —
  // it's downloaded + uploaded to the LMS out of band. Skip the "submitted"
  // stage: submit() already wrote the richer completion record (with
  // `submitted`/`durationSeconds`) via onSubmit, and overwriting it with a
  // bare `{stage}` would lose the completion flag on resume.
  useEffect(() => {
    if (!onPersist) return;
    if (state.stage === "submitted") return;
    onPersist(JSON.stringify({ stage: state.stage }));
  }, [state.stage, onPersist]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* already stopped */
      }
    }
    clearTimer();
  }, [clearTimer]);

  /** Composite screen + webcam PiP onto the canvas each animation frame. */
  const startCompositeLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;
    if (!canvas || !ctx) return;
    const draw = () => {
      const screenEl = screenElRef.current;
      const camEl = camElRef.current;
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      if (screenEl && screenEl.readyState >= 2) {
        ctx.drawImage(screenEl, 0, 0, CANVAS_W, CANVAS_H);
      }
      if (camEl && camEl.readyState >= 2 && camEl.videoWidth > 0) {
        drawCameraPip(ctx, camEl, cameraShape);
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
  }, [cameraShape]);

  const beginRecorder = useCallback(
    (stream: MediaStream) => {
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, pickRecorderOptions());
      recorderRef.current = recorder;
      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        const elapsed = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));
        const mimeType = recorder.mimeType || "video/webm";
        recordedMimeRef.current = mimeType;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        stopMediaTracks();
        // Guard against an empty recording (encoder produced nothing) so we
        // don't drop the learner into a review screen with no playback.
        if (blob.size === 0) {
          recordedBlobRef.current = null;
          setState({
            stage: "error",
            blobUrl: null,
            durationSeconds: 0,
            downloaded: false,
            errorMessage:
              "The recording came back empty. Please try again, and check that this browser supports video recording.",
          });
          return;
        }
        recordedBlobRef.current = blob;
        const blobUrl =
          typeof URL.createObjectURL === "function" ? URL.createObjectURL(blob) : "";
        setState({
          stage: "reviewing",
          blobUrl,
          durationSeconds: elapsed,
          downloaded: false,
          errorMessage: "",
        });
      };
      startedAtRef.current = Date.now();
      // Timeslice so chunks flush incrementally (lower peak memory; a crash
      // mid-recording leaves recoverable data rather than losing everything).
      recorder.start(1000);
      setState((s) => ({ ...s, stage: "recording", durationSeconds: 0, errorMessage: "" }));
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setState((s) => (s.stage === "recording" ? { ...s, durationSeconds: elapsed } : s));
        if (elapsed >= maxSeconds) stopRecording();
      }, 250);
    },
    [maxSeconds, stopMediaTracks, stopRecording],
  );

  // Count down over the live preview, then start the recorder. A configured
  // duration of 0 skips straight to recording.
  const beginCountdown = useCallback(() => {
    const stream = recordStreamRef.current;
    if (!stream) return;
    if (countdownSeconds <= 0) {
      beginRecorder(stream);
      return;
    }
    setCountdown(countdownSeconds);
    setState((s) => ({ ...s, stage: "countdown" }));
    let n = countdownSeconds;
    countdownTimerRef.current = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        if (countdownTimerRef.current !== null) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        const s = recordStreamRef.current;
        // Abort only if a source track has actually ended (e.g. the user
        // stopped the screen share); a missing readyState counts as live.
        const healthy = !!s && s.getTracks().every((t) => t.readyState !== "ended");
        if (s && healthy) {
          beginRecorder(s);
        } else {
          // A source (e.g. the shared screen) ended during the countdown —
          // abort cleanly to the opening screen instead of recording a dead
          // stream.
          stopMediaTracks();
          setActiveScreen(false);
          setState((st) => ({ ...st, stage: "idle", errorMessage: "" }));
        }
      } else {
        setCountdown(n);
      }
    }, 1000);
  }, [beginRecorder, stopMediaTracks, countdownSeconds]);

  // Lazily acquire the camera + mic with the selected devices, applying the
  // current toggle state to each track, wiring the preview, and populating the
  // device lists. `force` re-acquires after a device change. Returns the stream
  // or null on failure (error state is set). Camera/mic start OFF, so this only
  // runs once the learner turns something on or presses Record.
  const acquireCameraStream = useCallback(
    async (force = false): Promise<MediaStream | null> => {
      if (camStreamRef.current && !force) return camStreamRef.current;
      setPreparing(true);
      try {
        if (force && camStreamRef.current) {
          for (const t of camStreamRef.current.getTracks()) t.stop();
          camStreamRef.current = null;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            ...AUDIO_CONSTRAINTS,
            ...(selectedAudioId ? { deviceId: { exact: selectedAudioId } } : {}),
          },
          video: {
            ...videoConstraints("user"),
            ...(selectedVideoId ? { deviceId: { exact: selectedVideoId } } : {}),
          },
        });
        camStreamRef.current = stream;
        for (const t of stream.getAudioTracks()) t.enabled = micOnRef.current;
        for (const t of stream.getVideoTracks()) t.enabled = camOnRef.current;
        attachStream(liveVideoRef.current, stream);
        safePlay(liveVideoRef.current);
        if (micOnRef.current) startMeter(stream);
        // Device labels populate only after permission is granted.
        try {
          const devs = await navigator.mediaDevices.enumerateDevices();
          setVideoDevices(devs.filter((d) => d.kind === "videoinput"));
          setAudioDevices(devs.filter((d) => d.kind === "audioinput"));
          const vId = stream.getVideoTracks()[0]?.getSettings?.().deviceId;
          const aId = stream.getAudioTracks()[0]?.getSettings?.().deviceId;
          if (vId) setSelectedVideoId((cur) => cur || vId);
          if (aId) setSelectedAudioId((cur) => cur || aId);
        } catch {
          /* enumerateDevices unavailable — pickers stay on the default */
        }
        return stream;
      } catch (err) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Camera and microphone access was denied.";
        stopMediaTracks();
        camOnRef.current = false;
        micOnRef.current = false;
        setCamOn(false);
        setMicOn(false);
        setState({
          stage: "error",
          blobUrl: null,
          durationSeconds: 0,
          downloaded: false,
          errorMessage: message,
        });
        return null;
      } finally {
        setPreparing(false);
      }
    },
    [selectedAudioId, selectedVideoId, startMeter, stopMediaTracks],
  );

  const toggleCamera = useCallback(async () => {
    const next = !camOnRef.current;
    camOnRef.current = next;
    setCamOn(next);
    if (next) {
      const stream = await acquireCameraStream();
      for (const t of stream?.getVideoTracks() ?? []) t.enabled = true;
    } else {
      for (const t of camStreamRef.current?.getVideoTracks() ?? []) t.enabled = false;
    }
  }, [acquireCameraStream]);

  const toggleMic = useCallback(async () => {
    const next = !micOnRef.current;
    micOnRef.current = next;
    setMicOn(next);
    if (next) {
      const stream = await acquireCameraStream();
      if (stream) {
        for (const t of stream.getAudioTracks()) t.enabled = true;
        startMeter(stream);
      }
    } else {
      for (const t of camStreamRef.current?.getAudioTracks() ?? []) t.enabled = false;
      stopMeter();
    }
  }, [acquireCameraStream, startMeter, stopMeter]);

  const onChangeDevice = useCallback(
    (kind: "audio" | "video", id: string) => {
      if (kind === "audio") setSelectedAudioId(id);
      else setSelectedVideoId(id);
      if (camStreamRef.current) void acquireCameraStream(true);
    },
    [acquireCameraStream],
  );

  // One-click record (the primary CTA): make sure camera + mic are on, build
  // the record stream (camera, or screen-share composite), then count down.
  const startRecording = useCallback(async () => {
    camOnRef.current = true;
    micOnRef.current = true;
    setCamOn(true);
    setMicOn(true);
    const cam = await acquireCameraStream();
    if (!cam) return; // error state already set
    for (const t of cam.getTracks()) t.enabled = true;
    stopMeter(); // the recording path manages its own audio

    let usingScreen = false;
    if (useScreen && screenShareOffered) {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: true,
        });
        screenStreamRef.current = screen;
        usingScreen = true;
        const screenTrack = screen.getVideoTracks()[0];
        if (screenTrack) screenTrack.addEventListener("ended", () => stopRecording());
      } catch {
        usingScreen = false;
      }
    }

    if (usingScreen && screenStreamRef.current) {
      attachStream(camElRef.current, cam);
      attachStream(screenElRef.current, screenStreamRef.current);
      safePlay(camElRef.current);
      safePlay(screenElRef.current);
      startCompositeLoop();
      const canvas = canvasRef.current;
      const canvasStream =
        canvas && typeof canvas.captureStream === "function" ? canvas.captureStream(30) : null;
      if (canvasStream) {
        const { track, ctx } = mixAudioTracks([cam, screenStreamRef.current]);
        audioCtxRef.current = ctx;
        if (track) canvasStream.addTrack(track);
        recordStreamRef.current = canvasStream;
        setActiveScreen(true);
        beginCountdown();
        return;
      }
      usingScreen = false;
    }

    // Camera-only path (also the iOS path).
    attachStream(liveVideoRef.current, cam);
    safePlay(liveVideoRef.current);
    recordStreamRef.current = cam;
    setActiveScreen(false);
    beginCountdown();
  }, [
    acquireCameraStream,
    beginCountdown,
    screenShareOffered,
    startCompositeLoop,
    stopMeter,
    stopRecording,
    useScreen,
  ]);

  // Cancel an in-progress countdown back to the start screen, keeping the
  // camera/mic preview live (only the screen-share/composite is torn down).
  const cancelCountdown = useCallback(() => {
    if (countdownTimerRef.current !== null) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (screenStreamRef.current) {
      for (const t of screenStreamRef.current.getTracks()) t.stop();
      screenStreamRef.current = null;
    }
    recordStreamRef.current = null;
    setActiveScreen(false);
    if (micOnRef.current && camStreamRef.current) startMeter(camStreamRef.current);
    setState((s) => ({ ...s, stage: "idle", errorMessage: "" }));
  }, [startMeter]);

  const resetToStartScreen = useCallback(() => {
    stopMediaTracks();
    stopMeter();
    camOnRef.current = false;
    micOnRef.current = false;
    setCamOn(false);
    setMicOn(false);
    setActiveScreen(false);
  }, [stopMediaTracks, stopMeter]);

  const reRecord = useCallback(() => {
    if (state.blobUrl && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(state.blobUrl);
    }
    recordedBlobRef.current = null;
    ccGenRef.current += 1; // invalidate any in-flight transcribe/burn job
    setCc({ status: "idle", progress: 0, cues: [], error: "" });
    resetToStartScreen();
    setState({
      stage: "idle",
      blobUrl: null,
      durationSeconds: 0,
      downloaded: false,
      errorMessage: "",
    });
  }, [state.blobUrl, resetToStartScreen]);

  const tryAgain = useCallback(() => {
    resetToStartScreen();
    setState({
      stage: "idle",
      blobUrl: null,
      durationSeconds: 0,
      downloaded: false,
      errorMessage: "",
    });
  }, [resetToStartScreen]);

  const onDownload = useCallback(() => {
    if (!state.blobUrl) return;
    try {
      const a = document.createElement("a");
      a.href = state.blobUrl;
      a.download = `${slugify(config.title)}.${extForMime(recordedMimeRef.current)}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      /* download blocked — the inline <video> still lets them save manually */
    }
    setState((s) => ({ ...s, downloaded: true }));
  }, [state.blobUrl, config.title]);

  /** Trigger a file download for a Blob (used for the .vtt and burned-in video). */
  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      /* download blocked — non-fatal */
    }
  }, []);

  const generateCaptions = useCallback(async () => {
    const blob = recordedBlobRef.current;
    if (!blob) return;
    const gen = ccGenRef.current;
    setCc({ status: "transcribing", progress: 0, cues: [], error: "" });
    try {
      const cues = await transcribe(blob, (p: TranscribeProgress) => {
        if (ccGenRef.current !== gen) return;
        // progress 0..1 during model download; -1 = running (indeterminate).
        setCc((s) => ({ ...s, progress: p.phase === "download" ? p.progress : -1 }));
      });
      if (ccGenRef.current !== gen) return;
      setCc({ status: "ready", progress: 1, cues, error: "" });
    } catch (err) {
      if (ccGenRef.current !== gen) return;
      setCc({
        status: "error",
        progress: 0,
        cues: [],
        error:
          err instanceof Error && err.message
            ? err.message
            : "Could not generate captions.",
      });
    }
  }, []);

  // Edit the transcript as one cue per line, keeping each cue's timing by index.
  const onEditTranscript = useCallback((value: string) => {
    const lines = value.split("\n");
    setCc((s) => {
      const old = s.cues;
      const lastEnd = old.length ? (old[old.length - 1]?.end ?? 0) : 0;
      const cues: Cue[] = lines.map((text, i) => {
        const existing = old[i];
        if (existing) return { ...existing, text };
        const start = i > 0 ? (old[i - 1]?.end ?? lastEnd) : lastEnd;
        return { start, end: start, text };
      });
      return { ...s, cues };
    });
  }, []);

  const downloadVtt = useCallback(() => {
    if (cc.cues.length === 0) return;
    downloadBlob(
      new Blob([cuesToVtt(cc.cues)], { type: "text/vtt" }),
      `${slugify(config.title)}.vtt`,
    );
  }, [cc.cues, config.title, downloadBlob]);

  const downloadBurnedIn = useCallback(async () => {
    const blob = recordedBlobRef.current;
    if (!blob || cc.cues.length === 0) return;
    const gen = ccGenRef.current;
    const cuesForBurn = cc.cues;
    setCc((s) => ({ ...s, status: "burning", progress: 0, error: "" }));
    try {
      const out = await burnCaptions(blob, cuesForBurn, (p) => {
        if (ccGenRef.current !== gen) return;
        setCc((s) => ({ ...s, progress: p }));
      });
      if (ccGenRef.current !== gen) return;
      const ext = out.type.includes("mp4") ? "mp4" : "webm";
      downloadBlob(out, `${slugify(config.title)}-captioned.${ext}`);
      setCc((s) => ({ ...s, status: "ready", progress: 1 }));
    } catch (err) {
      if (ccGenRef.current !== gen) return;
      setCc((s) => ({
        ...s,
        status: "error",
        error:
          err instanceof Error && err.message
            ? err.message
            : "Could not burn in captions.",
      }));
    }
  }, [cc.cues, config.title, downloadBlob]);

  const submit = useCallback(() => {
    if (state.stage !== "reviewing") return;
    if (state.durationSeconds < minSeconds) return;
    // The recording is delivered out of band (download → LMS dropbox); SCORM
    // only carries completion + duration, never the video bytes.
    const suspendData = JSON.stringify({
      submitted: true,
      recorded: true,
      durationSeconds: state.durationSeconds,
    });
    setState((s) => ({ ...s, stage: "submitted" }));
    onSubmit({ raw: 1, max: 1, success: true, suspendData });
  }, [state.stage, state.durationSeconds, minSeconds, onSubmit]);

  // Move focus to the stage's primary action on each major transition so a
  // keyboard/screen-reader user isn't stranded on a button that just
  // unmounted (e.g. after Stop). Idle is skipped on the very first paint so
  // we don't hijack focus when the activity loads.
  const isInitialRef = useRef(true);
  const actionRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (state.stage === "idle") {
      if (isInitialRef.current) {
        isInitialRef.current = false;
        return;
      }
      recordButtonRef.current?.focus();
      return;
    }
    if (
      state.stage === "recording" ||
      state.stage === "reviewing" ||
      state.stage === "error"
    ) {
      actionRef.current?.focus();
    }
  }, [state.stage]);

  const isIdle = state.stage === "idle";
  const recordingSupported = isRecordingSupported();
  const isCountdown = state.stage === "countdown";
  const isRecording = state.stage === "recording";
  const isReviewing = state.stage === "reviewing";
  const isSubmitted = state.stage === "submitted";
  const isError = state.stage === "error";
  const meetsMin = state.durationSeconds >= minSeconds;
  const remaining = Math.max(0, maxSeconds - state.durationSeconds);
  const nearEnd = isRecording && remaining <= 10;
  const recordProgress = maxSeconds > 0 ? Math.min(1, state.durationSeconds / maxSeconds) : 0;
  const submissionTarget = config.submissionTarget?.trim();
  // Preview surfaces: the camera-only <video>, the screen-share composite
  // canvas, or — when the camera is off (the default) or still acquiring —
  // a placeholder, so the start screen always reads as a recorder.
  const inCaptureStage = isIdle || isCountdown || isRecording;
  const showCanvas = activeScreen && (isCountdown || isRecording);
  const showLive = inCaptureStage && !activeScreen && camOn;
  const showPlaceholder = inCaptureStage && !showCanvas && !showLive;
  const canBurnIn = burnInSupported();
  const ccBusy = cc.status === "transcribing" || cc.status === "burning";
  const transcriptText = cc.cues.map((c) => c.text).join("\n");

  return (
    <div className="kukui-vr">
      <article className="kukui-vr__card" aria-labelledby={headingId}>
        <HeadingTag id={headingId} className="kukui-vr__title">
          {config.title}
        </HeadingTag>

        <SafeHtml html={config.prompt} className="kukui-vr__prompt" />

        {/* Dedicated assertive announcer (not nested in the polite status
            region, which has undefined behavior across screen readers). */}
        <div className="kukui-vr__sr-only" role="status" aria-live="assertive">
          {isCountdown
            ? `Recording starts in ${countdown}`
            : nearEnd && remaining === 10
              ? "10 seconds left"
              : ""}
        </div>

        {/* Preview stage — reserved from the very first paint (placeholder
            in idle) so it reads as a recorder and the layout never jumps.
            Live preview while framing/recording; playback in review. */}
        <div
          className={[
            "kukui-vr__stage",
            !isError ? "is-visible" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {showPlaceholder ? (
            <div className="kukui-vr__placeholder">
              <svg
                className="kukui-vr__placeholder-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="2" y="6" width="13" height="12" rx="2" />
                <path d="M15 10l6-3v10l-6-3" />
              </svg>
              <span>
                {preparing
                  ? "Starting your camera…"
                  : isIdle
                    ? "Camera is off — turn it on to see yourself"
                    : "Your camera preview will appear here"}
              </span>
            </div>
          ) : null}
          {/* Canvas (screen-share composite) and the camera-only <video> are
              always mounted so their refs are stable when recording starts —
              visibility is toggled with CSS, not conditional mounting. */}
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className={["kukui-vr__canvas", showCanvas ? "" : "is-hidden"]
              .filter(Boolean)
              .join(" ")}
            aria-label="Live recording preview"
            aria-hidden={showCanvas ? undefined : true}
          />
          <video
            ref={liveVideoRef}
            className={["kukui-vr__live", showLive ? "" : "is-hidden"]
              .filter(Boolean)
              .join(" ")}
            muted
            playsInline
            autoPlay
            aria-label="Live camera preview"
          />
          {/* Offscreen source <video>s that feed the compositing canvas. */}
          <video ref={camElRef} className="kukui-vr__offscreen" muted playsInline aria-hidden="true" />
          <video ref={screenElRef} className="kukui-vr__offscreen" muted playsInline aria-hidden="true" />

          {isCountdown ? (
            <div className="kukui-vr__countdown" aria-hidden="true">
              {countdown}
            </div>
          ) : null}

          {(isReviewing || isSubmitted) && state.blobUrl ? (
            <video
              className="kukui-vr__playback"
              controls
              playsInline
              preload="metadata"
              src={state.blobUrl}
              aria-label="Your recording"
            />
          ) : null}
        </div>

        {/* Mic / camera toggles — available on the start screen and while
            recording (mute / hide mid-take). Camera + mic start OFF. */}
        {inCaptureStage && recordingSupported ? (
          <div className="kukui-vr__setup">
            <div className="kukui-vr__cam-controls" role="group" aria-label="Camera and microphone">
              <button
                type="button"
                className={["kukui-vr__toggle", micOn ? "is-on" : "is-off"].join(" ")}
                onClick={toggleMic}
                aria-pressed={micOn}
                aria-label={micOn ? "Mute microphone" : "Turn microphone on"}
                disabled={preparing}
              >
                <MicGlyph on={micOn} />
                <span>{micOn ? "Mic on" : "Mic off"}</span>
              </button>
              <button
                type="button"
                className={["kukui-vr__toggle", camOn ? "is-on" : "is-off"].join(" ")}
                onClick={toggleCamera}
                aria-pressed={camOn}
                aria-label={camOn ? "Turn camera off" : "Turn camera on"}
                disabled={preparing}
              >
                <CamGlyph on={camOn} />
                <span>{camOn ? "Camera on" : "Camera off"}</span>
              </button>
              {isIdle ? (
                <button
                  type="button"
                  className="kukui-vr__toggle"
                  onClick={() => setSettingsOpen((o) => !o)}
                  aria-expanded={settingsOpen}
                  aria-label="Device settings"
                >
                  <GearGlyph />
                  <span>Settings</span>
                </button>
              ) : null}
            </div>

            {micOn ? (
              <div
                className="kukui-vr__meter"
                role="meter"
                aria-label="Microphone input level"
                aria-valuenow={Math.round(micLevel * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="kukui-vr__meter-fill"
                  style={{ width: `${Math.round(micLevel * 100)}%` }}
                />
              </div>
            ) : null}

            {isIdle && settingsOpen ? (
              <div className="kukui-vr__settings">
                <label className="kukui-vr__field">
                  <span>Microphone</span>
                  <select
                    value={selectedAudioId}
                    onChange={(e) => onChangeDevice("audio", e.target.value)}
                  >
                    {audioDevices.length === 0 ? (
                      <option value="">Default microphone</option>
                    ) : (
                      audioDevices.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>
                          {d.label || `Microphone ${i + 1}`}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label className="kukui-vr__field">
                  <span>Camera</span>
                  <select
                    value={selectedVideoId}
                    onChange={(e) => onChangeDevice("video", e.target.value)}
                  >
                    {videoDevices.length === 0 ? (
                      <option value="">Default camera</option>
                    ) : (
                      videoDevices.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>
                          {d.label || `Camera ${i + 1}`}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                {screenShareOffered ? (
                  <label className="kukui-vr__option kukui-vr__option--screen">
                    <input
                      type="checkbox"
                      checked={useScreen}
                      onChange={(e) => setUseScreen(e.target.checked)}
                    />
                    <span>Share my screen (webcam picture-in-picture)</span>
                  </label>
                ) : null}
                <p className="kukui-vr__settings-note">
                  Pick a different microphone or camera if the default isn't right.
                </p>
              </div>
            ) : null}

            {isIdle ? (
              <p className="kukui-vr__meta">
                <span className="kukui-vr__meta-dot" aria-hidden="true" /> Up to{" "}
                {formatTime(maxSeconds)}
                <span aria-hidden="true"> · </span>
                Records on your device — your video isn't uploaded
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Status bar — suppressed on the (supported) opening screen, where the
            CTA + meta line carry the message instead. */}
        {isIdle && recordingSupported ? null : (
          <div
            className="kukui-vr__status"
            role="status"
            aria-live="polite"
            data-stage={state.stage}
          >
            {isError ? (
              <>
                <span className="kukui-vr__error-icon" aria-hidden="true">
                  !
                </span>
                <span className="kukui-vr__error">{state.errorMessage}</span>
              </>
            ) : isCountdown ? (
              <span aria-hidden="true">Starting in {countdown}…</span>
            ) : isRecording ? (
              <>
                <span className="kukui-vr__rec-dot is-pulsing" aria-hidden="true" />
                <span className="kukui-vr__rec-label">Recording</span>
                {/* aria-hidden: these tick every 250ms and would otherwise
                    spam the live region with time announcements. */}
                <span className="kukui-vr__timer" aria-hidden="true">
                  {formatTime(state.durationSeconds)} / {formatTime(maxSeconds)} ·{" "}
                  {formatTime(remaining)} left
                </span>
              </>
            ) : isReviewing ? (
              <>
                <span>Recording captured.</span>
                <span className="kukui-vr__timer">{formatTime(state.durationSeconds)}</span>
              </>
            ) : isSubmitted ? (
              <span>Marked complete.</span>
            ) : (
              <span>Video recording isn't supported in this browser.</span>
            )}
          </div>
        )}

        {/* Recording progress: time used vs. max, turning amber in the last
            10 seconds before auto-stop. aria-hidden (it ticks); the elapsed/
            remaining and the "10 seconds left" cue are announced elsewhere. */}
        {isRecording ? (
          <div
            className={["kukui-vr__progress", nearEnd ? "is-near-end" : ""]
              .filter(Boolean)
              .join(" ")}
            aria-hidden="true"
          >
            <div
              className="kukui-vr__progress-fill"
              style={{ width: `${Math.round(recordProgress * 100)}%` }}
            />
          </div>
        ) : null}

        {/* After a take: the submission instruction (download → upload). */}
        {isReviewing ? (
          <p className="kukui-vr__submit-note">
            Kukui doesn't store your video. {downloadLabel} below, then upload the
            file{submissionTarget ? <> to {submissionTarget}</> : <> to your course dropbox</>}.
            Then {submitLabel.toLowerCase()} here to record that you finished.
          </p>
        ) : null}

        {/* Captions — on-device transcription + .vtt / burned-in downloads. */}
        {isReviewing ? (
          <section className="kukui-vr__cc" aria-label="Captions">
            {cc.status === "idle" ? (
              <>
                <button
                  type="button"
                  className="kukui-vr__secondary"
                  onClick={generateCaptions}
                >
                  Generate captions
                </button>
                <p className="kukui-vr__cc-hint">
                  Runs on your device (your video isn't uploaded). The speech model
                  downloads once on first use, so this can take a moment.
                </p>
              </>
            ) : null}

            {cc.status === "transcribing" ? (
              <p className="kukui-vr__cc-status" role="status" aria-live="polite">
                <span className="kukui-vr__spinner" aria-hidden="true" />
                {cc.progress > 0 && cc.progress < 1
                  ? `Downloading speech model… ${Math.round(cc.progress * 100)}%`
                  : "Transcribing your reflection… this can take a little while on phones/tablets."}
              </p>
            ) : null}

            {cc.status === "error" ? (
              <div role="alert">
                <p className="kukui-vr__error">{cc.error}</p>
                <button
                  type="button"
                  className="kukui-vr__secondary"
                  onClick={generateCaptions}
                >
                  Try captions again
                </button>
              </div>
            ) : null}

            {(cc.status === "ready" || cc.status === "burning") && cc.cues.length > 0 ? (
              <>
                <label className="kukui-vr__cc-label" htmlFor={`${headingId}-transcript`}>
                  Transcript — fix any wording on each line. Keep the line breaks
                  so captions stay in sync.
                </label>
                <textarea
                  id={`${headingId}-transcript`}
                  className="kukui-vr__cc-transcript"
                  value={transcriptText}
                  onChange={(e) => onEditTranscript(e.target.value)}
                  rows={Math.min(10, Math.max(3, cc.cues.length))}
                  disabled={cc.status === "burning"}
                />
                <div className="kukui-vr__cc-actions">
                  <button
                    type="button"
                    className="kukui-vr__secondary"
                    onClick={downloadVtt}
                    disabled={ccBusy}
                  >
                    Download captions (.vtt)
                  </button>
                  {canBurnIn ? (
                    <button
                      type="button"
                      className="kukui-vr__secondary"
                      onClick={downloadBurnedIn}
                      disabled={ccBusy}
                    >
                      {cc.status === "burning"
                        ? `Burning in captions… ${Math.round(cc.progress * 100)}%`
                        : "Download video with captions"}
                    </button>
                  ) : null}
                </div>
                <p className="kukui-vr__cc-hint">
                  Upload the <code>.vtt</code> alongside your video so captions can be
                  turned on
                  {canBurnIn ? (
                    <>
                      , or download the video with captions burned in (one file, plays
                      anywhere)
                    </>
                  ) : null}
                  .
                </p>
              </>
            ) : null}
          </section>
        ) : null}

        <div className="kukui-vr__actions">
          {isError ? (
            <button
              type="button"
              className="kukui-vr__primary"
              ref={actionRef}
              onClick={tryAgain}
            >
              Try again
            </button>
          ) : isCountdown ? (
            <button type="button" className="kukui-vr__secondary" onClick={cancelCountdown}>
              Cancel
            </button>
          ) : isRecording ? (
            <button
              type="button"
              className="kukui-vr__primary is-stop"
              ref={actionRef}
              onClick={stopRecording}
            >
              {stopLabel}
            </button>
          ) : isReviewing ? (
            <>
              {allowReRecord ? (
                <button
                  type="button"
                  className="kukui-vr__secondary"
                  onClick={reRecord}
                  disabled={ccBusy}
                >
                  {reRecordLabel}
                </button>
              ) : null}
              <button
                type="button"
                className="kukui-vr__secondary"
                onClick={onDownload}
                disabled={!state.blobUrl}
              >
                {downloadLabel}
                {state.downloaded ? " ✓" : ""}
              </button>
              <button
                type="button"
                className="kukui-vr__primary"
                ref={actionRef}
                disabled={!meetsMin}
                onClick={submit}
                title={
                  meetsMin
                    ? undefined
                    : `Record at least ${minSeconds} second${minSeconds === 1 ? "" : "s"} first`
                }
              >
                {submitLabel}
              </button>
            </>
          ) : isSubmitted ? null : !recordingSupported ? (
            <p className="kukui-vr__unsupported" role="alert">
              Video recording isn't available in this browser. Open this
              activity in a recent version of Chrome, Edge, Firefox, or Safari
              (over a secure <code>https</code> connection) to record your
              reflection.
            </p>
          ) : (
            <button
              type="button"
              className="kukui-vr__primary kukui-vr__record-cta"
              ref={recordButtonRef}
              onClick={startRecording}
              disabled={preparing}
            >
              <span className="kukui-vr__record-cta-dot" aria-hidden="true" />
              {preparing ? "Starting…" : recordLabel}
            </button>
          )}
        </div>

        <div
          className={["kukui-vr__confirmation", isSubmitted ? "is-visible" : ""]
            .filter(Boolean)
            .join(" ")}
          role="status"
          aria-live="polite"
        >
          {isSubmitted ? (
            <>
              Marked complete.{" "}
              {submissionTarget
                ? `Make sure you uploaded your video to ${submissionTarget}.`
                : "Make sure you uploaded your video to your course dropbox."}
            </>
          ) : (
            ""
          )}
        </div>

        {config.author ? (
          <p className="kukui-vr__credit">By {config.author}</p>
        ) : null}
      </article>
    </div>
  );
}
