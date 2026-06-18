import { useEffect, useId, useMemo, useState } from "react";
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

type State = {
  /** Index of the active slide. */
  current: number;
  /** slideId -> ScoreState, recorded as each embedded activity is answered. */
  scores: Record<string, ScoreState>;
  /** Deck lifecycle. */
  stage: Stage;
};

/** A slide's embedded activity after late validation against the inner schema. */
type ValidatedActivity =
  | { kind: "multipleChoice"; config: MultipleChoiceConfig }
  | { kind: "fillInTheBlanks"; config: FillInTheBlanksConfig };

function initialState(): State {
  return { current: 0, scores: {}, stage: "viewing" };
}

/**
 * Validate a slide's embedded activity config at render time (the loose
 * `z.unknown()` from schema.ts is resolved here). Returns null when the slide
 * has no activity or the config fails validation — a malformed embed degrades
 * to a content-only slide rather than crashing the deck.
 */
function validateActivity(
  slideId: string,
  activity: CoursePresentationConfig["slides"][number]["activity"],
): ValidatedActivity | null {
  if (!activity) return null;
  if (activity.kind === "multipleChoice") {
    const r = MultipleChoiceConfigSchema.safeParse(activity.config);
    if (r.success) return { kind: "multipleChoice", config: r.data };
    console.warn(
      `[kukui:course-presentation] Slide ${slideId} multipleChoice failed validation; rendering content only.`,
      r.error.issues,
    );
    return null;
  }
  const r = FillInTheBlanksConfigSchema.safeParse(activity.config);
  if (r.success) return { kind: "fillInTheBlanks", config: r.data };
  console.warn(
    `[kukui:course-presentation] Slide ${slideId} fillInTheBlanks failed validation; rendering content only.`,
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

  const slides = config.slides;

  /** Per-slide validated embedded activity (null where none / invalid). */
  const validatedActivities = useMemo<Record<string, ValidatedActivity | null>>(() => {
    const out: Record<string, ValidatedActivity | null> = {};
    for (const s of slides) out[s.id] = validateActivity(s.id, s.activity);
    return out;
  }, [slides]);

  /** Ids of slides that carry a valid embedded (scorable) activity. */
  const scorableIds = useMemo(
    () => slides.filter((s) => validatedActivities[s.id]).map((s) => s.id),
    [slides, validatedActivities],
  );
  const hasScorable = scorableIds.length > 0;

  const [state, setState] = useState<State>(
    () => parseSuspend(suspendData, slides.length, scorableIds) ?? initialState(),
  );

  // Reset local state when `config` changes externally (Studio Preview edit,
  // draft load). Reference equality on the prop — engine loads JSON once.
  useEffect(() => {
    setState(parseSuspend(suspendData, slides.length, scorableIds) ?? initialState());
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

  const goTo = (index: number) => {
    if (index < 0 || index >= total) return;
    setState((s) => ({ ...s, current: index }));
  };

  const recordScore = (slideId: string, score: ScoreState) => {
    setState((s) => ({ ...s, scores: { ...s.scores, [slideId]: score } }));
  };

  // Aggregate the embedded-activity scores into the SCORM payload. With no
  // scorable slide the deck is completion-only: success on finish.
  const finish = () => {
    if (submitted) return;
    const scores = scorableIds
      .map((id) => state.scores[id])
      .filter((x): x is ScoreState => Boolean(x));
    const next: State = { ...state, stage: "submitted" };
    setState(next);
    if (!hasScorable) {
      onSubmit({ raw: 0, max: 0, success: true, suspendData: JSON.stringify(next) });
      return;
    }
    const aggregated = aggregate(scores, scoring.passPercentage);
    onSubmit({
      raw: aggregated.raw,
      max: aggregated.max,
      success: aggregated.success,
      suspendData: JSON.stringify(next),
    });
  };

  const tryAgain = () => setState(initialState());

  // Completion badge: aggregate of embedded scores once finished, else
  // in-progress. Color is always paired with an icon + text label.
  const badge = useMemo(() => {
    if (!submitted) {
      return { tone: "neutral" as StatusTone, icon: <DotIcon />, label: "In progress" };
    }
    if (!hasScorable) {
      return { tone: "success" as StatusTone, icon: <CheckIcon />, label: "Complete" };
    }
    const scores = scorableIds
      .map((id) => state.scores[id])
      .filter((x): x is ScoreState => Boolean(x));
    const aggregated = aggregate(scores, scoring.passPercentage);
    return aggregated.success
      ? { tone: "success" as StatusTone, icon: <TrophyIcon />, label: "Passed" }
      : { tone: "warning" as StatusTone, icon: <CheckIcon />, label: "Review" };
  }, [submitted, hasScorable, scorableIds, state.scores, scoring.passPercentage]);

  if (!slide) return null;

  const activity = validatedActivities[slide.id] ?? null;

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

        <section
          className="kukui-cp__slide"
          aria-labelledby={`${headingId}-slide-${state.current}`}
        >
          {slide.title ? (
            <H2 id={`${headingId}-slide-${state.current}`} className="kukui-cp__slide-title">
              {slide.title}
            </H2>
          ) : (
            <span id={`${headingId}-slide-${state.current}`} className="kukui-cp__sr-only">
              {`Slide ${state.current + 1}`}
            </span>
          )}

          {slide.body && <SafeHtml className="kukui-cp__body" html={slide.body} />}

          {slide.media && (
            <figure className="kukui-cp__figure">
              <img className="kukui-cp__media" src={slide.media.src} alt={slide.media.alt} />
              {slide.media.caption && (
                <figcaption className="kukui-cp__figcaption">{slide.media.caption}</figcaption>
              )}
            </figure>
          )}

          {activity && (
            <div className="kukui-cp__embed">
              {activity.kind === "multipleChoice" ? (
                <MultipleChoice
                  config={activity.config}
                  onSubmit={(s) => recordScore(slide.id, s)}
                  headingLevel={embeddedLevel}
                />
              ) : (
                <FillInTheBlanks
                  config={activity.config}
                  onSubmit={(s) => recordScore(slide.id, s)}
                  headingLevel={embeddedLevel}
                />
              )}
            </div>
          )}
        </section>

        <nav className="kukui-cp__dots" aria-label="Slides">
          <ol className="kukui-cp__dot-list">
            {slides.map((s, i) => {
              const isCurrent = i === state.current;
              const answered = Boolean(state.scores[s.id]);
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
                    aria-label={`Go to slide ${i + 1} of ${total}${s.title ? `: ${s.title}` : ""}${answered ? ", answered" : ""}`}
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

        <div
          id={liveId}
          className="kukui-cp__status"
          role="status"
          aria-live="polite"
        >
          {`Slide ${state.current + 1} of ${total}`}
          {submitted ? ` — ${badge.label}` : ""}
        </div>

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
              >
                Next →
              </button>
            )}
            {isLast && !submitted && (
              <button type="button" className="kukui-cp__primary" onClick={finish}>
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
  scorableIds: string[],
): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (!parsed || typeof parsed.current !== "number") return null;
    const current =
      parsed.current >= 0 && parsed.current < slideCount ? parsed.current : 0;

    const known = new Set(scorableIds);
    const scores: Record<string, ScoreState> = {};
    if (parsed.scores && typeof parsed.scores === "object") {
      for (const [id, sc] of Object.entries(parsed.scores)) {
        if (known.has(id) && sc && typeof sc === "object" && typeof sc.raw === "number") {
          scores[id] = sc as ScoreState;
        }
      }
    }

    return {
      current,
      scores,
      stage: parsed.stage === "submitted" ? "submitted" : "viewing",
    };
  } catch {
    return null;
  }
}
