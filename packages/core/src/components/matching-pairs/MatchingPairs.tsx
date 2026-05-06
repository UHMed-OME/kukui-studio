import { useEffect, useId, useMemo, useState } from "react";
import type { MatchingPairsConfig } from "@kukui/schemas/matching-pairs";
import type { ActivityProps } from "../../types.js";
import { SafeHtml } from "../../safe-html.js";
import "./MatchingPairs.css";

type Stage = "answering" | "submitted";

/**
 * Connection map: leftId → rightId | null. A right item can only be paired
 * with one left at a time; selecting a left, then clicking a right that's
 * already paired with someone else, swaps the connection.
 */
type Connections = Record<string, string | null>;

type State = {
  stage: Stage;
  /** leftId → rightId | null */
  connections: Connections;
  /** Order the right column is rendered in. Stable across a session — only
   *  re-shuffled on Try Again so retries don't memorize position. */
  rightOrder: string[];
  attempts: number;
};

/**
 * Deterministic-ish shuffle. We don't need cryptographic randomness — just
 * enough to break the natural left-right alignment so learners actually have
 * to think about the match. `Math.random` is fine here.
 */
function shuffle<T>(items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function buildInitial(config: MatchingPairsConfig): State {
  const ids = config.pairs.map((p) => p.id);
  const randomize = config.behaviour?.randomizeRight ?? true;
  return {
    stage: "answering",
    connections: Object.fromEntries(ids.map((id) => [id, null])),
    rightOrder: randomize ? shuffle(ids) : [...ids],
    attempts: 0,
  };
}

export function MatchingPairs({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<MatchingPairsConfig>) {
  const HeadingTag = `h${headingLevel}` as "h1" | "h2" | "h3";
  const headingId = useId();
  const promptId = useId();

  const initial = useMemo(() => buildInitial(config), [config]);
  const [state, setState] = useState<State>(
    () => parseSuspend(suspendData, config) ?? initial,
  );
  /** Currently selected left-row id (for click-to-pair). */
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);

  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  const submitted = state.stage === "submitted";

  /**
   * Map from rightId → leftId currently paired with it (inverse of
   * connections). Computed each render — `pairs` count is small.
   */
  const leftByRight = useMemo<Record<string, string | undefined>>(() => {
    const map: Record<string, string> = {};
    for (const [leftId, rightId] of Object.entries(state.connections)) {
      if (rightId) map[rightId] = leftId;
    }
    return map;
  }, [state.connections]);

  /** 1-based pair-marker numbers, keyed by leftId. */
  const pairNumbers = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    let n = 1;
    for (const p of config.pairs) {
      if (state.connections[p.id]) {
        map[p.id] = n;
        n += 1;
      }
    }
    return map;
  }, [config.pairs, state.connections]);

  const onLeftClick = (leftId: string) => {
    if (submitted) return;
    setSelectedLeft((cur) => (cur === leftId ? null : leftId));
  };

  const onRightClick = (rightId: string) => {
    if (submitted) return;
    if (!selectedLeft) return; // No-op until learner picks a left first.
    setState((s) => {
      const next: Connections = { ...s.connections };
      // If this rightId was already paired with someone, clear that one.
      const previousLeft = leftByRight[rightId];
      if (previousLeft && previousLeft !== selectedLeft) {
        next[previousLeft] = null;
      }
      next[selectedLeft] = rightId;
      return { ...s, connections: next };
    });
    setSelectedLeft(null);
  };

  const onClearLeft = (leftId: string) => {
    if (submitted) return;
    setState((s) => ({ ...s, connections: { ...s.connections, [leftId]: null } }));
    if (selectedLeft === leftId) setSelectedLeft(null);
  };

  /** Keyboard fallback select: pick a right id (or none) for a given left. */
  const onSelectRightFor = (leftId: string, rightId: string | null) => {
    if (submitted) return;
    setState((s) => {
      const next: Connections = { ...s.connections };
      if (rightId) {
        const previousLeft = leftByRight[rightId];
        if (previousLeft && previousLeft !== leftId) next[previousLeft] = null;
      }
      next[leftId] = rightId;
      return { ...s, connections: next };
    });
  };

  const allConnected = useMemo(
    () => Object.values(state.connections).every((v) => v !== null),
    [state.connections],
  );

  const correctCount = useMemo(
    () =>
      Object.entries(state.connections).filter(([leftId, rightId]) => leftId === rightId)
        .length,
    [state.connections],
  );

  const submit = () => {
    if (submitted || !allConnected) return;
    const total = config.pairs.length;
    const singlePoint = config.behaviour?.singlePoint ?? false;
    const allRight = correctCount === total;
    const raw = singlePoint ? (allRight ? 1 : 0) : correctCount;
    const max = singlePoint ? 1 : total;
    const next: State = { ...state, stage: "submitted", attempts: state.attempts + 1 };
    setState(next);
    setSelectedLeft(null);
    onSubmit({ raw, max, success: allRight, suspendData: JSON.stringify(next) });
  };

  const tryAgain = () => {
    setState(buildInitial(config));
    setSelectedLeft(null);
  };

  const ui = config.ui ?? {};
  const checkLabel = ui.checkAnswerButton ?? "Check";
  const tryAgainLabel = ui.tryAgainButton ?? "Try again";

  const pairsById = useMemo(
    () => Object.fromEntries(config.pairs.map((p) => [p.id, p])),
    [config.pairs],
  );

  return (
    <div className="kukui-mp">
      <article className="kukui-mp__card" aria-labelledby={headingId} aria-describedby={promptId}>
        <HeadingTag id={headingId} className="kukui-mp__title">
          {config.title}
        </HeadingTag>
        <SafeHtml className="kukui-mp__prompt" html={config.prompt} as="div" />
        <p
          id={promptId}
          className="kukui-mp__instructions"
          role={submitted ? undefined : "status"}
          aria-live="polite"
        >
          {submitted
            ? `${correctCount} of ${config.pairs.length} matched correctly.`
            : selectedLeft
              ? "Now click an item on the right to pair it."
              : "Click an item on the left, then click its match on the right."}
        </p>

        <div className="kukui-mp__columns" role="presentation">
          <ul className="kukui-mp__col" aria-label="Left column items">
            {config.pairs.map((p) => {
              const rightId = state.connections[p.id] ?? null;
              const isSelected = selectedLeft === p.id;
              const isPaired = rightId !== null;
              const correct = submitted && rightId === p.id;
              const wrong = submitted && isPaired && rightId !== p.id;
              const stateLabel = correct
                ? "correct"
                : wrong
                  ? `incorrect, correct match is ${pairsById[p.id]?.right.text ?? ""}`
                  : isSelected
                    ? "selected, awaiting right-side pick"
                    : isPaired
                      ? `paired (${pairNumbers[p.id]})`
                      : "not paired";
              return (
                <li key={p.id} className="kukui-mp__row">
                  <button
                    type="button"
                    className={[
                      "kukui-mp__item",
                      "kukui-mp__item--left",
                      isSelected ? "is-selected" : "",
                      isPaired && !submitted ? "is-paired" : "",
                      correct ? "is-correct" : "",
                      wrong ? "is-incorrect" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={isSelected}
                    aria-label={`${p.left.text}, ${stateLabel}`}
                    disabled={submitted}
                    onClick={() => onLeftClick(p.id)}
                  >
                    <span className="kukui-mp__badge" aria-hidden="true">
                      {isPaired ? pairNumbers[p.id] : ""}
                    </span>
                    <span className="kukui-mp__item-text">{p.left.text}</span>
                    <span className="kukui-mp__item-icon" aria-hidden="true">
                      {correct ? "✓" : wrong ? "✗" : ""}
                    </span>
                  </button>
                  {!submitted && isPaired ? (
                    <button
                      type="button"
                      className="kukui-mp__clear"
                      onClick={() => onClearLeft(p.id)}
                      aria-label={`Clear pairing for ${p.left.text}`}
                    >
                      Clear
                    </button>
                  ) : null}
                  {wrong ? (
                    <p className="kukui-mp__reveal" aria-live="polite">
                      Correct match: <strong>{pairsById[p.id]?.right.text}</strong>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <ul className="kukui-mp__col" aria-label="Right column items">
            {state.rightOrder.map((rightId) => {
              const p = pairsById[rightId];
              if (!p) return null;
              const pairedLeftId = leftByRight[rightId];
              const isPaired = pairedLeftId !== undefined;
              const correct = submitted && pairedLeftId === rightId;
              const wrong = submitted && isPaired && pairedLeftId !== rightId;
              const isHighlightTarget = !submitted && selectedLeft !== null;
              const number = pairedLeftId ? pairNumbers[pairedLeftId] : undefined;
              const stateLabel = correct
                ? "correct match"
                : wrong
                  ? "incorrect match"
                  : isPaired
                    ? `paired (${number})`
                    : "not paired";
              return (
                <li key={rightId} className="kukui-mp__row">
                  <button
                    type="button"
                    className={[
                      "kukui-mp__item",
                      "kukui-mp__item--right",
                      isHighlightTarget ? "is-target" : "",
                      isPaired && !submitted ? "is-paired" : "",
                      correct ? "is-correct" : "",
                      wrong ? "is-incorrect" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-label={`${p.right.text}, ${stateLabel}`}
                    disabled={submitted}
                    onClick={() => onRightClick(rightId)}
                  >
                    <span className="kukui-mp__badge" aria-hidden="true">
                      {number ?? ""}
                    </span>
                    <span className="kukui-mp__item-text">{p.right.text}</span>
                    <span className="kukui-mp__item-icon" aria-hidden="true">
                      {correct ? "✓" : wrong ? "✗" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <FallbackList
          pairs={config.pairs}
          rightOrder={state.rightOrder}
          connections={state.connections}
          submitted={submitted}
          onSelect={onSelectRightFor}
        />

        <div className="kukui-mp__actions">
          {submitted ? (
            <>
              <output className="kukui-mp__score">
                {correctCount} / {config.pairs.length}
              </output>
              {config.behaviour?.enableRetry ? (
                <button type="button" className="kukui-mp__secondary" onClick={tryAgain}>
                  {tryAgainLabel}
                </button>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              className="kukui-mp__primary"
              disabled={!allConnected}
              onClick={submit}
            >
              {checkLabel}
            </button>
          )}
        </div>
      </article>
    </div>
  );
}

function FallbackList({
  pairs,
  rightOrder,
  connections,
  submitted,
  onSelect,
}: {
  pairs: MatchingPairsConfig["pairs"];
  rightOrder: string[];
  connections: Connections;
  submitted: boolean;
  onSelect: (leftId: string, rightId: string | null) => void;
}) {
  const pairsById = Object.fromEntries(pairs.map((p) => [p.id, p]));
  return (
    <fieldset className="kukui-mp__fallback" disabled={submitted}>
      <legend className="kukui-mp__fallback-legend">
        Keyboard pairing (alternative to click-to-pair)
      </legend>
      <ul className="kukui-mp__fallback-list">
        {pairs.map((p) => (
          <li key={p.id} className="kukui-mp__fallback-row">
            <label htmlFor={`mp-fb-${p.id}`} className="kukui-mp__fallback-label">
              {p.left.text}
            </label>
            <select
              id={`mp-fb-${p.id}`}
              className="kukui-mp__fallback-select"
              value={connections[p.id] ?? ""}
              onChange={(e) => onSelect(p.id, e.target.value || null)}
              disabled={submitted}
            >
              <option value="">— choose a match —</option>
              {rightOrder.map((rightId) => {
                const target = pairsById[rightId];
                if (!target) return null;
                return (
                  <option key={rightId} value={rightId}>
                    {target.right.text}
                  </option>
                );
              })}
            </select>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function parseSuspend(s: string | undefined, config: MatchingPairsConfig): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (
      !parsed ||
      typeof parsed.connections !== "object" ||
      parsed.connections === null ||
      typeof parsed.attempts !== "number"
    ) {
      return null;
    }
    const validIds = new Set(config.pairs.map((p) => p.id));
    const connections: Connections = {};
    for (const p of config.pairs) {
      const v = (parsed.connections as Connections)[p.id];
      connections[p.id] = typeof v === "string" && validIds.has(v) ? v : null;
    }
    const rightOrderRaw = Array.isArray(parsed.rightOrder)
      ? parsed.rightOrder.filter(
          (id): id is string => typeof id === "string" && validIds.has(id),
        )
      : [];
    // If the persisted right-order is missing items (config drift), rebuild.
    const rightOrder =
      rightOrderRaw.length === config.pairs.length
        ? rightOrderRaw
        : config.pairs.map((p) => p.id);
    return {
      stage: parsed.stage === "submitted" ? "submitted" : "answering",
      connections,
      rightOrder,
      attempts: parsed.attempts,
    };
  } catch {
    return null;
  }
}
