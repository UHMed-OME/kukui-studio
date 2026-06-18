import { useEffect, useId, useMemo, useState } from "react";
import {
  MultipleChoiceConfigSchema,
  type MultipleChoiceConfig,
} from "@kukui/activities/multiple-choice/schema";
import {
  FillInTheBlanksConfigSchema,
  type FillInTheBlanksConfig,
} from "@kukui/activities/fill-in-the-blanks/schema";
import type { QuestionSetConfig } from "./schema.js";
import type { ActivityProps, ScoreState } from "@kukui/core/types";
import { resolveScoring } from "@kukui/core/scoring";
import MultipleChoice from "@kukui/activities/multiple-choice/Component";
import FillInTheBlanks from "@kukui/activities/fill-in-the-blanks/Component";
import { ActivityHeader } from "@kukui/core";
import "./Component.css";

type Stage = "answering" | "submitted";

type ValidatedQuestion =
  | { type: "multipleChoice"; config: MultipleChoiceConfig; weight: number; index: number }
  | { type: "fillInTheBlanks"; config: FillInTheBlanksConfig; weight: number; index: number };

type State = {
  stage: Stage;
  /** Score per question index, keyed by validated-questions order. */
  scores: Record<number, ScoreState>;
  current: number;
  attempts: number;
};

/** Tiny seeded PRNG (mulberry32) — stable shuffle across remounts. */
function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleIndices(n: number, seed: number): number[] {
  const out = Array.from({ length: n }, (_, i) => i);
  const rand = rng(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i] as number;
    out[i] = out[j] as number;
    out[j] = tmp;
  }
  return out;
}

export default function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<QuestionSetConfig>) {
  const headingId = useId();

  // Validate every nested config once. Drop invalid entries with a warning.
  const validated = useMemo<ValidatedQuestion[]>(() => {
    const out: ValidatedQuestion[] = [];
    config.questions.forEach((q, i) => {
      const weight = q.weight ?? 1;
      if (q.type === "multipleChoice") {
        const r = MultipleChoiceConfigSchema.safeParse(q.config);
        if (r.success) out.push({ type: "multipleChoice", config: r.data, weight, index: i });
        else
          console.warn(
            `[kukui:question-set] Question ${i} (multipleChoice) failed validation; skipping.`,
            r.error.issues,
          );
      } else {
        const r = FillInTheBlanksConfigSchema.safeParse(q.config);
        if (r.success) out.push({ type: "fillInTheBlanks", config: r.data, weight, index: i });
        else
          console.warn(
            `[kukui:question-set] Question ${i} (fillInTheBlanks) failed validation; skipping.`,
            r.error.issues,
          );
      }
    });
    return out;
  }, [config.questions]);

  // Display order of validated questions. Scores stay keyed by the
  // ORIGINAL question index (q.index), so resume data is order-stable
  // even though the shuffle varies across mounts — mirrors how
  // MultipleChoice handles behaviour.randomAnswers.
  const ordered = useMemo<ValidatedQuestion[]>(() => {
    if (!config.behaviour?.randomQuestions) return validated;
    // Per-mount seed: stable across re-renders, varies across mounts.
    const seed = Math.floor(Math.random() * 0xffffffff) >>> 0;
    return shuffleIndices(validated.length, seed).map((i) => validated[i] as ValidatedQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validated, config.behaviour?.randomQuestions]);

  const initial: State = { stage: "answering", scores: {}, current: 0, attempts: 0 };
  const [state, setState] = useState<State>(
    () => parseSuspend(suspendData, validated.length) ?? initial,
  );

  // Reset local state when `config` changes externally (Studio Preview edit,
  // AI Accept, draft load, etc.). Reference equality on the `config` prop —
  // engine context loads JSON once and never mutates the ref, so this only
  // fires in Studio Preview. Replaces the now-removed JSON.stringify(value)
  // remount key.
  useEffect(() => {
    setState(
      parseSuspend(suspendData, validated.length) ?? {
        stage: "answering",
        scores: {},
        current: 0,
        attempts: 0,
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  const total = validated.length;
  const answeredCount = Object.keys(state.scores).length;
  const scoring = useMemo(() => resolveScoring(config, { mode: "points", passPercentage: 50 }), [config]);
  const passPct = scoring.passPercentage;

  const goPrev = () =>
    setState((s) => ({ ...s, current: Math.max(0, s.current - 1) }));
  const goNext = () =>
    setState((s) => ({ ...s, current: Math.min(total - 1, s.current + 1) }));

  const recordScore = (questionIndex: number, score: ScoreState) => {
    setState((s) => ({ ...s, scores: { ...s.scores, [questionIndex]: score } }));
  };

  const submitSet = () => {
    if (state.stage !== "answering") return;
    const totalWeight = validated.reduce((acc, q) => acc + q.weight, 0);
    let weightedRaw = 0;
    let weightedMax = 0;
    for (const q of validated) {
      const sc = state.scores[q.index];
      if (!sc || sc.max === 0) continue;
      weightedRaw += (sc.raw / sc.max) * q.weight;
      weightedMax += q.weight;
    }
    const aggregated: ScoreState = {
      raw: weightedRaw,
      max: weightedMax || totalWeight,
      success: weightedMax > 0 ? (weightedRaw / weightedMax) * 100 >= passPct : false,
    };
    const next: State = { ...state, stage: "submitted", attempts: state.attempts + 1 };
    setState(next);
    onSubmit({
      raw: aggregated.raw,
      max: aggregated.max,
      success: aggregated.success,
      suspendData: JSON.stringify(next),
    });
  };

  const tryAgain = () =>
    // Bump `attempts` instead of resetting to 0 so the body div's
    // `${index}-${attempts}` key changes — child activities (MC / FITB)
    // hold their own selection state, so remounting via key is the
    // only way to clear their previous answer.
    setState({ ...initial, attempts: state.attempts + 1 });

  if (validated.length === 0) {
    return (
      <div role="alert" className="kukui-qs__empty">
        Question set has no valid questions.
      </div>
    );
  }

  const ui = config.ui ?? {};
  const submitLabel = ui.submitSetButton ?? "Submit set";
  const tryAgainLabel = ui.tryAgainButton ?? "Try again";

  const allAnswered = answeredCount === total;
  const showProgressBar = config.behaviour?.showProgressBar ?? true;
  const showResults = config.behaviour?.showResults ?? false;
  const submitted = state.stage === "submitted";
  const current = ordered[state.current];

  return (
    <div className="kukui-qs">
      <article className="kukui-qs__card" aria-labelledby={headingId}>
        <ActivityHeader
          title={config.title}
          titleId={headingId}
          headingLevel={headingLevel}
          variant={config.appearance?.header ?? "full"}
        />

        {showProgressBar ? (
          <div className="kukui-qs__header">
            <p className="kukui-qs__progress" aria-live="polite">
              Question {state.current + 1} of {total}
            </p>
          </div>
        ) : null}

        {current ? (
          // key includes attempts so Try Again actually remounts the
          // child — otherwise the embedded activity keeps its prior
          // selection (its own useReducer state survives the parent's
          // state reset).
          <div className="kukui-qs__body" key={`${current.index}-${state.attempts}`}>
            {current.type === "multipleChoice" ? (
              <MultipleChoice
                config={current.config}
                onSubmit={(s) => recordScore(current.index, s)}
                headingLevel={2}
              />
            ) : (
              <FillInTheBlanks
                config={current.config}
                onSubmit={(s) => recordScore(current.index, s)}
                headingLevel={2}
              />
            )}
          </div>
        ) : null}

        <nav className="kukui-qs__nav" aria-label="Question set navigation">
          <button
            type="button"
            className="kukui-qs__secondary"
            onClick={goPrev}
            disabled={state.current === 0}
          >
            {ui.previousQuestionButton ?? "Previous"}
          </button>
          <button
            type="button"
            className="kukui-qs__secondary"
            onClick={goNext}
            disabled={state.current === total - 1}
          >
            {ui.nextQuestionButton ?? "Next"}
          </button>
          {submitted ? (
            scoring.enableRetry ? (
              <button type="button" className="kukui-qs__primary" onClick={tryAgain}>
                {tryAgainLabel}
              </button>
            ) : null
          ) : (
            <button
              type="button"
              className="kukui-qs__primary"
              disabled={!allAnswered}
              onClick={submitSet}
            >
              {submitLabel}
            </button>
          )}
        </nav>

        <p
          className={["kukui-qs__feedback", submitted ? "is-visible" : ""]
            .filter(Boolean)
            .join(" ")}
          role="status"
          aria-live="polite"
        >
          {submitted
            ? `Submitted. ${answeredCount} of ${total} questions answered.`
            : !allAnswered
              ? `Answered ${answeredCount} of ${total}.`
              : "All questions answered — press Submit set."}
        </p>

        {submitted && showResults ? (
          <section
            className="kukui-qs__results"
            aria-label="Per-question results"
          >
            <h2 className="kukui-qs__results-title">Per-question results</h2>
            <ul className="kukui-qs__results-list">
              {ordered.map((q, displayIdx) => {
                const sc = state.scores[q.index];
                const isCorrect = sc ? sc.raw === sc.max && sc.max > 0 : false;
                const qTitle =
                  q.config.title ?? `Question ${displayIdx + 1}`;
                return (
                  <li key={q.index} className="kukui-qs__results-item">
                    <span
                      className="kukui-qs__results-icon"
                      aria-hidden="true"
                    >
                      {isCorrect ? "✓" : "✗"}
                    </span>
                    <span className="kukui-qs__results-name">
                      {displayIdx + 1}. {qTitle}
                    </span>
                    <span className="kukui-qs__results-score">
                      {sc ? `${Math.round(sc.raw * 100) / 100} / ${sc.max}` : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </article>
    </div>
  );
}

function parseSuspend(s: string | undefined, questionCount: number): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (parsed && typeof parsed.current === "number") {
      return {
        stage: parsed.stage === "submitted" ? "submitted" : "answering",
        scores: typeof parsed.scores === "object" && parsed.scores ? parsed.scores : {},
        // Clamp to the valid question range — stale or hand-edited
        // suspend data must never point past the last question.
        current: Math.min(Math.max(0, Math.trunc(parsed.current)), Math.max(0, questionCount - 1)),
        attempts: typeof parsed.attempts === "number" ? parsed.attempts : 0,
      };
    }
  } catch {
    /* noop */
  }
  return null;
}
