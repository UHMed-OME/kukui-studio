import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  MultipleChoiceConfigSchema,
  FillInTheBlanksConfigSchema,
  type InteractiveVideoConfig,
  type MultipleChoiceConfig,
  type FillInTheBlanksConfig,
} from "@kukui/schemas";
import type { ActivityProps, ScoreState } from "../../types.js";
import { aggregate } from "../../scoring.js";
import { MultipleChoice } from "../multiple-choice/index.js";
import { FillInTheBlanks } from "../fill-in-the-blanks/index.js";
import { SafeHtml } from "../../safe-html.js";
import "./InteractiveVideo.css";

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

export function InteractiveVideo({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<InteractiveVideoConfig>) {
  const HeadingTag = `h${headingLevel}` as "h1" | "h2" | "h3";
  const headingId = useId();
  const videoRef = useRef<HTMLVideoElement | null>(null);

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

  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  const ui = config.ui ?? {};
  const resumeLabel = ui.resumeButtonLabel ?? "Resume";
  const videoType = config.video.type ?? "html5";
  const isUnsupportedSource = videoType === "youtube" || videoType === "vimeo";

  const finish = () => {
    if (state.stage !== "watching") return;
    const scores = Object.values(state.resolvedInteractions);
    const passPct = config.behaviour?.passPercentage ?? 50;
    const aggregated = aggregate(scores, passPct);
    const next: State = { ...state, stage: "submitted" };
    setState(next);
    onSubmit({
      raw: aggregated.raw,
      max: aggregated.max,
      success: aggregated.success,
      suspendData: JSON.stringify(next),
    });
  };

  const allRequiredResolved = useMemo(() => {
    const required = validated.filter((v) => v.required);
    if (required.length === 0) return false;
    return required.every((v) => state.resolvedInteractions[v.id]);
  }, [validated, state.resolvedInteractions]);

  // Auto-finish when every required interaction has been resolved.
  useEffect(() => {
    if (state.stage !== "watching") return;
    if (!allRequiredResolved) return;
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRequiredResolved]);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    const t = v.currentTime;
    setState((s) => (s.currentTime === t ? s : { ...s, currentTime: t }));
    if (activeId !== null) return;
    if (state.stage !== "watching") return;
    for (const it of validated) {
      if (state.resolvedInteractions[it.id]) continue;
      if (Math.abs(t - it.atSeconds) < TRIGGER_WINDOW && t >= it.atSeconds - TRIGGER_WINDOW) {
        v.pause();
        setActiveId(it.id);
        break;
      }
    }
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
    if (unresolvedRequired && videoRef.current) {
      videoRef.current.currentTime = Math.max(0, unresolvedRequired.atSeconds - 0.5);
      videoRef.current.play().catch(() => {});
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
    const v = videoRef.current;
    if (v && typeof v.play === "function") {
      // Browsers return a promise from play(); ignore rejections (autoplay policy).
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  };

  const active = activeId ? validated.find((v) => v.id === activeId) ?? null : null;

  return (
    <div className="kukui-iv">
      <article className="kukui-iv__card" aria-labelledby={headingId}>
        <header className="kukui-iv__header">
          <HeadingTag id={headingId} className="kukui-iv__title">
            {config.title}
          </HeadingTag>
          {config.prompt ? (
            <SafeHtml className="kukui-iv__prompt" html={config.prompt} />
          ) : null}
        </header>

        <div className="kukui-iv__stage">
          {isUnsupportedSource ? (
            <div role="note" className="kukui-iv__placeholder">
              {videoType === "youtube" ? "YouTube" : "Vimeo"} embeds are not yet
              supported in this build. Use a hosted MP4 (type "html5") for now.
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
