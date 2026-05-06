import { useEffect, useId, useMemo, useState } from "react";
import {
  MultipleChoiceConfigSchema,
  FillInTheBlanksConfigSchema,
  type CoursePresentationConfig,
  type MultipleChoiceConfig,
  type FillInTheBlanksConfig,
} from "@kukui/schemas";
import type { ActivityProps, ScoreState } from "../../types.js";
import { MultipleChoice } from "../multiple-choice/index.js";
import { FillInTheBlanks } from "../fill-in-the-blanks/index.js";
import { SafeHtml } from "../../safe-html.js";
import "./CoursePresentation.css";

type Stage = "viewing" | "submitted";

type State = {
  stage: Stage;
  current: number;
  /** Score per `slideIdx:elementIdx` key. */
  scores: Record<string, ScoreState>;
};

type ValidatedInteraction =
  | { kind: "multipleChoice"; config: MultipleChoiceConfig }
  | { kind: "fillInTheBlanks"; config: FillInTheBlanksConfig };

export function CoursePresentation({
  config,
  onSubmit,
  onPersist,
  suspendData,
}: ActivityProps<CoursePresentationConfig>) {
  const headingId = useId();

  const [state, setState] = useState<State>(
    () => parseSuspend(suspendData) ?? { stage: "viewing", current: 0, scores: {} },
  );

  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  const total = config.slides.length;
  const isLast = state.current === total - 1;
  const showProgress = config.behaviour?.showProgressBar ?? true;
  const ui = config.ui ?? {};

  const slide = config.slides[state.current];
  if (!slide) return null;

  const goPrev = () =>
    setState((s) => ({ ...s, current: Math.max(0, s.current - 1) }));
  const goNext = () =>
    setState((s) => ({ ...s, current: Math.min(total - 1, s.current + 1) }));

  const recordScore = (key: string, score: ScoreState) =>
    setState((s) => ({ ...s, scores: { ...s.scores, [key]: score } }));

  const finish = () => {
    if (state.stage !== "viewing") return;
    let raw = 0;
    let max = 0;
    for (const sc of Object.values(state.scores)) {
      raw += sc.raw;
      max += sc.max;
    }
    const next: State = { ...state, stage: "submitted" };
    setState(next);
    const success = max === 0 ? true : (raw / max) * 100 >= 70;
    onSubmit({ raw, max, success, suspendData: JSON.stringify(next) });
  };

  return (
    <div className="kukui-cp">
      <article className="kukui-cp__card" aria-labelledby={headingId}>
        <header className="kukui-cp__header">
          <h1 id={headingId} className="kukui-cp__title">
            {config.title}
          </h1>
          {showProgress ? (
            <p className="kukui-cp__progress" aria-live="polite">
              Slide {state.current + 1} of {total}
            </p>
          ) : null}
        </header>

        <div
          className="kukui-cp__canvas"
          style={{
            backgroundColor: slide.background?.color ?? "transparent",
            backgroundImage: slide.background?.src ? `url(${slide.background.src})` : undefined,
          }}
        >
          {slide.title ? <h2 className="kukui-cp__slide-title">{slide.title}</h2> : null}
          {slide.elements.map((el, i) => {
            const style = {
              left: `${el.rect.x * 100}%`,
              top: `${el.rect.y * 100}%`,
              width: `${el.rect.w * 100}%`,
              height: `${el.rect.h * 100}%`,
            } as const;
            const key = `${state.current}:${i}`;
            if (el.type === "text") {
              return (
                <div key={key} className="kukui-cp__el kukui-cp__el--text" style={style}>
                  <SafeHtml html={el.html} />
                </div>
              );
            }
            if (el.type === "image") {
              return (
                <img
                  key={key}
                  className="kukui-cp__el kukui-cp__el--image"
                  style={style}
                  src={el.src}
                  alt={el.alt ?? ""}
                />
              );
            }
            // interaction
            const validated = validateNested(el.kind, el.config);
            if (!validated) {
              return (
                <div
                  key={key}
                  role="alert"
                  className="kukui-cp__el kukui-cp__el--invalid"
                  style={style}
                >
                  Embedded {el.kind} failed validation; check the JSON.
                </div>
              );
            }
            return (
              <div key={key} className="kukui-cp__el kukui-cp__el--interaction" style={style}>
                {validated.kind === "multipleChoice" ? (
                  <MultipleChoice
                    config={validated.config}
                    onSubmit={(s) => recordScore(key, s)}
                  />
                ) : (
                  <FillInTheBlanks
                    config={validated.config}
                    onSubmit={(s) => recordScore(key, s)}
                  />
                )}
              </div>
            );
          })}
        </div>

        <nav className="kukui-cp__nav" aria-label="Slide navigation">
          <button
            type="button"
            className="kukui-cp__secondary"
            onClick={goPrev}
            disabled={state.current === 0}
          >
            {ui.previousSlideButton ?? "Previous"}
          </button>
          <button
            type="button"
            className="kukui-cp__secondary"
            onClick={goNext}
            disabled={isLast}
          >
            {ui.nextSlideButton ?? "Next"}
          </button>
          {isLast && state.stage === "viewing" ? (
            <button type="button" className="kukui-cp__primary" onClick={finish}>
              {ui.finishButton ?? "Finish"}
            </button>
          ) : null}
        </nav>
      </article>
    </div>
  );
}

function validateNested(
  kind: "multipleChoice" | "fillInTheBlanks",
  raw: unknown,
): ValidatedInteraction | null {
  if (kind === "multipleChoice") {
    const r = MultipleChoiceConfigSchema.safeParse(raw);
    if (!r.success) {
      console.warn("[kukui:course-presentation] invalid embedded multipleChoice", r.error.issues);
      return null;
    }
    return { kind: "multipleChoice", config: r.data };
  }
  const r = FillInTheBlanksConfigSchema.safeParse(raw);
  if (!r.success) {
    console.warn("[kukui:course-presentation] invalid embedded fillInTheBlanks", r.error.issues);
    return null;
  }
  return { kind: "fillInTheBlanks", config: r.data };
}

function parseSuspend(s: string | undefined): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (parsed && typeof parsed.current === "number") {
      return {
        stage: parsed.stage === "submitted" ? "submitted" : "viewing",
        current: parsed.current,
        scores: typeof parsed.scores === "object" && parsed.scores ? parsed.scores : {},
      };
    }
  } catch {
    /* noop */
  }
  return null;
}
