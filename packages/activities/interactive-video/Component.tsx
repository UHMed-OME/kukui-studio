import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  MultipleChoiceConfigSchema,
  type MultipleChoiceConfig,
} from "@kukui/activities/multiple-choice/schema";
import {
  FillInTheBlanksConfigSchema,
  type FillInTheBlanksConfig,
} from "@kukui/activities/fill-in-the-blanks/schema";
import type { InteractiveVideoConfig } from "./schema.js";
import type { ActivityProps, ScoreState } from "@kukui/core/types";
import { aggregate, resolveScoring } from "@kukui/core/scoring";
import MultipleChoice from "@kukui/activities/multiple-choice/Component";
import FillInTheBlanks from "@kukui/activities/fill-in-the-blanks/Component";
import { ActivityHeader, SafeHtml } from "@kukui/core";
import { YouTubeStage, type VideoController } from "./YouTubeStage.js";
import "./Component.css";

type Stage = "watching" | "submitted";

type State = {
  stage: Stage;
  /** ScoreState per interaction id, recorded as the learner answers each. */
  resolvedInteractions: Record<string, ScoreState>;
  /** Last seen video time in seconds. Persisted so a resume can seek. */
  currentTime: number;
};

type ValidatedInteraction =
  | {
      id: string;
      atSeconds: number;
      required: boolean;
      kind: "multipleChoice";
      config: MultipleChoiceConfig;
    }
  | {
      id: string;
      atSeconds: number;
      required: boolean;
      kind: "fillInTheBlanks";
      config: FillInTheBlanksConfig;
    };

const TRIGGER_WINDOW = 0.5;

export default function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<InteractiveVideoConfig>) {
  const headingId = useId();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controllerRef = useRef<VideoController | null>(null);

  const validated = useMemo<ValidatedInteraction[]>(() => {
    const out: ValidatedInteraction[] = [];
    config.interactions.forEach((it, i) => {
      const required = it.required ?? true;
      if (it.kind === "multipleChoice") {
        const r = MultipleChoiceConfigSchema.safeParse(it.config);
        if (r.success) {
          out.push({
            id: it.id,
            atSeconds: it.atSeconds,
            required,
            kind: "multipleChoice",
            config: r.data,
          });
        } else {
          console.warn(
            `[kukui:interactive-video] Interaction ${i} (${it.id}) multipleChoice failed validation; skipping.`,
            r.error.issues,
          );
        }
      } else {
        const r = FillInTheBlanksConfigSchema.safeParse(it.config);
        if (r.success) {
          out.push({
            id: it.id,
            atSeconds: it.atSeconds,
            required,
            kind: "fillInTheBlanks",
            config: r.data,
          });
        } else {
          console.warn(
            `[kukui:interactive-video] Interaction ${i} (${it.id}) fillInTheBlanks failed validation; skipping.`,
            r.error.issues,
          );
        }
      }
    });
    // Sort by time so we evaluate in chronological order.
    out.sort((a, b) => a.atSeconds - b.atSeconds);
    return out;
  }, [config.interactions]);

  const [state, setState] = useState<State>(
    () =>
      parseSuspend(suspendData) ?? {
        stage: "watching",
        resolvedInteractions: {},
        currentTime: 0,
      },
  );

  // Currently-active interaction id (overlay shown while not null).
  const [activeId, setActiveId] = useState<string | null>(null);

  // Reset local state when `config` changes externally (Studio Preview edit,
  // AI Accept, draft load, etc.). Reference equality on the `config` prop —
  // engine context loads JSON once and never mutates the ref, so this only
  // fires in Studio Preview. Replaces the now-removed JSON.stringify(value)
  // remount key.
  useEffect(() => {
    setState(
      parseSuspend(suspendData) ?? {
        stage: "watching",
        resolvedInteractions: {},
        currentTime: 0,
      },
    );
    setActiveId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  const ui = config.ui ?? {};
  const resumeLabel = ui.resumeButtonLabel ?? "Resume";
  const tryAgainLabel = "Try again";
  const videoType = config.video.type ?? "html5";
  const isYouTube = videoType === "youtube";
  const isVimeo = videoType === "vimeo";

  // Unified control surface over the native <video> (html5) and the YouTube
  // IFrame player, so the checkpoint logic is backend-agnostic.
  const ctl = (): VideoController | null => {
    if (isYouTube) return controllerRef.current;
    const v = videoRef.current;
    if (!v) return null;
    return {
      play: () => {
        const p = v.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      },
      pause: () => v.pause(),
      seek: (s) => {
        v.currentTime = s;
      },
    };
  };

  const tryAgain = () => {
    setActiveId(null);
    setState({
      stage: "watching",
      resolvedInteractions: {},
      currentTime: 0,
    });
    ctl()?.seek(0);
  };

  // Internal: compute + emit the SCORM payload from a known-good snapshot
  // of state. Callers pass the snapshot explicitly so the auto-finish path
  // can use the just-committed state from recordScore's setState callback
  // — avoids a closure window where `state` could be one render behind the
  // latest `resolvedInteractions`.
  const scoring = useMemo(() => resolveScoring(config, { mode: "points", passPercentage: 50 }), [config]);

  const submitFrom = (snapshot: State) => {
    const scores = Object.values(snapshot.resolvedInteractions);
    const aggregated = aggregate(scores, scoring.passPercentage);
    const next: State = { ...snapshot, stage: "submitted" };
    setState(next);
    onSubmit({
      raw: aggregated.raw,
      max: aggregated.max,
      success: aggregated.success,
      suspendData: JSON.stringify(next),
    });
  };

  const finish = () => {
    if (state.stage !== "watching") return;
    submitFrom(state);
  };

  const allRequiredResolved = useMemo(() => {
    const required = validated.filter((v) => v.required);
    if (required.length === 0) return false;
    return required.every((v) => state.resolvedInteractions[v.id]);
  }, [validated, state.resolvedInteractions]);

  // Auto-finish when every required interaction has been resolved.
  // Depends on `state` directly so the snapshot passed to submitFrom is
  // always the same render's state — never a render-behind closure copy.
  useEffect(() => {
    if (state.stage !== "watching") return;
    if (!allRequiredResolved) return;
    submitFrom(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRequiredResolved, state]);

  // Checkpoint evaluation for a given playback time. Driven by the native
  // <video> timeupdate (html5) or the YouTube poll. Uses the unified `ctl()`
  // for pause/seek so both backends behave identically.
  const tick = (t: number) => {
    setState((s) => (s.currentTime === t ? s : { ...s, currentTime: t }));
    if (activeId !== null) return;
    if (state.stage !== "watching") return;
    const c = ctl();
    for (const it of validated) {
      if (state.resolvedInteractions[it.id]) continue;
      if (Math.abs(t - it.atSeconds) < TRIGGER_WINDOW && t >= it.atSeconds - TRIGGER_WINDOW) {
        c?.pause();
        setActiveId(it.id);
        return;
      }
      if (it.required && t > it.atSeconds + TRIGGER_WINDOW) {
        // Learner skipped past this required interaction. Seek back so the
        // overlay fires as playback re-enters its trigger window.
        c?.seek(Math.max(0, it.atSeconds - 0.5));
        c?.pause();
        return;
      }
    }
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (v) tick(v.currentTime);
  };

  const handlePlayPause = () => {
    const v = videoRef.current;
    if (!v) return;
    setState((s) => (s.currentTime === v.currentTime ? s : { ...s, currentTime: v.currentTime }));
  };

  const handleEnded = () => {
    if (state.stage !== "watching") return;
    // If the learner skipped past required interactions (or finished
    // without seeing them), seek back to the earliest unresolved one
    // rather than vacuously submitting. The TimeUpdate handler will
    // then trigger the overlay as the video re-plays through it.
    const unresolvedRequired = validated.find(
      (v) => v.required && !state.resolvedInteractions[v.id],
    );
    const c = ctl();
    if (unresolvedRequired && c) {
      c.seek(Math.max(0, unresolvedRequired.atSeconds - 0.5));
      c.play();
      return;
    }
    finish();
  };

  const recordScore = (id: string, score: ScoreState) => {
    setState((s) => ({
      ...s,
      resolvedInteractions: { ...s.resolvedInteractions, [id]: score },
    }));
  };

  const resume = () => {
    setActiveId(null);
    ctl()?.play();
  };

  const active = activeId ? validated.find((v) => v.id === activeId) ?? null : null;

  return (
    <div className="kukui-iv">
      <article className="kukui-iv__card" aria-labelledby={headingId}>
        <ActivityHeader
          title={config.title}
          titleId={headingId}
          headingLevel={headingLevel}
          variant={config.appearance?.header ?? "full"}
          prompt={
            config.prompt ? (
              <SafeHtml className="kukui-iv__prompt" html={config.prompt} />
            ) : undefined
          }
        />

        <div className="kukui-iv__stage">
          {isYouTube ? (
            <YouTubeStage
              src={config.video.src}
              className="kukui-iv__video"
              onController={(c) => {
                controllerRef.current = c;
              }}
              onTick={tick}
              onEnded={handleEnded}
            />
          ) : isVimeo ? (
            <div role="note" className="kukui-iv__placeholder">
              Vimeo embeds aren&rsquo;t supported yet — use a hosted MP4 (type
              &ldquo;html5&rdquo;) or a YouTube URL.
            </div>
          ) : (
            <video
              ref={videoRef}
              className="kukui-iv__video"
              src={config.video.src}
              poster={config.video.poster}
              controls
              preload="metadata"
              playsInline
              onTimeUpdate={handleTimeUpdate}
              onPlay={handlePlayPause}
              onPause={handlePlayPause}
              onEnded={handleEnded}
              data-testid="kukui-iv-video"
            />
          )}

          {active ? (
            <div
              className="kukui-iv__overlay"
              role="dialog"
              aria-modal="true"
              aria-label={`Interaction at ${Math.round(active.atSeconds)} seconds`}
            >
              <div className="kukui-iv__overlay-body">
                {active.kind === "multipleChoice" ? (
                  <MultipleChoice
                    config={active.config}
                    onSubmit={(s) => recordScore(active.id, s)}
                    headingLevel={2}
                  />
                ) : (
                  <FillInTheBlanks
                    config={active.config}
                    onSubmit={(s) => recordScore(active.id, s)}
                    headingLevel={2}
                  />
                )}
                <div className="kukui-iv__overlay-actions">
                  <button
                    type="button"
                    className="kukui-iv__primary"
                    onClick={resume}
                    disabled={!state.resolvedInteractions[active.id]}
                  >
                    {resumeLabel}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <p
          className={["kukui-iv__status", state.stage === "submitted" ? "is-visible" : ""]
            .filter(Boolean)
            .join(" ")}
          role="status"
          aria-live="polite"
        >
          {state.stage === "submitted"
            ? `Submitted. ${Object.keys(state.resolvedInteractions).length} of ${validated.length} interactions answered.`
            : `${Object.keys(state.resolvedInteractions).length} of ${validated.length} interactions answered.`}
        </p>

        {state.stage === "submitted" && scoring.enableRetry ? (
          <div className="kukui-iv__actions">
            <button
              type="button"
              className="kukui-iv__secondary"
              onClick={tryAgain}
            >
              {tryAgainLabel}
            </button>
          </div>
        ) : null}
      </article>
    </div>
  );
}

function parseSuspend(s: string | undefined): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.currentTime === "number" &&
      parsed.resolvedInteractions &&
      typeof parsed.resolvedInteractions === "object"
    ) {
      return {
        stage: parsed.stage === "submitted" ? "submitted" : "watching",
        resolvedInteractions: parsed.resolvedInteractions as Record<string, ScoreState>,
        currentTime: parsed.currentTime,
      };
    }
  } catch {
    /* noop */
  }
  return null;
}
