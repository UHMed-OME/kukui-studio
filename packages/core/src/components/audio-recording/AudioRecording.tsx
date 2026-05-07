import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { AudioRecordingConfig } from "@kukui/schemas";
import type { ActivityProps } from "../../types.js";
import { SafeHtml } from "../../safe-html.js";
import "./AudioRecording.css";

type Stage =
  | "idle"
  | "requesting-mic"
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
  /** Last error message — surfaced to the learner; empty in non-error states. */
  errorMessage: string;
};

const DEFAULT_MAX_SECONDS = 60;
const DEFAULT_MIN_SECONDS = 1;

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Read a Blob as a base64 data URL. We use the Promise wrapper around FileReader
 * because JSDOM ships FileReader; Blob.text() / arrayBuffer() exist too but
 * we want the data: URL form so it can drop directly into <audio src>.
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () =>
      reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

export function AudioRecording({
  config,
  onSubmit,
  onPersist,
  headingLevel = 1,
}: ActivityProps<AudioRecordingConfig>) {
  const HeadingTag = `h${headingLevel}` as "h1" | "h2" | "h3";

  const headingId = useId();

  const maxSeconds = config.maxDurationSeconds ?? DEFAULT_MAX_SECONDS;
  const minSeconds = config.minDurationSeconds ?? DEFAULT_MIN_SECONDS;
  const allowReRecord = config.behaviour?.allowReRecord ?? true;

  const recordLabel = config.ui?.recordButton ?? "Record";
  const stopLabel = config.ui?.stopButton ?? "Stop";
  const playbackLabel = config.ui?.playbackButton ?? "Playback";
  const reRecordLabel = config.ui?.reRecordButton ?? "Re-record";
  const submitLabel = config.ui?.submitButton ?? "Submit";

  const [state, setState] = useState<State>({
    stage: "idle",
    blobUrl: null,
    durationSeconds: 0,
    errorMessage: "",
  });

  // Prefer mutable refs over state for the recorder + stream so we don't
  // re-render on every level-meter tick or chunk arrival.
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordButtonRef = useRef<HTMLButtonElement | null>(null);

  const stopMediaTracks = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cleanup on unmount: stop tracks, clear timer, revoke blob URL.
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
    // We intentionally only run on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist resume hint — for v0 we just persist the reached stage. Suspend
  // data with the actual blob is written on Submit (it's huge; persisting
  // every chunk would balloon SCORM suspend_data).
  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify({ stage: state.stage }));
  }, [state.stage, onPersist]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* noop — already stopped */
      }
    }
    clearTimer();
  }, [clearTimer]);

  const startRecording = useCallback(async () => {
    setState((s) => ({ ...s, stage: "requesting-mic", errorMessage: "" }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        const elapsedMs = Date.now() - startedAtRef.current;
        const elapsedSeconds = Math.max(0, Math.round(elapsedMs / 1000));
        // Use a generic audio mime — the recorder's actual mimeType varies
        // by browser (audio/webm, audio/mp4, audio/ogg). The Blob ctor will
        // pass the type through; downstream <audio> handles it.
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        stopMediaTracks();
        const blobUrl =
          typeof URL.createObjectURL === "function"
            ? URL.createObjectURL(blob)
            : "";
        setState({
          stage: "reviewing",
          blobUrl,
          durationSeconds: elapsedSeconds,
          errorMessage: "",
        });
      };

      startedAtRef.current = Date.now();
      recorder.start();
      setState((s) => ({
        ...s,
        stage: "recording",
        durationSeconds: 0,
        errorMessage: "",
      }));

      // Tick once a second to refresh the timer and auto-stop at maxSeconds.
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor(
          (Date.now() - startedAtRef.current) / 1000,
        );
        setState((s) =>
          s.stage === "recording" ? { ...s, durationSeconds: elapsed } : s,
        );
        if (elapsed >= maxSeconds) {
          stopRecording();
        }
      }, 250);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Microphone access was denied.";
      stopMediaTracks();
      setState({
        stage: "error",
        blobUrl: null,
        durationSeconds: 0,
        errorMessage: message,
      });
    }
  }, [maxSeconds, stopMediaTracks, stopRecording]);

  const reRecord = useCallback(() => {
    if (state.blobUrl && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(state.blobUrl);
    }
    setState({
      stage: "idle",
      blobUrl: null,
      durationSeconds: 0,
      errorMessage: "",
    });
  }, [state.blobUrl]);

  const tryAgain = useCallback(() => {
    setState({
      stage: "idle",
      blobUrl: null,
      durationSeconds: 0,
      errorMessage: "",
    });
  }, []);

  const submit = useCallback(async () => {
    if (state.stage !== "reviewing") return;
    if (state.durationSeconds < minSeconds) return;
    // Resolve the blob from the object URL — fetch() handles `blob:` schemes.
    // Note: the resulting data URL is base64-encoded audio. For long takes
    // this can be tens of KB; SCORM 1.2 caps suspend_data at 4096 chars.
    // Authors should keep `maxDurationSeconds` short for SCORM-bound deploys.
    // Same v0 trade-off as the FileUploadWidget approach.
    try {
      const resp = await fetch(state.blobUrl ?? "");
      const blob = await resp.blob();
      const audioDataUrl = await blobToDataUrl(blob);
      const suspendData = JSON.stringify({
        audioDataUrl,
        durationSeconds: state.durationSeconds,
      });
      setState((s) => ({ ...s, stage: "submitted" }));
      onSubmit({ raw: 1, max: 1, success: true, suspendData });
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Could not encode the recording.";
      setState((s) => ({ ...s, stage: "error", errorMessage: message }));
    }
  }, [state.stage, state.durationSeconds, state.blobUrl, minSeconds, onSubmit]);

  // Keyboard: Space toggles record/stop while focused on the Record button.
  // (Native button activation already triggers click on Space, but we want
  // Stop to also trigger when the same focus is recycled.)
  const onRecordKeyDown = useCallback(
    (ev: React.KeyboardEvent<HTMLButtonElement>) => {
      if (ev.key !== " " && ev.key !== "Spacebar") return;
      // Let the browser fire the click — but we explicitly route both
      // states through the same key. Default click handlers handle it.
    },
    [],
  );

  // Auto-focus the Record button when entering idle (mount + after re-record),
  // but don't grab focus on the very first paint to avoid hijacking the page.
  const isInitialRef = useRef(true);
  useEffect(() => {
    if (state.stage !== "idle") return;
    if (isInitialRef.current) {
      isInitialRef.current = false;
      return;
    }
    recordButtonRef.current?.focus();
  }, [state.stage]);

  const isRecording = state.stage === "recording";
  const isReviewing = state.stage === "reviewing";
  const isSubmitted = state.stage === "submitted";
  const isError = state.stage === "error";
  const meetsMin = state.durationSeconds >= minSeconds;

  return (
    <div className="kukui-ar">
      <article className="kukui-ar__card" aria-labelledby={headingId}>
        <HeadingTag id={headingId} className="kukui-ar__title">
          {config.title}
        </HeadingTag>

        <SafeHtml html={config.prompt} className="kukui-ar__prompt" />

        {config.referenceAudio ? (
          <div className="kukui-ar__reference">
            <span className="kukui-ar__reference-label">Reference audio</span>
            <audio
              className="kukui-ar__reference-audio"
              controls
              preload="metadata"
              src={config.referenceAudio.src}
              aria-label={config.referenceAudio.caption ?? "Reference audio"}
            />
            {config.referenceAudio.caption ? (
              <p className="kukui-ar__reference-caption">
                {config.referenceAudio.caption}
              </p>
            ) : null}
          </div>
        ) : null}

        <div
          className="kukui-ar__status"
          role="status"
          aria-live="polite"
          data-stage={state.stage}
        >
          {isError ? (
            <>
              <span className="kukui-ar__error-icon" aria-hidden="true">
                !
              </span>
              <span className="kukui-ar__error">{state.errorMessage}</span>
            </>
          ) : isRecording ? (
            <>
              <span
                className="kukui-ar__rec-dot is-pulsing"
                aria-hidden="true"
              />
              <span className="kukui-ar__rec-label">Recording</span>
              <span className="kukui-ar__timer">
                {formatTime(state.durationSeconds)} / {formatTime(maxSeconds)}
              </span>
            </>
          ) : state.stage === "requesting-mic" ? (
            <span>Requesting microphone…</span>
          ) : isReviewing ? (
            <>
              <span>Recording captured.</span>
              <span className="kukui-ar__timer">
                {formatTime(state.durationSeconds)}
              </span>
            </>
          ) : isSubmitted ? (
            <span>Recording submitted.</span>
          ) : (
            <span>Press Record when you are ready.</span>
          )}
        </div>

        <div className="kukui-ar__playback">
          {isReviewing || isSubmitted ? (
            <audio
              className="kukui-ar__playback-audio"
              controls
              preload="metadata"
              src={state.blobUrl ?? undefined}
              aria-label={playbackLabel}
            />
          ) : null}
        </div>

        <div className="kukui-ar__actions">
          {isError ? (
            <button
              type="button"
              className="kukui-ar__primary"
              onClick={tryAgain}
            >
              Try Again
            </button>
          ) : isRecording ? (
            <button
              type="button"
              className="kukui-ar__primary is-stop"
              onClick={stopRecording}
              aria-label={stopLabel}
            >
              {stopLabel}
            </button>
          ) : isReviewing ? (
            <>
              {allowReRecord ? (
                <button
                  type="button"
                  className="kukui-ar__secondary"
                  onClick={reRecord}
                >
                  {reRecordLabel}
                </button>
              ) : null}
              <button
                type="button"
                className="kukui-ar__primary"
                disabled={!meetsMin}
                onClick={submit}
                aria-label={submitLabel}
              >
                {submitLabel}
              </button>
            </>
          ) : isSubmitted ? null : (
            <button
              type="button"
              className="kukui-ar__primary"
              ref={recordButtonRef}
              onClick={startRecording}
              onKeyDown={onRecordKeyDown}
              disabled={state.stage === "requesting-mic"}
              aria-label={recordLabel}
            >
              {recordLabel}
            </button>
          )}
        </div>

        <div
          className={[
            "kukui-ar__confirmation",
            isSubmitted ? "is-visible" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          role="status"
          aria-live="polite"
        >
          {isSubmitted ? "Recording submitted" : ""}
        </div>
      </article>
    </div>
  );
}
