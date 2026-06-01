import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { VideoReflectionConfig } from "./schema.js";
import { SafeHtml, type ActivityProps } from "@kukui/core";
import "./Component.css";

type Stage =
  | "idle"
  | "requesting"
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
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const camElRef = useRef<HTMLVideoElement | null>(null);
  const screenElRef = useRef<HTMLVideoElement | null>(null);
  const recordButtonRef = useRef<HTMLButtonElement | null>(null);

  const stopMediaTracks = useCallback(() => {
    for (const ref of [camStreamRef, screenStreamRef]) {
      if (ref.current) {
        for (const track of ref.current.getTracks()) track.stop();
        ref.current = null;
      }
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

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stopMediaTracks();
      clearTimer();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          /* noop */
        }
      }
      if (state.blobUrl && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(state.blobUrl);
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
        const pipW = CANVAS_W * 0.25;
        const pipH = pipW * (camEl.videoHeight / camEl.videoWidth);
        ctx.drawImage(camEl, CANVAS_W - pipW - 24, CANVAS_H - pipH - 24, pipW, pipH);
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
  }, []);

  const beginRecorder = useCallback(
    (stream: MediaStream, usingScreen: boolean) => {
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        const elapsed = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));
        const mimeType = recorder.mimeType || "video/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
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
      setActiveScreen(usingScreen);
      setState((s) => ({ ...s, stage: "recording", durationSeconds: 0, errorMessage: "" }));
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setState((s) => (s.stage === "recording" ? { ...s, durationSeconds: elapsed } : s));
        if (elapsed >= maxSeconds) stopRecording();
      }, 250);
    },
    [maxSeconds, stopMediaTracks, stopRecording],
  );

  const startRecording = useCallback(async () => {
    setState((s) => ({ ...s, stage: "requesting", errorMessage: "" }));
    try {
      const cam = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: true,
      });
      camStreamRef.current = cam;

      // Try the screen-share composite path only when offered + opted in.
      // If the user cancels the screen picker, fall back to camera-only.
      let usingScreen = false;
      if (useScreen && screenShareOffered) {
        try {
          const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
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
          const micTrack = cam.getAudioTracks()[0];
          if (micTrack) canvasStream.addTrack(micTrack);
          beginRecorder(canvasStream, true);
          return;
        }
        // captureStream unavailable — fall through to camera-only.
        usingScreen = false;
      }

      // Camera-only path (also the iOS path).
      attachStream(liveVideoRef.current, cam);
      safePlay(liveVideoRef.current);
      beginRecorder(cam, false);
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
    beginRecorder,
    startCompositeLoop,
    stopMediaTracks,
    stopRecording,
  ]);

  const reRecord = useCallback(() => {
    if (state.blobUrl && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(state.blobUrl);
    }
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
      a.download = `${slugify(config.title)}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      /* download blocked — the inline <video> still lets them save manually */
    }
    setState((s) => ({ ...s, downloaded: true }));
  }, [state.blobUrl, config.title]);

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
  const isRequesting = state.stage === "requesting";
  const isRecording = state.stage === "recording";
  const isReviewing = state.stage === "reviewing";
  const isSubmitted = state.stage === "submitted";
  const isError = state.stage === "error";
  const meetsMin = state.durationSeconds >= minSeconds;
  const submissionTarget = config.submissionTarget?.trim();

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

        {/* Live preview while recording. Canvas for the composite path, a
            mirrored <video> for camera-only. */}
        <div
          className={[
            "kukui-vr__stage",
            isRecording || isReviewing || isSubmitted ? "is-visible" : "",
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
              isRecording && activeScreen ? "" : "is-hidden",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label="Live recording preview"
            aria-hidden={isRecording && activeScreen ? undefined : true}
          />
          <video
            ref={liveVideoRef}
            className={[
              "kukui-vr__live",
              isRecording && !activeScreen ? "" : "is-hidden",
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

        <div className="kukui-vr__actions">
          {isError ? (
            <button type="button" className="kukui-vr__primary" onClick={tryAgain}>
              Try again
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
          ) : isSubmitted ? null : (
            <button
              type="button"
              className="kukui-vr__primary"
              ref={recordButtonRef}
              onClick={startRecording}
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
