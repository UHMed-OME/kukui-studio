import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  MultipleChoiceConfigSchema,
  type MultipleChoiceConfig,
} from "@kukui/activities/multiple-choice/schema";
import {
  FillInTheBlanksConfigSchema,
  type FillInTheBlanksConfig,
} from "@kukui/activities/fill-in-the-blanks/schema";
import type { CoursePresentationConfig } from "./schema.js";
import type { ActivityProps, ScoreState } from "@kukui/core/types";
import { aggregate, resolveScoring } from "@kukui/core/scoring";
import MultipleChoice from "@kukui/activities/multiple-choice/Component";
import FillInTheBlanks from "@kukui/activities/fill-in-the-blanks/Component";
import {
  ActivityHeader,
  SafeHtml,
  StatusBadge,
  DotIcon,
  CheckIcon,
  TrophyIcon,
  type StatusTone,
} from "@kukui/core";
import "./Component.css";

type Stage = "viewing" | "submitted";

type Slide = CoursePresentationConfig["slides"][number];
type Overlay = Slide["overlays"][number];
type CheckpointOverlay = Extract<Overlay, { kind: "checkpoint" }>;

type State = {
  /** Index of the active slide. */
  current: number;
  /** "slideId:overlayId" -> ScoreState, recorded as each checkpoint is answered. */
  scores: Record<string, ScoreState>;
  /** "slideId:overlayId" -> the embedded activity's own suspend string, so a
   *  resumed deck can rehydrate each checkpoint's answered state. */
  children: Record<string, string>;
  /** Deck lifecycle. */
  stage: Stage;
};

/** A checkpoint's inner activity after late validation against its schema. */
type ValidatedActivity =
  | { kind: "multipleChoice"; config: MultipleChoiceConfig }
  | { kind: "fillInTheBlanks"; config: FillInTheBlanksConfig };

/** Stable key for a checkpoint's score, unique across the whole deck. */
const scoreKey = (slideId: string, overlayId: string) => `${slideId}:${overlayId}`;

function initialState(): State {
  return { current: 0, scores: {}, children: {}, stage: "viewing" };
}

/* -- Local icons (info / question) ------------------------------------------ */
// core ships status glyphs but no info/question marks; these are small,
// aria-hidden, currentColor strokes consistent with the core icon set.

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <line x1="12" y1="8" x2="12" y2="8" />
    </svg>
  );
}

function QuestionIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1.5 1.2-1.5 2.2" />
      <line x1="11.5" y1="17" x2="11.5" y2="17" />
    </svg>
  );
}

/**
 * Validate a checkpoint overlay's inner config at render time (the loose
 * `z.unknown()` from schema.ts is resolved here). Returns null when the config
 * fails validation — a malformed checkpoint degrades to a no-op marker rather
 * than crashing the deck. Same pattern the previous embed used.
 */
function validateCheckpoint(overlay: CheckpointOverlay): ValidatedActivity | null {
  const { kind, config } = overlay.activity;
  if (kind === "multipleChoice") {
    const r = MultipleChoiceConfigSchema.safeParse(config);
    if (r.success) return { kind: "multipleChoice", config: r.data };
    console.warn(
      `[kukui:course-presentation] checkpoint ${overlay.id} multipleChoice failed validation; rendering an inert marker.`,
      r.error.issues,
    );
    return null;
  }
  const r = FillInTheBlanksConfigSchema.safeParse(config);
  if (r.success) return { kind: "fillInTheBlanks", config: r.data };
  console.warn(
    `[kukui:course-presentation] checkpoint ${overlay.id} fillInTheBlanks failed validation; rendering an inert marker.`,
    r.error.issues,
  );
  return null;
}

export default function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<CoursePresentationConfig>) {
  const H2 = `h${Math.min(headingLevel + 1, 3)}` as "h2" | "h3";
  const embeddedLevel = Math.min(headingLevel + 1, 3) as 1 | 2 | 3;
  const headingId = useId();
  const liveId = useId();
  const detailId = useId();

  const slides = config.slides;

  /**
   * Per-overlay validated checkpoint configs, keyed by deck score key. Info
   * overlays and invalid checkpoints are absent. Memoized on the deck.
   */
  const validated = useMemo<Record<string, ValidatedActivity>>(() => {
    const out: Record<string, ValidatedActivity> = {};
    for (const s of slides) {
      for (const o of s.overlays) {
        if (o.kind !== "checkpoint") continue;
        const v = validateCheckpoint(o);
        if (v) out[scoreKey(s.id, o.id)] = v;
      }
    }
    return out;
  }, [slides]);

  /** Keys of every valid (scorable) checkpoint in the deck. */
  const scorableKeys = useMemo(() => Object.keys(validated), [validated]);
  const hasScorable = scorableKeys.length > 0;

  const [state, setState] = useState<State>(
    () => parseSuspend(suspendData, slides.length, scorableKeys) ?? initialState(),
  );
  /** Which overlay's detail panel is open on the current slide (null = none). */
  const [openOverlayId, setOpenOverlayId] = useState<string | null>(null);
  /** Marker buttons by overlay id — focus returns here when a panel closes. */
  const markerRefs = useRef(new Map<string, HTMLButtonElement>());

  // Reset local state when `config` changes externally (Studio Preview edit,
  // draft load). Reference equality on the prop — engine loads JSON once.
  useEffect(() => {
    setState(parseSuspend(suspendData, slides.length, scorableKeys) ?? initialState());
    setOpenOverlayId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  const scoring = useMemo(
    () => resolveScoring(config, { mode: "completion", passPercentage: 60 }),
    [config],
  );

  const total = slides.length;
  const slide = slides[state.current];
  const isLast = state.current === total - 1;
  const submitted = state.stage === "submitted";

  // Required checkpoints on the current slide that are valid but unanswered
  // block Next (the slide-deck analog of interactive-video's required gating).
  const blockingRequired = useMemo(() => {
    if (!slide) return 0;
    return slide.overlays.filter((o) => {
      if (o.kind !== "checkpoint" || !o.required) return false;
      const key = scoreKey(slide.id, o.id);
      return Boolean(validated[key]) && !state.scores[key];
    }).length;
  }, [slide, validated, state.scores]);

  const goTo = (index: number) => {
    if (index < 0 || index >= total) return;
    // Forward jumps honor the same required-checkpoint gate as Next / Finish
    // (the dot strip must not bypass it). Backward jumps are always allowed.
    if (index > state.current && blockingRequired > 0) return;
    setState((s) => ({ ...s, current: index }));
    setOpenOverlayId(null);
  };

  const recordScore = (key: string, score: ScoreState) => {
    // Once the deck is submitted the aggregate has been reported to the LMS;
    // re-answering a reopened checkpoint must not silently diverge from it.
    setState((s) =>
      s.stage === "submitted" ? s : { ...s, scores: { ...s.scores, [key]: score } },
    );
  };

  const recordChildSuspend = (key: string, data: string) => {
    setState((s) => {
      if (s.children[key] === data) return s; // identical write — keep state stable
      return { ...s, children: { ...s.children, [key]: data } };
    });
  };

  // Aggregate the checkpoint scores into the SCORM payload. With no scorable
  // checkpoint the deck is completion-only: success on finish.
  const finish = () => {
    if (submitted) return;
    const next: State = { ...state, stage: "submitted" };
    setState(next);
    if (!hasScorable) {
      onSubmit({ raw: 0, max: 0, success: true, suspendData: JSON.stringify(next) });
      return;
    }
    const scores = scorableKeys
      .map((k) => state.scores[k])
      .filter((x): x is ScoreState => Boolean(x));
    const aggregated = aggregate(scores, scoring.passPercentage);
    onSubmit({
      raw: aggregated.raw,
      max: aggregated.max,
      success: aggregated.success,
      suspendData: JSON.stringify(next),
    });
  };

  const tryAgain = () => {
    setState(initialState());
    setOpenOverlayId(null);
  };

  // Completion badge: aggregate of checkpoint scores once finished, else
  // in-progress. Color is always paired with an icon + text label.
  const badge = useMemo(() => {
    if (!submitted) {
      return { tone: "neutral" as StatusTone, icon: <DotIcon />, label: "In progress" };
    }
    if (!hasScorable) {
      return { tone: "success" as StatusTone, icon: <CheckIcon />, label: "Complete" };
    }
    const scores = scorableKeys
      .map((k) => state.scores[k])
      .filter((x): x is ScoreState => Boolean(x));
    const aggregated = aggregate(scores, scoring.passPercentage);
    return aggregated.success
      ? { tone: "success" as StatusTone, icon: <TrophyIcon />, label: "Passed" }
      : { tone: "warning" as StatusTone, icon: <CheckIcon />, label: "Review" };
  }, [submitted, hasScorable, scorableKeys, state.scores, scoring.passPercentage]);

  if (!slide) return null;

  const bg = slide.background;
  const openOverlay = slide.overlays.find((o) => o.id === openOverlayId) ?? null;
  const slideLabelId = `${headingId}-slide-${state.current}`;

  return (
    <div className="kukui-cp">
      <article className="kukui-cp__card" aria-labelledby={headingId}>
        <ActivityHeader
          title={config.title}
          titleId={headingId}
          headingLevel={headingLevel}
          variant={config.appearance?.header ?? "full"}
          badge={
            <StatusBadge tone={badge.tone} icon={badge.icon} onDark>
              {badge.label}
            </StatusBadge>
          }
        />

        <section className="kukui-cp__slide" aria-labelledby={slideLabelId}>
          {slide.title ? (
            <H2 id={slideLabelId} className="kukui-cp__slide-title">
              {slide.title}
            </H2>
          ) : (
            <span id={slideLabelId} className="kukui-cp__sr-only">
              {`Slide ${state.current + 1}`}
            </span>
          )}

          {bg.kind === "image" ? (
            <div
              className="kukui-cp__stage"
              style={{ aspectRatio: `${bg.naturalWidth} / ${bg.naturalHeight}` }}
            >
              {bg.src ? (
                <img className="kukui-cp__media" src={bg.src} alt={bg.alt} />
              ) : (
                <div className="kukui-cp__media-missing" role="img" aria-label={bg.alt}>
                  Slide image unavailable
                </div>
              )}
              {slide.overlays.map((o) => {
                const key = scoreKey(slide.id, o.id);
                const isCheckpoint = o.kind === "checkpoint";
                const isValid = !isCheckpoint || Boolean(validated[key]);
                const answered = isCheckpoint && Boolean(state.scores[key]);
                const isOpen = o.id === openOverlayId;
                return (
                  <button
                    key={o.id}
                    ref={(el) => {
                      if (el) markerRefs.current.set(o.id, el);
                      else markerRefs.current.delete(o.id);
                    }}
                    type="button"
                    className={[
                      "kukui-cp__marker",
                      isCheckpoint ? "is-checkpoint" : "is-info",
                      answered ? "is-answered" : "",
                      isCheckpoint && o.required ? "is-required" : "",
                      isOpen ? "is-open" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{
                      left: `${o.rect.x * 100}%`,
                      top: `${o.rect.y * 100}%`,
                      width: `${o.rect.w * 100}%`,
                      height: `${o.rect.h * 100}%`,
                    }}
                    aria-expanded={isOpen}
                    aria-controls={detailId}
                    disabled={!isValid}
                    onClick={() => setOpenOverlayId(isOpen ? null : o.id)}
                  >
                    <span className="kukui-cp__marker-icon" aria-hidden="true">
                      {answered ? <CheckIcon /> : isCheckpoint ? <QuestionIcon /> : <InfoIcon />}
                    </span>
                    <span className="kukui-cp__marker-label">
                      {o.kind === "info" ? o.label : o.activity.kind === "multipleChoice" ? "Question" : "Fill in"}
                      {isCheckpoint && o.required ? " (required)" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="kukui-cp__blank" aria-hidden={slide.title ? "true" : undefined} />
          )}

          {slide.notes && <SafeHtml className="kukui-cp__notes" html={slide.notes} />}

          {/* Detail panel for the open overlay — reserved region, below the
              slide so opening it never reflows the slide image itself. The
              live region is scoped to the info text only; embedded activities
              manage their own announcements and must not sit inside one. */}
          <div id={detailId} className="kukui-cp__detail">
            {openOverlay && openOverlay.kind === "info" && (
              <div className="kukui-cp__info-detail">
                <div className="kukui-cp__detail-head">
                  <span className="kukui-cp__detail-title">{openOverlay.label}</span>
                  <button
                    type="button"
                    className="kukui-cp__detail-close"
                    onClick={() => {
                      setOpenOverlayId(null);
                      // Return focus to the owning marker so keyboard users
                      // don't get dropped to the document body.
                      markerRefs.current.get(openOverlay.id)?.focus();
                    }}
                  >
                    Close
                  </button>
                </div>
                <div aria-live="polite">
                  {openOverlay.html && (
                    <SafeHtml className="kukui-cp__info-body" html={openOverlay.html} />
                  )}
                </div>
              </div>
            )}
            {openOverlay && openOverlay.kind === "checkpoint" && (() => {
              const key = scoreKey(slide.id, openOverlay.id);
              const v = validated[key];
              if (!v) return null;
              return (
                <div className="kukui-cp__embed">
                  {v.kind === "multipleChoice" ? (
                    <MultipleChoice
                      config={v.config}
                      onSubmit={(s) => recordScore(key, s)}
                      onPersist={(d) => recordChildSuspend(key, d)}
                      suspendData={state.children[key]}
                      headingLevel={embeddedLevel}
                    />
                  ) : (
                    <FillInTheBlanks
                      config={v.config}
                      onSubmit={(s) => recordScore(key, s)}
                      onPersist={(d) => recordChildSuspend(key, d)}
                      suspendData={state.children[key]}
                      headingLevel={embeddedLevel}
                    />
                  )}
                </div>
              );
            })()}
          </div>
        </section>

        <nav className="kukui-cp__dots" aria-label="Slides">
          <ol className="kukui-cp__dot-list">
            {slides.map((s, i) => {
              const isCurrent = i === state.current;
              const answered = s.overlays.some(
                (o) => o.kind === "checkpoint" && state.scores[scoreKey(s.id, o.id)],
              );
              // Forward dots honor the required-checkpoint gate, same as
              // Next / Finish (the strip must not be a gating bypass).
              const gated = blockingRequired > 0 && i > state.current;
              return (
                <li key={s.id} className="kukui-cp__dot-item">
                  <button
                    type="button"
                    className={[
                      "kukui-cp__dot",
                      isCurrent ? "is-current" : "",
                      answered ? "is-answered" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-current={isCurrent ? "true" : undefined}
                    aria-label={`Go to slide ${i + 1} of ${total}${s.title ? `: ${s.title}` : ""}${answered ? ", answered" : ""}${gated ? ", blocked until required checkpoints are answered" : ""}`}
                    disabled={gated}
                    onClick={() => goTo(i)}
                  >
                    <span className="kukui-cp__dot-mark" aria-hidden="true">
                      {answered ? "✓" : i + 1}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div id={liveId} className="kukui-cp__status" role="status" aria-live="polite">
          {`Slide ${state.current + 1} of ${total}`}
          {submitted ? ` — ${badge.label}` : ""}
        </div>

        {blockingRequired > 0 && !isLast && (
          <p className="kukui-cp__gate">
            Answer the required {blockingRequired === 1 ? "checkpoint" : "checkpoints"} on this slide
            to continue.
          </p>
        )}

        <nav className="kukui-cp__nav" aria-label="Slide navigation">
          <button
            type="button"
            className="kukui-cp__secondary"
            onClick={() => goTo(state.current - 1)}
            disabled={state.current === 0}
          >
            ← Prev
          </button>
          <div className="kukui-cp__nav-end">
            {submitted && scoring.enableRetry && (
              <button type="button" className="kukui-cp__secondary" onClick={tryAgain}>
                Try again
              </button>
            )}
            {!isLast && (
              <button
                type="button"
                className="kukui-cp__primary"
                onClick={() => goTo(state.current + 1)}
                disabled={blockingRequired > 0}
              >
                Next →
              </button>
            )}
            {isLast && !submitted && (
              <button
                type="button"
                className="kukui-cp__primary"
                onClick={finish}
                disabled={blockingRequired > 0}
              >
                Finish
              </button>
            )}
          </div>
        </nav>

        {config.author && <p className="kukui-cp__credit">By {config.author}</p>}
      </article>
    </div>
  );
}

/* -- Suspend ---------------------------------------------------------------- */

function parseSuspend(
  s: string | undefined,
  slideCount: number,
  scorableKeys: string[],
): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (!parsed || typeof parsed.current !== "number") return null;
    const current = parsed.current >= 0 && parsed.current < slideCount ? parsed.current : 0;

    const known = new Set(scorableKeys);
    const scores: Record<string, ScoreState> = {};
    if (parsed.scores && typeof parsed.scores === "object") {
      for (const [key, sc] of Object.entries(parsed.scores)) {
        if (
          known.has(key) &&
          sc &&
          typeof sc === "object" &&
          typeof sc.raw === "number" &&
          typeof sc.max === "number" &&
          typeof sc.success === "boolean"
        ) {
          scores[key] = sc as ScoreState;
        }
      }
    }

    const children: Record<string, string> = {};
    if (parsed.children && typeof parsed.children === "object") {
      for (const [key, data] of Object.entries(parsed.children)) {
        if (known.has(key) && typeof data === "string") children[key] = data;
      }
    }

    return {
      current,
      scores,
      children,
      stage: parsed.stage === "submitted" ? "submitted" : "viewing",
    };
  } catch {
    return null;
  }
}
