import { useEffect, useId, useMemo, useState } from "react";
import { parseClozeText, type FillInTheBlanksConfig } from "@kukui/schemas";
import type { ActivityProps } from "../../types.js";
import "./FillInTheBlanks.css";

type Stage = "answering" | "submitted";

type State = {
  stage: Stage;
  values: string[];
  attempts: number;
};

type Segment =
  | { kind: "text"; text: string }
  | { kind: "blank"; accepts: string[] };

/**
 * Levenshtein distance with early-exit when distance exceeds `max`.
 * Tiny implementation tuned for short strings (single word answers).
 */
function levenshtein(a: string, b: string, max = 1): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;
  let prev = new Array<number>(lb + 1);
  let curr = new Array<number>(lb + 1);
  for (let j = 0; j <= lb; j += 1) prev[j] = j;
  for (let i = 1; i <= la; i += 1) {
    curr[0] = i;
    let rowMin = curr[0]!;
    for (let j = 1; j <= lb; j += 1) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
      if (curr[j]! < rowMin) rowMin = curr[j]!;
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[lb]!;
}

function isBlankCorrect(
  value: string,
  accepts: readonly string[],
  caseSensitive: boolean,
  acceptSpellingErrors: boolean,
): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  const lhs = caseSensitive ? trimmed : trimmed.toLocaleLowerCase();
  for (const a of accepts) {
    const rhs = caseSensitive ? a : a.toLocaleLowerCase();
    if (lhs === rhs) return true;
    if (acceptSpellingErrors && levenshtein(lhs, rhs, 1) <= 1) return true;
  }
  return false;
}

export function FillInTheBlanks({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<FillInTheBlanksConfig>) {
  const HeadingTag = `h${headingLevel}` as "h1" | "h2" | "h3";
  const segments = useMemo<Segment[]>(() => parseClozeText(config.text), [config.text]);
  const blanks = useMemo(
    () => segments.filter((s): s is Extract<Segment, { kind: "blank" }> => s.kind === "blank"),
    [segments],
  );

  const initialState = useMemo<State>(
    () => ({ stage: "answering", values: blanks.map(() => ""), attempts: 0 }),
    [blanks],
  );

  const [state, setState] = useState<State>(
    () => parseSuspend(suspendData, blanks.length) ?? initialState,
  );

  const headingId = useId();
  const baseInputId = useId();

  const caseSensitive = config.behaviour?.caseSensitive ?? false;
  const acceptSpellingErrors = config.behaviour?.acceptSpellingErrors ?? false;
  const singlePoint = config.behaviour?.singlePoint ?? false;
  const enableRetry = config.behaviour?.enableRetry ?? false;
  const showSolutionsButton = config.behaviour?.showSolutionsButton ?? false;

  const ui = config.ui ?? {};
  const checkLabel = ui.checkAnswerButton ?? "Check";
  const tryAgainLabel = ui.tryAgainButton ?? "Try again";
  const solutionLabel = ui.showSolutionButton ?? "Show solution";

  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  // Reset local state when `config` changes externally (Studio Preview edit,
  // AI Accept, draft load, etc.). Reference equality on the `config` prop —
  // engine context loads JSON once and never mutates the ref, so this only
  // fires in Studio Preview. Replaces the now-removed JSON.stringify(value)
  // remount key.
  useEffect(() => {
    setState(parseSuspend(suspendData, blanks.length) ?? initialState);
    setSolutionsRevealed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const setBlankValue = (idx: number, value: string) => {
    if (state.stage !== "answering") return;
    setState((s) => {
      const next = s.values.slice();
      next[idx] = value;
      return { ...s, values: next };
    });
  };

  const correctness = useMemo(
    () =>
      blanks.map((b, i) =>
        isBlankCorrect(state.values[i] ?? "", b.accepts, caseSensitive, acceptSpellingErrors),
      ),
    [blanks, state.values, caseSensitive, acceptSpellingErrors],
  );

  const allFilled = state.values.every((v) => v.trim().length > 0);

  const submit = () => {
    if (state.stage !== "answering") return;
    if (!allFilled) return;
    const correctCount = correctness.filter(Boolean).length;
    const max = singlePoint ? 1 : blanks.length;
    const allCorrect = correctCount === blanks.length;
    const raw = singlePoint ? (allCorrect ? 1 : 0) : correctCount;
    const success = allCorrect;
    const nextState: State = { ...state, stage: "submitted", attempts: state.attempts + 1 };
    setState(nextState);
    onSubmit({ raw, max, success, suspendData: JSON.stringify(nextState) });
  };

  const tryAgain = () => setState(initialState);

  const [solutionsRevealed, setSolutionsRevealed] = useState(false);
  const showSolutions = state.stage === "submitted" && solutionsRevealed;

  const submitted = state.stage === "submitted";
  const correctCount = correctness.filter(Boolean).length;

  let blankCounter = 0;

  return (
    <div className="kukui-fib">
      <article className="kukui-fib__card" aria-labelledby={headingId}>
        <HeadingTag id={headingId} className="kukui-fib__title">
          {config.title}
        </HeadingTag>
        <div className="kukui-fib__text" aria-live="polite">
          {segments.map((seg, i) => {
            if (seg.kind === "text") {
              return (
                <span key={`t-${i}`} className="kukui-fib__static">
                  {seg.text}
                </span>
              );
            }
            const blankIdx = blankCounter;
            blankCounter += 1;
            const value = state.values[blankIdx] ?? "";
            const isCorrect = submitted && correctness[blankIdx];
            const isWrong = submitted && !correctness[blankIdx];
            const reveal = showSolutions && !correctness[blankIdx];
            const displayValue = reveal ? (seg.accepts[0] ?? "") : value;
            const inputId = `${baseInputId}-${blankIdx}`;
            const widthCh = Math.max(
              8,
              ...seg.accepts.map((a) => Math.min(24, a.length + 2)),
            );

            const stateLabel = submitted
              ? isCorrect
                ? "correct"
                : reveal
                  ? "incorrect, correct answer shown"
                  : "incorrect"
              : "empty";

            return (
              <span key={`b-${i}`} className="kukui-fib__blank-wrap">
                <label className="kukui-fib__sr-only" htmlFor={inputId}>
                  {`Blank ${blankIdx + 1} of ${blanks.length}, ${stateLabel}`}
                </label>
                <input
                  id={inputId}
                  type="text"
                  className={[
                    "kukui-fib__input",
                    submitted && isCorrect ? "is-correct" : "",
                    submitted && isWrong ? "is-incorrect" : "",
                    reveal ? "is-reveal" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  value={displayValue}
                  onChange={(e) => setBlankValue(blankIdx, e.target.value)}
                  disabled={submitted}
                  readOnly={submitted}
                  aria-label={`Blank ${blankIdx + 1} of ${blanks.length}`}
                  aria-invalid={submitted && !correctness[blankIdx] ? true : undefined}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  style={{ width: `${widthCh}ch` }}
                />
                <span className="kukui-fib__icon" aria-hidden="true">
                  {submitted ? (isCorrect ? "✓" : "✗") : ""}
                </span>
              </span>
            );
          })}
        </div>

        <div
          className={["kukui-fib__feedback", submitted ? "is-visible" : ""]
            .filter(Boolean)
            .join(" ")}
          role="status"
          aria-live="polite"
        >
          {submitted
            ? singlePoint
              ? correctCount === blanks.length
                ? "All blanks correct."
                : "Some blanks are incorrect."
              : `${correctCount} of ${blanks.length} correct.`
            : ""}
        </div>

        <div className="kukui-fib__actions">
          {state.stage === "answering" ? (
            <button
              type="button"
              className="kukui-fib__primary"
              disabled={!allFilled}
              onClick={submit}
            >
              {checkLabel}
            </button>
          ) : (
            <>
              {enableRetry ? (
                <button type="button" className="kukui-fib__secondary" onClick={tryAgain}>
                  {tryAgainLabel}
                </button>
              ) : null}
              {showSolutionsButton && !solutionsRevealed ? (
                <button
                  type="button"
                  className="kukui-fib__secondary"
                  onClick={() => setSolutionsRevealed(true)}
                >
                  {solutionLabel}
                </button>
              ) : null}
            </>
          )}
        </div>
      </article>
    </div>
  );
}

function parseSuspend(s: string | undefined, blankCount: number): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (
      parsed &&
      Array.isArray(parsed.values) &&
      typeof parsed.attempts === "number" &&
      parsed.values.length === blankCount
    ) {
      return {
        stage: parsed.stage === "submitted" ? "submitted" : "answering",
        values: parsed.values.map((v) => (typeof v === "string" ? v : "")),
        attempts: parsed.attempts,
      };
    }
  } catch {
    /* noop */
  }
  return null;
}
