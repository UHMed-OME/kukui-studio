import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SequenceStepsConfig } from "@kukui/schemas";
import type { ActivityProps } from "../../types.js";
import { SafeHtml } from "../../safe-html.js";
import "./SequenceSteps.css";

type Stage = "answering" | "submitted";

type State = {
  stage: Stage;
  /** Learner's current ordering — array of step ids. */
  order: string[];
  attempts: number;
};

/**
 * Tiny seeded PRNG (mulberry32) — stable shuffle when we have a seed
 * (e.g. on resume from suspendData). Without a seed we use Math.random.
 */
function rng(seed?: number): () => number {
  if (seed === undefined) return Math.random;
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: readonly T[], seed?: number): T[] {
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

/** Refuse a degenerate "shuffle" that returned the correct order. */
function shuffleDistinct(ids: readonly string[]): string[] {
  if (ids.length < 2) return ids.slice();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = shuffle(ids);
    if (candidate.some((id, i) => id !== ids[i])) return candidate;
  }
  // Fall back to a single swap.
  const out = ids.slice();
  const tmp = out[0] as string;
  out[0] = out[1] as string;
  out[1] = tmp;
  return out;
}

function buildInitialOrder(config: SequenceStepsConfig): string[] {
  const ids = config.steps.map((s) => s.id);
  const randomize = config.behaviour?.randomize ?? true;
  return randomize ? shuffleDistinct(ids) : ids.slice();
}

export function SequenceSteps({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<SequenceStepsConfig>) {
  const HeadingTag = `h${headingLevel}` as "h1" | "h2" | "h3";
  const headingId = useId();
  const liveId = useId();

  const correctOrder = useMemo(() => config.steps.map((s) => s.id), [config.steps]);
  const stepsById = useMemo(
    () => Object.fromEntries(config.steps.map((s) => [s.id, s])),
    [config.steps],
  );

  const initial = useMemo<State>(
    () => ({ stage: "answering", order: buildInitialOrder(config), attempts: 0 }),
    [config],
  );

  const [state, setState] = useState<State>(
    () => parseSuspend(suspendData, correctOrder) ?? initial,
  );

  // Reset local state when `config` changes externally (Studio Preview edit,
  // AI Accept, draft load, etc.). Reference equality on the `config` prop —
  // engine context loads JSON once and never mutates the ref, so this only
  // fires in Studio Preview. Replaces the now-removed JSON.stringify(value)
  // remount key.
  useEffect(() => {
    setState(parseSuspend(suspendData, correctOrder) ?? initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  const moveTo = (id: string, targetIndex: number) => {
    if (state.stage !== "answering") return;
    const from = state.order.indexOf(id);
    if (from < 0) return;
    const clamped = Math.max(0, Math.min(state.order.length - 1, targetIndex));
    if (clamped === from) return;
    setState((s) => ({ ...s, order: arrayMove(s.order, from, clamped) }));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    if (state.stage !== "answering") return;
    const activeId = String(e.active.id);
    if (!e.over) return;
    const overId = String(e.over.id);
    if (activeId === overId) return;
    setState((s) => {
      const from = s.order.indexOf(activeId);
      const to = s.order.indexOf(overId);
      if (from < 0 || to < 0) return s;
      return { ...s, order: arrayMove(s.order, from, to) };
    });
  };

  const correctCount = useMemo(
    () => state.order.filter((id, i) => id === correctOrder[i]).length,
    [state.order, correctOrder],
  );
  const allCorrect = correctCount === correctOrder.length;

  const submit = () => {
    if (state.stage !== "answering") return;
    const total = correctOrder.length;
    const singlePoint = config.behaviour?.singlePoint ?? false;
    const max = singlePoint ? 1 : total;
    const raw = singlePoint ? (allCorrect ? 1 : 0) : correctCount;
    const next: State = { ...state, stage: "submitted", attempts: state.attempts + 1 };
    setState(next);
    onSubmit({ raw, max, success: allCorrect, suspendData: JSON.stringify(next) });
  };

  const tryAgain = () => {
    setState({
      stage: "answering",
      order: shuffleDistinct(correctOrder),
      attempts: state.attempts,
    });
  };

  const ui = config.ui ?? {};
  const checkLabel = ui.checkAnswerButton ?? "Check";
  const tryAgainLabel = ui.tryAgainButton ?? "Try again";

  const submitted = state.stage === "submitted";

  return (
    <div className="kukui-seq">
      <article className="kukui-seq__card" aria-labelledby={headingId}>
        <HeadingTag id={headingId} className="kukui-seq__title">
          {config.title}
        </HeadingTag>
        <SafeHtml className="kukui-seq__prompt" html={config.prompt} />

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={state.order} strategy={verticalListSortingStrategy}>
            <ol className="kukui-seq__list" aria-describedby={liveId}>
              {state.order.map((id, index) => {
                const step = stepsById[id];
                if (!step) return null;
                const correctIndex = correctOrder.indexOf(id);
                const isInRightSpot = submitted && correctIndex === index;
                const isWrong = submitted && correctIndex !== index;
                return (
                  <SortableStep
                    key={id}
                    id={id}
                    index={index}
                    text={step.text}
                    total={state.order.length}
                    submitted={submitted}
                    isCorrect={isInRightSpot}
                    isIncorrect={isWrong}
                    correctPosition={correctIndex + 1}
                    onMove={moveTo}
                  />
                );
              })}
            </ol>
          </SortableContext>
        </DndContext>

        {/* Inline-below feedback (pattern A — constant min-height, opacity fade). */}
        <div
          id={liveId}
          className={["kukui-seq__feedback", submitted ? "is-visible" : ""]
            .filter(Boolean)
            .join(" ")}
          role="status"
          aria-live="polite"
        >
          {submitted
            ? allCorrect
              ? `All ${correctOrder.length} steps in the correct order.`
              : `${correctCount} of ${correctOrder.length} steps in the correct position.`
            : ""}
        </div>

        <div className="kukui-seq__actions">
          {submitted ? (
            config.behaviour?.enableRetry ? (
              <button type="button" className="kukui-seq__secondary" onClick={tryAgain}>
                {tryAgainLabel}
              </button>
            ) : null
          ) : (
            <button type="button" className="kukui-seq__primary" onClick={submit}>
              {checkLabel}
            </button>
          )}
        </div>
      </article>
    </div>
  );
}

function SortableStep({
  id,
  index,
  text,
  total,
  submitted,
  isCorrect,
  isIncorrect,
  correctPosition,
  onMove,
}: {
  id: string;
  index: number;
  text: string;
  total: number;
  submitted: boolean;
  isCorrect: boolean;
  isIncorrect: boolean;
  correctPosition: number;
  onMove: (id: string, target: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: submitted,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const stateLabel = submitted
    ? isCorrect
      ? "correct position"
      : `incorrect — correct position is ${correctPosition} of ${total}`
    : `position ${index + 1} of ${total}, draggable`;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={[
        "kukui-seq__item",
        isDragging ? "is-dragging" : "",
        submitted && isCorrect ? "is-correct" : "",
        submitted && isIncorrect ? "is-incorrect" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="kukui-seq__index" aria-hidden="true">
        {index + 1}
      </span>
      <button
        type="button"
        className="kukui-seq__handle"
        aria-label={`Step: ${text}, ${stateLabel}`}
        disabled={submitted}
        {...attributes}
        {...listeners}
      >
        <span className="kukui-seq__text">{text}</span>
        {submitted ? (
          <span
            className={[
              "kukui-seq__badge",
              isCorrect ? "is-correct" : "",
              isIncorrect ? "is-incorrect" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="kukui-seq__badge-icon" aria-hidden="true">
              {isCorrect ? "✓" : "✗"}
            </span>
            <span className="kukui-seq__badge-text">
              {isCorrect ? "Correct" : `Correct position: #${correctPosition}`}
            </span>
          </span>
        ) : null}
      </button>
      {/* Keyboard / screen-reader fallback: explicit Up / Down buttons. */}
      <span className="kukui-seq__nudge" aria-hidden={submitted ? "true" : undefined}>
        <button
          type="button"
          className="kukui-seq__nudge-btn"
          aria-label={`Move "${text}" up`}
          disabled={submitted || index === 0}
          onClick={() => onMove(id, index - 1)}
        >
          <span aria-hidden="true">{"↑"}</span>
        </button>
        <button
          type="button"
          className="kukui-seq__nudge-btn"
          aria-label={`Move "${text}" down`}
          disabled={submitted || index === total - 1}
          onClick={() => onMove(id, index + 1)}
        >
          <span aria-hidden="true">{"↓"}</span>
        </button>
      </span>
    </li>
  );
}

function parseSuspend(s: string | undefined, correctOrder: readonly string[]): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (
      parsed &&
      Array.isArray(parsed.order) &&
      typeof parsed.attempts === "number" &&
      parsed.order.every((x): x is string => typeof x === "string")
    ) {
      // Validate: must be a permutation of the current correct order's ids.
      const expected = new Set(correctOrder);
      const got = new Set(parsed.order);
      if (expected.size !== got.size) return null;
      for (const id of expected) if (!got.has(id)) return null;
      return {
        stage: parsed.stage === "submitted" ? "submitted" : "answering",
        order: parsed.order,
        attempts: parsed.attempts,
      };
    }
  } catch {
    /* noop */
  }
  return null;
}
