import { useEffect, useId, useMemo, useState } from "react";
import type { HighlightTextConfig } from "@kukui/schemas/highlight-text";
import type { ActivityProps } from "../../types.js";
import { bandMessage, percentage, resolveScoring, scoreSelection } from "../../scoring.js";
import { SafeHtml } from "../../safe-html.js";
import "./HighlightText.css";

type Stage = "answering" | "submitted";

type State = {
  stage: Stage;
  selected: string[];
  attempts: number;
};

const initialState: State = { stage: "answering", selected: [], attempts: 0 };

export function HighlightText({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<HighlightTextConfig>) {
  const HeadingTag = `h${headingLevel}` as "h1" | "h2" | "h3";
  const [state, setState] = useState<State>(() => parseSuspend(suspendData) ?? initialState);
  const headingId = useId();

  // Reset local state when `config` changes externally (Studio Preview edit,
  // AI Accept, draft load, etc.). Reference equality on the `config` prop —
  // engine context loads JSON once and never mutates the ref, so this only
  // fires in Studio Preview. Replaces the now-removed JSON.stringify(value)
  // remount key.
  useEffect(() => {
    setState(parseSuspend(suspendData) ?? initialState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const tokenIds = useMemo(() => config.tokens.map((t) => t.id), [config.tokens]);
  const idToIndex = useMemo(() => {
    const m = new Map<string, number>();
    tokenIds.forEach((id, i) => m.set(id, i));
    return m;
  }, [tokenIds]);
  const correctIndices = useMemo(
    () =>
      new Set(
        config.tokens.map((t, i) => (t.correct ? i : -1)).filter((i) => i >= 0),
      ),
    [config.tokens],
  );

  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  const toggle = (id: string) => {
    if (state.stage !== "answering") return;
    setState((s) => {
      const has = s.selected.includes(id);
      return {
        ...s,
        selected: has ? s.selected.filter((x) => x !== id) : [...s.selected, id],
      };
    });
  };

  const selectedIdxs = useMemo(
    () =>
      state.selected
        .map((id) => idToIndex.get(id))
        .filter((i): i is number => typeof i === "number"),
    [state.selected, idToIndex],
  );

  const scoring = useMemo(() => resolveScoring(config, { mode: "points" }), [config]);
  const isSinglePoint = scoring.mode === "all-or-nothing";

  const score = useMemo(
    () =>
      scoreSelection({
        selectedIndices: new Set(selectedIdxs),
        correctIndices,
        totalAnswers: config.tokens.length,
        singlePoint: isSinglePoint,
      }),
    [selectedIdxs, correctIndices, config.tokens.length, isSinglePoint],
  );

  const submit = () => {
    if (state.selected.length === 0) return;
    setState((s) => ({ ...s, stage: "submitted", attempts: s.attempts + 1 }));
    onSubmit({
      ...score,
      suspendData: JSON.stringify({ ...state, stage: "submitted" }),
    });
  };

  const tryAgain = () => setState(initialState);

  const ui = config.ui ?? {};
  const checkLabel = ui.checkAnswerButton ?? "Check";
  const tryAgainLabel = ui.tryAgainButton ?? "Try again";

  const submitted = state.stage === "submitted";
  const pct = submitted ? percentage(score) : 0;
  const banner = submitted ? bandMessage(scoring.bands, pct) : null;

  return (
    <div className="kukui-ht">
      <article className="kukui-ht__card" aria-labelledby={headingId}>
        <HeadingTag id={headingId} className="kukui-ht__title">
          {config.title}
        </HeadingTag>
        <SafeHtml className="kukui-ht__prompt" html={config.prompt} />
        <p
          className="kukui-ht__passage"
          role="group"
          aria-label="Highlightable passage"
        >
          {config.tokens.map((t, i) => {
            const selected = state.selected.includes(t.id);
            const correct = t.correct;
            const wrong = submitted && selected && !correct;
            const right = submitted && selected && correct;
            const reveal = submitted && !selected && correct;
            const stateLabel = right
              ? "highlighted, correct"
              : wrong
                ? "highlighted, incorrect"
                : reveal
                  ? "not highlighted, was correct"
                  : selected
                    ? "highlighted"
                    : "not highlighted";
            const sep = t.separator ?? (i < config.tokens.length - 1 ? " " : "");
            return (
              <span key={t.id} className="kukui-ht__slot">
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${t.text}, ${stateLabel}`}
                  disabled={submitted}
                  className={[
                    "kukui-ht__token",
                    selected ? "is-selected" : "",
                    right ? "is-correct" : "",
                    wrong ? "is-incorrect" : "",
                    reveal ? "is-reveal" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => toggle(t.id)}
                >
                  <span className="kukui-ht__token-text">{t.text}</span>
                  <span className="kukui-ht__token-icon" aria-hidden="true">
                    {right ? "✓" : wrong ? "✗" : reveal ? "○" : ""}
                  </span>
                </button>
                {sep ? <span className="kukui-ht__sep">{sep}</span> : null}
              </span>
            );
          })}
        </p>

        <div className="kukui-ht__feedback-row" aria-live="polite">
          {submitted ? (
            <p className="kukui-ht__feedback">
              {right(score) ? (
                <span className="kukui-ht__feedback-text is-success">
                  All correct tokens highlighted.
                </span>
              ) : (
                <span className="kukui-ht__feedback-text is-error">
                  Review the highlighted tokens — green outlines mark correct
                  selections, red outlines mark incorrect ones, and dashed
                  outlines reveal correct tokens you missed.
                </span>
              )}
            </p>
          ) : null}
        </div>

        <div className="kukui-ht__actions">
          {!submitted ? (
            <button
              type="button"
              className="kukui-ht__primary"
              disabled={state.selected.length === 0}
              onClick={submit}
            >
              {checkLabel}
            </button>
          ) : (
            <>
              <output className="kukui-ht__score">
                {score.raw} / {score.max}
                {banner ? <span className="kukui-ht__band"> — {banner}</span> : null}
              </output>
              {scoring.enableRetry ? (
                <button type="button" className="kukui-ht__secondary" onClick={tryAgain}>
                  {tryAgainLabel}
                </button>
              ) : null}
            </>
          )}
        </div>
      </article>
    </div>
  );
}

function right(score: { raw: number; max: number }): boolean {
  return score.max > 0 && score.raw === score.max;
}

function parseSuspend(s: string | undefined): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (parsed && Array.isArray(parsed.selected) && typeof parsed.attempts === "number") {
      return {
        stage: parsed.stage === "submitted" ? "submitted" : "answering",
        selected: parsed.selected.filter((x): x is string => typeof x === "string"),
        attempts: parsed.attempts,
      };
    }
  } catch {
    /* noop */
  }
  return null;
}
