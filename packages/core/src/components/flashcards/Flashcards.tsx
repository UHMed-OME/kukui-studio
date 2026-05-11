import { useEffect, useId, useMemo, useState } from "react";
import type { FlashcardsConfig } from "@kukui/schemas";
import type { ActivityProps } from "../../types.js";
import { SafeHtml, htmlToText } from "../../safe-html.js";
import "./Flashcards.css";

type CardStatus = "knew" | "didnt" | "unanswered";

type State = {
  /** FIFO queue of card ids still to answer (re-queued cards appear at the tail). */
  queue: string[];
  /** Per-card status — the final value wins; "didnt" rows are re-queued until "knew". */
  statuses: Record<string, CardStatus>;
  /** Per-card retry counter — caps re-queues at MAX_RETRIES. */
  retries: Record<string, number>;
  /** Whether the front (false) or back (true) of the current card is showing. */
  flipped: boolean;
  /** Stable seed used for deterministic shuffles across reloads. */
  seed: number;
  /** True once every card has been answered "knew it" or hit the retry cap. */
  completed: boolean;
};

const MAX_RETRIES = 2;

/**
 * Tiny seeded PRNG (mulberry32) — stable shuffle across reloads when paired
 * with a deterministic seed in suspendData.
 */
function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: readonly T[], seed: number): T[] {
  const out = arr.slice();
  const rand = rng(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

function buildInitialState(config: FlashcardsConfig, seed: number): State {
  const ids = config.cards.map((c) => c.id);
  const ordered = config.behaviour?.shuffle ? shuffle(ids, seed) : ids.slice();
  return {
    queue: ordered,
    statuses: Object.fromEntries(ids.map((id) => [id, "unanswered" as const])),
    retries: Object.fromEntries(ids.map((id) => [id, 0])),
    flipped: false,
    seed,
    completed: false,
  };
}

export function Flashcards({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<FlashcardsConfig>) {
  const HeadingTag = `h${headingLevel}` as "h1" | "h2" | "h3";
  const headingId = useId();
  const cardLiveId = useId();
  const progressLiveId = useId();

  const cardsById = useMemo(
    () => Object.fromEntries(config.cards.map((c) => [c.id, c])),
    [config.cards],
  );

  const initial = useMemo<State>(
    () => buildInitialState(config, Math.floor(Math.random() * 0x7fffffff)),
    [config],
  );

  const [state, setState] = useState<State>(
    () => parseSuspend(suspendData, config) ?? initial,
  );

  // Reset local state when `config` changes externally (Studio Preview edit,
  // AI Accept, draft load, etc.). Reference equality on the `config` prop —
  // engine context loads JSON once and never mutates the ref, so this only
  // fires in Studio Preview. Replaces the now-removed JSON.stringify(value)
  // remount key.
  useEffect(() => {
    setState(parseSuspend(suspendData, config) ?? initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Persist on every meaningful state change (flip / answer / completion).
  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  const totalCount = config.cards.length;
  const knewCount = useMemo(
    () => Object.values(state.statuses).filter((s) => s === "knew").length,
    [state.statuses],
  );

  // Position metadata — Card N of M counts each unique card the learner has
  // touched, not the per-flip queue size, so the indicator never goes
  // backwards when a "didn't know" card returns at the tail.
  const seenIds = useMemo(() => {
    const seen = new Set<string>();
    for (const id of config.cards.map((c) => c.id)) {
      if (state.statuses[id] !== "unanswered") seen.add(id);
    }
    return seen;
  }, [state.statuses, config.cards]);

  const currentId = state.queue[0];
  const currentCard = currentId ? cardsById[currentId] : undefined;

  const cardNumber = currentId
    ? seenIds.has(currentId)
      ? seenIds.size
      : seenIds.size + 1
    : totalCount;

  const ui = config.ui ?? {};
  const knewLabel = ui.knewItButton ?? "I knew it";
  const didntLabel = ui.didntKnowButton ?? "I didn't know it";
  const nextLabel = ui.nextButton ?? "Next card";

  const flip = () => {
    if (state.completed || !currentId) return;
    setState((s) => ({ ...s, flipped: !s.flipped }));
  };

  /** Common bookkeeping for a self-rated answer ("knew" or "didnt"). */
  const answer = (status: "knew" | "didnt") => {
    if (state.completed || !currentId) return;
    setState((prev) => {
      const id = currentId;
      const nextStatuses: Record<string, CardStatus> = { ...prev.statuses, [id]: status };
      const nextRetries = { ...prev.retries };
      const tail = prev.queue.slice(1);
      // Re-queue "didnt" cards unless they've hit the retry cap.
      const retryCount = nextRetries[id] ?? 0;
      const shouldRequeue = status === "didnt" && retryCount < MAX_RETRIES;
      if (shouldRequeue) nextRetries[id] = retryCount + 1;
      const nextQueue = shouldRequeue ? [...tail, id] : tail;
      const completed = nextQueue.length === 0;

      const nextState: State = {
        ...prev,
        statuses: nextStatuses,
        retries: nextRetries,
        queue: nextQueue,
        flipped: false,
        completed,
      };

      if (completed) {
        // Flashcards are completion-only — self-rating is honor-system, so
        // working through the deck once is what the gradebook records. The
        // knew/didn't tally is shown to the learner but not used for scoring.
        onSubmit({
          raw: 1,
          max: 1,
          success: true,
          suspendData: JSON.stringify(nextState),
        });
      }

      return nextState;
    });
  };

  // Reduced-motion: detected at render so we can skip the flip animation
  // (we only show one face at a time when reduced-motion is active).
  const prefersReducedMotion =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const onCardKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (state.completed || !currentId) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      flip();
    }
  };

  const submitted = state.completed;
  const knewPct = totalCount === 0 ? 0 : Math.round((knewCount / totalCount) * 100);

  const practiceAgain = () => {
    // Reseed so a shuffled deck comes out in a different order each round.
    setState(buildInitialState(config, Math.floor(Math.random() * 0x7fffffff)));
  };

  return (
    <div className="kukui-fc">
      <article className="kukui-fc__card-frame" aria-labelledby={headingId}>
        <HeadingTag id={headingId} className="kukui-fc__title">
          {config.title}
        </HeadingTag>
        {config.prompt ? (
          <SafeHtml className="kukui-fc__prompt" html={config.prompt} />
        ) : null}

        <div
          id={progressLiveId}
          className="kukui-fc__progress"
          role="status"
          aria-live="polite"
        >
          {submitted ? (
            <span>
              Finished — knew {knewCount} of {totalCount} ({knewPct}%).
            </span>
          ) : (
            <>
              <span className="kukui-fc__progress-line">
                Card {Math.min(cardNumber, totalCount)} of {totalCount}
              </span>
              <span className="kukui-fc__progress-line kukui-fc__progress-line--meta">
                {knewCount}/{totalCount} mastered
              </span>
              <progress
                className="kukui-fc__meter"
                value={seenIds.size}
                max={totalCount}
                aria-label={`${seenIds.size} of ${totalCount} cards attempted`}
              />
            </>
          )}
        </div>

        {!submitted && currentCard ? (
          <div
            className={[
              "kukui-fc__card",
              state.flipped ? "is-flipped" : "",
              prefersReducedMotion ? "is-reduced-motion" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role="button"
            tabIndex={0}
            aria-pressed={state.flipped}
            aria-label={`Flashcard ${Math.min(cardNumber, totalCount)} of ${totalCount}, ${
              state.flipped ? "back side" : "front side"
            }. Click or press Space to flip.`}
            onClick={flip}
            onKeyDown={onCardKey}
          >
            <div className="kukui-fc__face kukui-fc__face--front" aria-hidden={state.flipped}>
              <span className="kukui-fc__face-label">Front</span>
              <SafeHtml className="kukui-fc__face-body" html={currentCard.front} />
              {currentCard.hint ? (
                <p className="kukui-fc__hint">
                  <span className="kukui-fc__hint-label">Hint:</span>{" "}
                  {htmlToText(currentCard.hint)}
                </p>
              ) : null}
              <span className="kukui-fc__flip-cue">Click or press Space to flip</span>
            </div>
            <div
              className="kukui-fc__face kukui-fc__face--back"
              aria-hidden={!state.flipped}
              id={cardLiveId}
            >
              <span className="kukui-fc__face-label">Back</span>
              <SafeHtml className="kukui-fc__face-body" html={currentCard.back} />
              <span className="kukui-fc__flip-cue">Click to flip back</span>
            </div>
          </div>
        ) : null}

        {!submitted && currentCard ? (
          <div className="kukui-fc__actions">
            {state.flipped ? (
              <>
                <button
                  type="button"
                  className="kukui-fc__answer kukui-fc__answer--knew"
                  aria-label={`${knewLabel} — mark this card as known and move on`}
                  onClick={() => answer("knew")}
                >
                  <span className="kukui-fc__answer-icon" aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="kukui-fc__answer-text">{knewLabel}</span>
                </button>
                <button
                  type="button"
                  className="kukui-fc__answer kukui-fc__answer--didnt"
                  aria-label={`${didntLabel} — review this card again later`}
                  onClick={() => answer("didnt")}
                >
                  <span className="kukui-fc__answer-icon" aria-hidden="true">
                    {"↺"}
                  </span>
                  <span className="kukui-fc__answer-text">{didntLabel}</span>
                </button>
              </>
            ) : (
              <button type="button" className="kukui-fc__primary" onClick={flip}>
                {nextLabel === "Next card" ? "Reveal answer" : nextLabel}
              </button>
            )}
          </div>
        ) : null}

        {submitted ? (
          <div className="kukui-fc__summary is-success" role="status">
            <p className="kukui-fc__summary-headline">
              Run-through complete — you knew {knewCount} of {totalCount} (
              {knewPct}%). Submitted for credit.
            </p>
            <p className="kukui-fc__summary-sub">
              Practice as many times as you like — your grade stays at 100%.
            </p>
            <button
              type="button"
              className="kukui-fc__primary"
              onClick={practiceAgain}
            >
              Practice again
            </button>
          </div>
        ) : null}
      </article>
    </div>
  );
}

function parseSuspend(s: string | undefined, config: FlashcardsConfig): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.queue) ||
      !parsed.statuses ||
      typeof parsed.seed !== "number"
    ) {
      return null;
    }
    const validIds = new Set(config.cards.map((c) => c.id));
    const queue = parsed.queue.filter(
      (id): id is string => typeof id === "string" && validIds.has(id),
    );
    const statuses: Record<string, CardStatus> = {};
    const retries: Record<string, number> = {};
    for (const card of config.cards) {
      const raw = (parsed.statuses as Record<string, unknown>)[card.id];
      statuses[card.id] =
        raw === "knew" || raw === "didnt" ? raw : "unanswered";
      const r = (parsed.retries as Record<string, unknown> | undefined)?.[card.id];
      retries[card.id] = typeof r === "number" && r >= 0 ? r : 0;
    }
    return {
      queue,
      statuses,
      retries,
      flipped: parsed.flipped === true,
      seed: parsed.seed,
      completed: parsed.completed === true && queue.length === 0,
    };
  } catch {
    return null;
  }
}
