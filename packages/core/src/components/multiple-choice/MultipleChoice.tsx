import { useEffect, useId, useMemo, useState } from "react";
import type { MultipleChoiceConfig } from "@kukui/schemas";
import type { ActivityProps } from "../../types.js";
import { bandMessage, percentage, scoreSelection } from "../../scoring.js";
import { SafeHtml, htmlToText } from "../../safe-html.js";
import "./MultipleChoice.css";

type Stage = "answering" | "submitted";

type State = {
  stage: Stage;
  selected: number[];
  attempts: number;
};

const initialState: State = { stage: "answering", selected: [], attempts: 0 };

export function MultipleChoice({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<MultipleChoiceConfig>) {
  const HeadingTag = `h${headingLevel}` as "h1" | "h2" | "h3";
  const [state, setState] = useState<State>(() => parseSuspend(suspendData) ?? initialState);
  const headingId = useId();

  const correctIndices = useMemo(
    () => new Set(config.answers.map((a, i) => (a.correct ? i : -1)).filter((i) => i >= 0)),
    [config.answers],
  );
  const isMulti = correctIndices.size > 1;

  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  const toggle = (idx: number) => {
    if (state.stage !== "answering") return;
    setState((s) => {
      const has = s.selected.includes(idx);
      if (isMulti) {
        return { ...s, selected: has ? s.selected.filter((i) => i !== idx) : [...s.selected, idx] };
      }
      return { ...s, selected: has ? [] : [idx] };
    });
  };

  const submit = () => {
    if (state.selected.length === 0) return;
    const score = scoreSelection({
      selectedIndices: new Set(state.selected),
      correctIndices,
      totalAnswers: config.answers.length,
      singlePoint: config.behaviour?.singlePoint,
    });
    setState((s) => ({ ...s, stage: "submitted", attempts: s.attempts + 1 }));
    onSubmit({ ...score, suspendData: JSON.stringify({ ...state, stage: "submitted" }) });
  };

  const tryAgain = () => setState(initialState);

  const showSolutions =
    state.stage === "submitted" && config.behaviour?.enableSolutionsButton;

  const ui = config.ui ?? {};
  const checkLabel = ui.checkAnswerButton ?? "Check";
  const solutionLabel = ui.showSolutionButton ?? "Show solution";
  const tryAgainLabel = ui.tryAgainButton ?? "Try again";

  const score = useMemo(
    () =>
      scoreSelection({
        selectedIndices: new Set(state.selected),
        correctIndices,
        totalAnswers: config.answers.length,
        singlePoint: config.behaviour?.singlePoint,
      }),
    [state.selected, correctIndices, config.answers.length, config.behaviour?.singlePoint],
  );

  const pct = state.stage === "submitted" ? percentage(score) : 0;
  const banner =
    state.stage === "submitted" ? bandMessage(config.overallFeedback, pct) : null;

  return (
    <div className="kukui-mc">
      <article className="kukui-mc__card" aria-labelledby={headingId}>
        <HeadingTag id={headingId} className="kukui-mc__title">
          {config.title}
        </HeadingTag>
        <SafeHtml className="kukui-mc__question" html={config.question} />
        {/* Drop the radiogroup ARIA role — implementing it correctly requires
            roving tabindex + arrow-key navigation, which we don't yet do.
            A plain group with aria-pressed buttons gives accurate semantics. */}
        <ul role="group" aria-label="Answer choices" className="kukui-mc__answers">
          {config.answers.map((a, i) => {
            const selected = state.selected.includes(i);
            const submitted = state.stage === "submitted";
            const correct = a.correct;
            const wrong = submitted && selected && !correct;
            const right = submitted && selected && correct;
            const reveal = submitted && showSolutions && !selected && correct;
            const stateLabel = right
              ? "correct"
              : wrong
                ? "incorrect"
                : reveal
                  ? "correct, not selected"
                  : selected
                    ? "selected"
                    : "not selected";

            return (
              <li key={i} className="kukui-mc__answer-row">
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${htmlToText(a.text)}, ${stateLabel}`}
                  disabled={submitted}
                  className={[
                    "kukui-mc__answer",
                    selected ? "is-selected" : "",
                    right ? "is-correct" : "",
                    wrong ? "is-incorrect" : "",
                    reveal ? "is-reveal" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => toggle(i)}
                >
                  <SafeHtml as="span" className="kukui-mc__answer-text" html={a.text} />
                  <span className="kukui-mc__answer-icon" aria-hidden="true">
                    {right ? "✓" : wrong ? "✗" : reveal ? "○" : ""}
                  </span>
                </button>
                <div
                  className={[
                    "kukui-mc__feedback",
                    submitted && selected ? "is-visible" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-live="polite"
                >
                  {submitted && selected && a.feedback ? a.feedback : ""}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="kukui-mc__actions">
          {state.stage === "answering" ? (
            <button
              type="button"
              className="kukui-mc__primary"
              disabled={state.selected.length === 0}
              onClick={submit}
            >
              {checkLabel}
            </button>
          ) : (
            <>
              <output className="kukui-mc__score">
                {score.raw} / {score.max}
                {banner ? <span className="kukui-mc__band"> — {banner}</span> : null}
              </output>
              {config.behaviour?.enableRetry ? (
                <button type="button" className="kukui-mc__secondary" onClick={tryAgain}>
                  {tryAgainLabel}
                </button>
              ) : null}
              {showSolutions && state.attempts > 0 ? (
                <span className="kukui-mc__hint">
                  {solutionLabel} active — correct answers shown above.
                </span>
              ) : null}
            </>
          )}
        </div>
      </article>
    </div>
  );
}

function parseSuspend(s: string | undefined): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (parsed && Array.isArray(parsed.selected) && typeof parsed.attempts === "number") {
      return {
        stage: parsed.stage === "submitted" ? "submitted" : "answering",
        selected: parsed.selected.filter((n): n is number => typeof n === "number"),
        attempts: parsed.attempts,
      };
    }
  } catch {
    /* noop */
  }
  return null;
}
