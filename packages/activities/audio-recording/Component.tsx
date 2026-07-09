import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { AudioRecordingConfig } from "./schema.js";
import { resolveScoring } from "@kukui/core/scoring";
import {
  ActivityHeader,
  SafeHtml,
  StatusBadge,
  DotIcon,
  CheckIcon,
  type ActivityProps,
} from "@kukui/core";
import "./Component.css";

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

/**
 * Recording needs `getUserMedia` (mic) and `MediaRecorder` (encoding). Some
 * locked-down LMS webviews / older Safari builds lack one or both, and on a
 * non-secure `http://` origin `navigator.mediaDevices` is undefined entirely.
 * Feature-detect at render time so we can show guidance instead of an
 * affordance that throws a developer-facing error after the mic has already
 * been requested.
 */
function isRecordingSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}

/**
 * Restore state from persisted suspend data so reload picks up where the
 * learner left off. Submit writes a full payload with `audioDataUrl` when it
 * fits the suspend budget, or `{ submitted, durationSeconds, audioOmitted }`
 * when it doesn't (see `submit` below); the in-progress hint persisted on
 * pre-submit stage changes is just `{ stage }`. All shapes resolve to a
 * reasonable resume state.
 */
function parseSuspend(
  s: string | undefined,
  _config: AudioRecordingConfig,
): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as {
      stage?: unknown;
      submitted?: unknown;
      audioDataUrl?: unknown;
      durationSeconds?: unknown;
    };
    if (!parsed || typeof parsed !== "object") return null;

    const dataUrl =
      typeof parsed.audioDataUrl === "string" && parsed.audioDataUrl.startsWith("data:")
        ? parsed.audioDataUrl
        : null;
    const duration =
      typeof parsed.durationSeconds === "number" && parsed.durationSeconds >= 0
        ? Math.round(parsed.durationSeconds)
        : 0;

    // Submitted-with-audio shape: full restore including playback.
    if (dataUrl) {
      return {
        stage: "submitted",
        blobUrl: dataUrl,
        durationSeconds: duration,
        errorMessage: "",
      };
    }

    // Submitted-without-audio shapes: submit() writes `submitted: true`
    // (with `audioOmitted` when the clip exceeded the suspend budget), and
    // legacy resume hints wrote `stage: "submitted"`. The only resumable
    // stage is "submitted" (the learner already finished); other stages
    // refer to ephemeral browser resources (MediaStream, blob URL) that
    // don't survive a reload.
    if (parsed.submitted === true || parsed.stage === "submitted") {
      return {
        stage: "submitted",
        blobUrl: null,
        durationSeconds: duration,
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

export default function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<AudioRecordingConfig>) {
  const headingId = useId();

  const maxSeconds = config.maxDurationSeconds ?? DEFAULT_MAX_SECONDS;
  const minSeconds = config.minDurationSeconds ?? DEFAULT_MIN_SECONDS;
  const allowReRecord = config.behaviour?.allowReRecord ?? true;
  // Single source of truth for retry gating (Studio's Scoring tab offers
  // completion-only for this activity, so only `enableRetry` matters here).
  // Pass only the scoring slice: this activity's `behaviour` carries no
  // legacy scoring fields, so handing resolveScoring the whole config would
  // trip a TS weak-type mismatch for no benefit.
  const scoring = useMemo(
    () => resolveScoring({ scoring: config.scoring }, { mode: "completion" }),
    [config],
  );

  const recordLabel = config.ui?.recordButton ?? "Record";
  const stopLabel = config.ui?.stopButton ?? "Stop";
  const playbackLabel = config.ui?.playbackButton ?? "Playback";
  const reRecordLabel = config.ui?.reRecordButton ?? "Re-record";
  const submitLabel = config.ui?.submitButton ?? "Submit";

  const [state, setState] = useState<State>(
    () =>
      parseSuspend(suspendData, config) ?? {
        stage: "idle",
        blobUrl: null,
        durationSeconds: 0,
        errorMessage: "",
      },
  );

  // Reset local state when `config` changes externally (Studio Preview edit,
  // AI Accept, draft load, etc.). Reference equality on the `config` prop —
  // engine context loads JSON once and never mutates the ref, so this only
  // fires in Studio Preview. Replaces the now-removed JSON.stringify(value)
  // remount key.
  useEffect(() => {
    setState(
      parseSuspend(suspendData, config) ?? {
        stage: "idle",
        blobUrl: null,
        durationSeconds: 0,
        errorMessage: "",
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Prefer mutable refs over state for the recorder + stream so we don't
  // re-render on every level-meter tick or chunk arrival.
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordButtonRef = useRef<HTMLButtonElement | null>(null);
  // The current take's decoded Blob, captured at `onstop`. Submit encodes
  // this directly rather than re-`fetch`ing the blob: URL (which some
  // sandboxed LMS iframes block via CSP).
  const blobRef = useRef<Blob | null>(null);
  // Mirror the live blob URL so unmount cleanup revokes the current take,
  // not the `null` captured at first render.
  const blobUrlRef = useRef<string | null>(null);
  // Unmounting mid-recording calls recorder.stop(), whose `onstop` fires
  // after cleanup. This flag lets `onstop` skip setState and skip minting an
  // object URL nobody would ever revoke.
  const unmountedRef = useRef(false);

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

  // Keep the blob-URL ref in sync with state so unmount cleanup revokes the
  // current take rather than a stale value.
  useEffect(() => {
    blobUrlRef.current = state.blobUrl;
  }, [state.blobUrl]);

  // Cleanup on unmount: stop tracks, clear timer, revoke blob URL.
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      stopMediaTracks();
      clearTimer();
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
    // We intentionally only run on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist a lightweight resume hint: just the reached stage. Suspend data
  // with the actual audio is written on Submit (it's huge; persisting every
  // chunk would balloon SCORM suspend_data). Skip the "submitted" stage:
  // submit() already wrote the richer record (with `audioDataUrl` /
  // `durationSeconds`) via onSubmit, and overwriting it with a bare
  // `{stage}` would lose the recording on resume.
  useEffect(() => {
    if (!onPersist) return;
    if (state.stage === "submitted") return;
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
        stopMediaTracks();
        // Unmount cleanup called recorder.stop(): don't setState on an
        // unmounted component and don't mint an object URL nothing would
        // ever revoke.
        if (unmountedRef.current) {
          chunksRef.current = [];
          blobRef.current = null;
          return;
        }
        const elapsedMs = Date.now() - startedAtRef.current;
        const elapsedSeconds = Math.max(0, Math.round(elapsedMs / 1000));
        // Use a generic audio mime — the recorder's actual mimeType varies
        // by browser (audio/webm, audio/mp4, audio/ogg). The Blob ctor will
        // pass the type through; downstream <audio> handles it.
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        blobRef.current = blob;
        chunksRef.current = [];
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

      // Tick every 250 ms so the timer display and the maxSeconds auto-stop
      // land within a quarter second of the true elapsed time.
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
    blobRef.current = null;
    setState({
      stage: "idle",
      blobUrl: null,
      durationSeconds: 0,
      errorMessage: "",
    });
  }, [state.blobUrl]);

  const tryAgain = useCallback(() => {
    blobRef.current = null;
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
    // SCORM 1.2 caps `cmi.suspend_data` at 4096 chars. The bridge LZ-
    // compresses before write, but base64-encoded audio is high-entropy
    // and barely compresses, so any recording longer than ~5 seconds
    // overflows the cap — silently truncated by the LMS, corrupt on
    // resume. We persist a metadata-only suspend record (so grade
    // integrity survives) and only include the audio bytes when they
    // fit comfortably under the cap. Short recordings round-trip;
    // longer ones submit cleanly but aren't replayable after a resume.
    const SUSPEND_BUDGET_CHARS = 3500;
    try {
      const blob = blobRef.current;
      if (!blob) return;
      const audioDataUrl = await blobToDataUrl(blob);
      const withAudio = JSON.stringify({
        audioDataUrl,
        durationSeconds: state.durationSeconds,
        submitted: true,
      });
      const fitsBudget = withAudio.length <= SUSPEND_BUDGET_CHARS;
      const suspendData = fitsBudget
        ? withAudio
        : JSON.stringify({
            durationSeconds: state.durationSeconds,
            submitted: true,
            // Persisted recording omitted: data URL exceeded the SCORM
            // 1.2 suspend_data budget. The submit still scores success.
            audioOmitted: true,
          });
      if (!fitsBudget) {
        // eslint-disable-next-line no-console
        console.info(
          `[kukui:audio-recording] Recording too large to persist in SCORM ` +
            `suspend_data (${withAudio.length} chars > ${SUSPEND_BUDGET_CHARS} budget). ` +
            `Grade submitted as completed; recording will not replay on resume.`,
        );
      }
      setState((s) => ({ ...s, stage: "submitted" }));
      onSubmit({ raw: 1, max: 1, success: true, suspendData });
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Could not encode the recording.";
      setState((s) => ({ ...s, stage: "error", errorMessage: message }));
    }
  }, [state.stage, state.durationSeconds, minSeconds, onSubmit]);

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
  const recordingSupported = isRecordingSupported();

  // Header badge: completion-only — "Complete" once the recording is
  // submitted, "In progress" otherwise. Additive; heading/roles unchanged.
  const headerBadge = isSubmitted ? (
    <StatusBadge tone="success" icon={<CheckIcon />}>
      Complete
    </StatusBadge>
  ) : (
    <StatusBadge tone="neutral" icon={<DotIcon />}>
      In progress
    </StatusBadge>
  );

  return (
    <div className="kukui-ar">
      <article className="kukui-ar__card" aria-labelledby={headingId}>
        <ActivityHeader
          title={config.title}
          titleId={headingId}
          headingLevel={headingLevel}
          variant={config.appearance?.header ?? "full"}
          prompt={config.prompt ? <SafeHtml html={config.prompt} /> : undefined}
          badge={headerBadge}
        />

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
              {/* When Submit is disabled, say why — the row is pre-allocated
                  (min-height) so swapping the message doesn't reflow. */}
              <span>
                {meetsMin
                  ? "Recording captured."
                  : `Record at least ${formatTime(Math.ceil(minSeconds))} to submit.`}
              </span>
              <span className="kukui-ar__timer">
                {formatTime(state.durationSeconds)}
              </span>
            </>
          ) : isSubmitted ? (
            <span>Recording submitted.</span>
          ) : !recordingSupported ? (
            <span>Audio recording isn't supported in this browser.</span>
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
          ) : isSubmitted ? (
            // Post-submit re-record is gated by the Scoring tab's retry
            // setting, not behaviour.allowReRecord (which only governs
            // takes before submission).
            scoring.enableRetry && recordingSupported ? (
              <button
                type="button"
                className="kukui-ar__secondary"
                onClick={reRecord}
              >
                {reRecordLabel}
              </button>
            ) : null
          ) : !recordingSupported ? (
            <p className="kukui-ar__unsupported" role="alert">
              Audio recording isn't available in this browser. Open this
              activity in a recent version of Chrome, Edge, Firefox, or Safari
              (over a secure <code>https</code> connection) to record your
              response.
            </p>
          ) : (
            <button
              type="button"
              className="kukui-ar__primary"
              ref={recordButtonRef}
              onClick={startRecording}
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
