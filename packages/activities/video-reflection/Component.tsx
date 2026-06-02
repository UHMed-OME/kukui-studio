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
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  // Which composition is live right now — drives which preview surface shows.
  const [activeScreen, setActiveScreen] = useState(false);
  // Countdown value shown over the preview before recording starts (3→2→1).
  const [countdown, setCountdown] = useState(0);
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

  const stopMediaTracks = useCallback(() => {
    for (const ref of [camStreamRef, screenStreamRef]) {
      if (ref.current) {
        for (const track of ref.current.getTracks()) track.stop();
        ref.current = null;
      }
    }
    recordStreamRef.current = null;
    if (audioCtxRef.current) {
      try {
        void audioCtxRef.current.close();
      } catch {
        /* already closed */
      }
      audioCtxRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

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

  // Persist a lightweight resume hint (stage only). The actual video is never
  // persisted — it's downloaded + uploaded to the LMS out of band.
  useEffect(() => {
    if (!onPersist) return;
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
        recordedBlobRef.current = blob;
        chunksRef.current = [];
        stopMediaTracks();
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
      recorder.start();
      setState((s) => ({ ...s, stage: "recording", durationSeconds: 0, errorMessage: "" }));
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setState((s) => (s.stage === "recording" ? { ...s, durationSeconds: elapsed } : s));
        if (elapsed >= maxSeconds) stopRecording();
      }, 250);
    },
    [maxSeconds, stopMediaTracks, stopRecording],
  );

  // Count 3→2→1 over the live preview, then start the recorder.
  const beginCountdown = useCallback(() => {
    const stream = recordStreamRef.current;
    if (!stream) return;
    setCountdown(3);
    setState((s) => ({ ...s, stage: "countdown" }));
    let n = 3;
    countdownTimerRef.current = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        if (countdownTimerRef.current !== null) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        const s = recordStreamRef.current;
        if (s) beginRecorder(s);
      } else {
        setCountdown(n);
      }
    }, 1000);
  }, [beginRecorder]);

  // Acquire camera (+ optional screen), wire up the live preview, and stop in
  // the "ready" framing step. Recording itself doesn't start until the learner
  // hits "Start recording" → countdown. Mirrors the Loom/Flip ready-check.
  const startSetup = useCallback(async () => {
    setState((s) => ({ ...s, stage: "requesting", errorMessage: "" }));
    try {
      const cam = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints(facingMode),
        audio: AUDIO_CONSTRAINTS,
      });
      camStreamRef.current = cam;

      // Try the screen-share composite path only when offered + opted in.
      // If the user cancels the screen picker, fall back to camera-only.
      let usingScreen = false;
      if (useScreen && screenShareOffered) {
        try {
          const screen = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: { ideal: 30 } },
            audio: true,
          });
          screenStreamRef.current = screen;
          usingScreen = true;
          // Stopping the share from the browser chrome ends the recording.
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
          canvas && typeof canvas.captureStream === "function"
            ? canvas.captureStream(30)
            : null;
        if (canvasStream) {
          // Mix the mic with any shared screen/tab audio into one track.
          const { track, ctx } = mixAudioTracks([cam, screenStreamRef.current]);
          audioCtxRef.current = ctx;
          if (track) canvasStream.addTrack(track);
          recordStreamRef.current = canvasStream;
          setActiveScreen(true);
          setState((s) => ({ ...s, stage: "ready" }));
          return;
        }
        // captureStream unavailable — fall through to camera-only.
        usingScreen = false;
      }

      // Camera-only path (also the iOS path).
      attachStream(liveVideoRef.current, cam);
      safePlay(liveVideoRef.current);
      recordStreamRef.current = cam;
      setActiveScreen(false);
      setState((s) => ({ ...s, stage: "ready" }));
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Camera and microphone access was denied.";
      stopMediaTracks();
      setState({
        stage: "error",
        blobUrl: null,
        durationSeconds: 0,
        downloaded: false,
        errorMessage: message,
      });
    }
  }, [
    facingMode,
    useScreen,
    screenShareOffered,
    startCompositeLoop,
    stopMediaTracks,
    stopRecording,
  ]);

  // Back out of the ready/countdown step without recording.
  const cancelSetup = useCallback(() => {
    if (countdownTimerRef.current !== null) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    stopMediaTracks();
    setActiveScreen(false);
    setState((s) => ({ ...s, stage: "idle", errorMessage: "" }));
  }, [stopMediaTracks]);

  const reRecord = useCallback(() => {
    if (state.blobUrl && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(state.blobUrl);
    }
    recordedBlobRef.current = null;
    setCc({ status: "idle", progress: 0, cues: [], error: "" });
    setActiveScreen(false);
    setState({
      stage: "idle",
      blobUrl: null,
      durationSeconds: 0,
      downloaded: false,
      errorMessage: "",
    });
  }, [state.blobUrl]);

  const tryAgain = useCallback(() => {
    setState({
      stage: "idle",
      blobUrl: null,
      durationSeconds: 0,
      downloaded: false,
      errorMessage: "",
    });
  }, []);

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
    setCc({ status: "transcribing", progress: 0, cues: [], error: "" });
    try {
      const cues = await transcribe(blob, (p: TranscribeProgress) => {
        setCc((s) => ({ ...s, progress: p.phase === "download" ? p.progress : 1 }));
      });
      setCc({ status: "ready", progress: 1, cues, error: "" });
    } catch (err) {
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
    setCc((s) => ({ ...s, status: "burning", progress: 0, error: "" }));
    try {
      const out = await burnCaptions(blob, cc.cues, (p) =>
        setCc((s) => ({ ...s, progress: p })),
      );
      const ext = out.type.includes("mp4") ? "mp4" : "webm";
      downloadBlob(out, `${slugify(config.title)}-captioned.${ext}`);
      setCc((s) => ({ ...s, status: "ready", progress: 1 }));
    } catch (err) {
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

  // Auto-focus Record on entering idle (after the first paint).
  const isInitialRef = useRef(true);
  useEffect(() => {
    if (state.stage !== "idle") return;
    if (isInitialRef.current) {
      isInitialRef.current = false;
      return;
    }
    recordButtonRef.current?.focus();
  }, [state.stage]);

  const isIdle = state.stage === "idle";
  const recordingSupported = isRecordingSupported();
  const isRequesting = state.stage === "requesting";
  const isReady = state.stage === "ready";
  const isCountdown = state.stage === "countdown";
  const isRecording = state.stage === "recording";
  const isReviewing = state.stage === "reviewing";
  const isSubmitted = state.stage === "submitted";
  const isError = state.stage === "error";
  const meetsMin = state.durationSeconds >= minSeconds;
  const submissionTarget = config.submissionTarget?.trim();
  // The live preview surface is shown from framing through recording.
  const showPreview = isReady || isCountdown || isRecording;
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

        {/* Pre-record options. */}
        {isIdle ? (
          <div className="kukui-vr__options">
            {screenShareOffered ? (
              <label className="kukui-vr__option">
                <input
                  type="checkbox"
                  checked={useScreen}
                  onChange={(e) => setUseScreen(e.target.checked)}
                />
                <span>Share my screen (with a webcam picture-in-picture)</span>
              </label>
            ) : null}
            <fieldset className="kukui-vr__camera-pick">
              <legend className="kukui-vr__camera-legend">Camera</legend>
              <label className="kukui-vr__option">
                <input
                  type="radio"
                  name="vr-facing"
                  checked={facingMode === "user"}
                  onChange={() => setFacingMode("user")}
                />
                <span>Front</span>
              </label>
              <label className="kukui-vr__option">
                <input
                  type="radio"
                  name="vr-facing"
                  checked={facingMode === "environment"}
                  onChange={() => setFacingMode("environment")}
                />
                <span>Back</span>
              </label>
            </fieldset>
          </div>
        ) : null}

        {/* Live preview from framing through recording. Canvas for the
            composite path, a mirrored <video> for camera-only. */}
        <div
          className={[
            "kukui-vr__stage",
            showPreview || isReviewing || isSubmitted ? "is-visible" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {/* Canvas (screen-share composite) and the camera-only <video> are
              always mounted so their refs are stable when recording starts —
              visibility is toggled with CSS, not conditional mounting. */}
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className={[
              "kukui-vr__canvas",
              showPreview && activeScreen ? "" : "is-hidden",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label="Live recording preview"
            aria-hidden={showPreview && activeScreen ? undefined : true}
          />
          <video
            ref={liveVideoRef}
            className={[
              "kukui-vr__live",
              showPreview && !activeScreen ? "" : "is-hidden",
            ]
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
          ) : isRequesting ? (
            <span>Requesting camera &amp; microphone…</span>
          ) : isReady ? (
            <span>Camera ready — frame yourself, then Start recording.</span>
          ) : isCountdown ? (
            <span aria-live="assertive">Starting in {countdown}…</span>
          ) : isRecording ? (
            <>
              <span className="kukui-vr__rec-dot is-pulsing" aria-hidden="true" />
              <span className="kukui-vr__rec-label">Recording</span>
              <span className="kukui-vr__timer">
                {formatTime(state.durationSeconds)} / {formatTime(maxSeconds)}
              </span>
            </>
          ) : isReviewing ? (
            <>
              <span>Recording captured.</span>
              <span className="kukui-vr__timer">{formatTime(state.durationSeconds)}</span>
            </>
          ) : isSubmitted ? (
            <span>Marked complete.</span>
          ) : !recordingSupported ? (
            <span>Video recording isn't supported in this browser.</span>
          ) : (
            <span>Press {recordLabel} when you are ready.</span>
          )}
        </div>

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
                {cc.progress > 0 && cc.progress < 1
                  ? `Downloading speech model… ${Math.round(cc.progress * 100)}%`
                  : "Transcribing your reflection…"}
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
                  Transcript — edit any mistakes (one caption per line)
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
            <button type="button" className="kukui-vr__primary" onClick={tryAgain}>
              Try again
            </button>
          ) : isReady ? (
            <>
              <button
                type="button"
                className="kukui-vr__primary"
                onClick={beginCountdown}
              >
                Start recording
              </button>
              <button type="button" className="kukui-vr__secondary" onClick={cancelSetup}>
                Cancel
              </button>
            </>
          ) : isCountdown ? (
            <button type="button" className="kukui-vr__secondary" onClick={cancelSetup}>
              Cancel
            </button>
          ) : isRecording ? (
            <button
              type="button"
              className="kukui-vr__primary is-stop"
              onClick={stopRecording}
            >
              {stopLabel}
            </button>
          ) : isReviewing ? (
            <>
              {allowReRecord ? (
                <button type="button" className="kukui-vr__secondary" onClick={reRecord}>
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
              className="kukui-vr__primary"
              ref={recordButtonRef}
              onClick={startSetup}
              disabled={isRequesting}
            >
              {recordLabel}
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
