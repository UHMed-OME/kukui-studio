import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { AnatomyLabelingConfig } from "./schema.js";
import type { ActivityProps } from "@kukui/core/types";
import { ActivityHeader, SafeHtml } from "@kukui/core";
import { bandMessage, percentage, resolveScoring } from "@kukui/core/scoring";
import "./Component.css";

/** Tiny seeded PRNG (mulberry32) — stable shuffle across re-renders.
 * Mirrors multiple-choice's implementation (the house pattern for
 * randomized option order). */
function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates with the seeded PRNG. Exported for tests: same seed,
 * same order, every time. */
export function shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const rand = rng(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

type Stage = "answering" | "submitted";

/** Map of labelId → targetId or null (still in tray). */
type Placement = Record<string, string | null>;

type State = {
  stage: Stage;
  placement: Placement;
  attempts: number;
};

/**
 * Anatomy Labeling — drag named labels onto numbered point-targets on an
 * anatomical illustration. A small circle marks each target; the tray below
 * holds unplaced label chips. A keyboard-fallback row of `<select>`s lets
 * non-mouse users place each label by target number.
 *
 * Mechanically a constrained variant of Drag and Drop where draggables are
 * text labels and zones are small clickable point-circles (32 px) instead
 * of large rectangles. Each target accepts at most one label; placing a
 * second label on an occupied target replaces the first (which falls back
 * into the tray).
 */
export default function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<AnatomyLabelingConfig>) {
  const headingId = useId();

  const initial = useMemo<State>(
    () => ({
      stage: "answering",
      placement: Object.fromEntries(config.labels.map((l) => [l.id, null])),
      attempts: 0,
    }),
    [config.labels],
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

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  /**
   * Place `labelId` on `targetId` (or null = back to tray).
   * Each target holds at most one label — if it's already occupied by a
   * different label, that prior label is bumped back to the tray.
   */
  const placeIn = (labelId: string, targetId: string | null) => {
    if (state.stage !== "answering") return;
    if (targetId !== null && !config.targets.some((t) => t.id === targetId)) return;
    setState((s) => {
      const nextPlacement: Placement = { ...s.placement };
      if (targetId !== null) {
        for (const [id, tid] of Object.entries(nextPlacement)) {
          if (id !== labelId && tid === targetId) {
            nextPlacement[id] = null;
          }
        }
      }
      nextPlacement[labelId] = targetId;
      return { ...s, placement: nextPlacement };
    });
  };

  // Track the actively-dragged label so <DragOverlay> can render a ghost
  // chip under the cursor. With the original chip leaving the tray on
  // pickup and the target circles being small (32 px), authors otherwise
  // lose track of *which* label is being dragged the moment it leaves the
  // tray bounds.
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const handleDragStart = (e: DragStartEvent) => {
    setActiveDragId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDragId(null);
    const labelId = String(e.active.id);
    if (!e.over) return;
    const overId = String(e.over.id);
    if (overId === "tray") {
      placeIn(labelId, null);
    } else if (overId.startsWith("target:")) {
      placeIn(labelId, overId.slice("target:".length));
    }
  };

  const handleDragCancel = () => setActiveDragId(null);

  const isCorrect = (labelId: string, targetId: string | null): boolean => {
    if (!targetId) return false;
    const label = config.labels.find((l) => l.id === labelId);
    if (!label) return false;
    return label.correctTargetId === targetId;
  };

  const scoring = useMemo(() => resolveScoring(config, { mode: "points" }), [config]);

  const submit = () => {
    if (state.stage !== "answering") return;
    const total = config.labels.length;
    const correct = Object.entries(state.placement).filter(([id, tid]) =>
      isCorrect(id, tid),
    ).length;
    const singlePoint = scoring.mode === "all-or-nothing";
    const max = singlePoint ? 1 : total;
    const allRight = correct === total;
    const raw = singlePoint ? (allRight ? 1 : 0) : correct;
    const next: State = { ...state, stage: "submitted", attempts: state.attempts + 1 };
    setState(next);
    onSubmit({ raw, max, success: allRight, suspendData: JSON.stringify(next) });
  };

  const tryAgain = () => setState({ ...initial, attempts: state.attempts });

  const ui = config.ui ?? {};
  const checkLabel = ui.checkAnswerButton ?? "Check";
  const tryAgainLabel = ui.tryAgainButton ?? "Try again";

  const submitted = state.stage === "submitted";
  const allPlaced = Object.values(state.placement).every((t) => t !== null);

  // Score view for the post-submit line (MC-style raw/max + band message).
  const correctCount = Object.entries(state.placement).filter(([id, tid]) =>
    isCorrect(id, tid),
  ).length;
  const singlePoint = scoring.mode === "all-or-nothing";
  const scoreMax = singlePoint ? 1 : config.labels.length;
  const scoreRaw = singlePoint
    ? correctCount === config.labels.length
      ? 1
      : 0
    : correctCount;
  const banner = submitted
    ? bandMessage(scoring.bands, percentage({ raw: scoreRaw, max: scoreMax }))
    : null;

  const labelsById = useMemo(
    () => Object.fromEntries(config.labels.map((l) => [l.id, l])),
    [config.labels],
  );

  /** targetId → its 1-based display index (used by the keyboard select). */
  const targetIndexById = useMemo(() => {
    const map: Record<string, number> = {};
    config.targets.forEach((t, i) => {
      map[t.id] = i + 1;
    });
    return map;
  }, [config.targets]);

  /** targetId → currently-placed labelId (or undefined). */
  const occupantByTarget = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const [labelId, tid] of Object.entries(state.placement)) {
      if (tid) map[tid] = labelId;
    }
    return map;
  }, [state.placement]);

  // Tray label order: stable by config order, optionally randomized once.
  // Seeded shuffle (per-mount seed, stable across re-renders, varies
  // across mounts) — the multiple-choice pattern.
  const orderedLabels = useMemo(() => {
    if (!config.behaviour?.randomizeLabels) return config.labels;
    const seed = Math.floor(Math.random() * 0xffffffff) >>> 0;
    return shuffleWithSeed(config.labels, seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const trayLabels = orderedLabels.filter((l) => state.placement[l.id] === null);

  return (
    <div className="kukui-al">
      <article className="kukui-al__card" aria-labelledby={headingId}>
        <ActivityHeader
          title={config.title}
          titleId={headingId}
          headingLevel={headingLevel}
          variant={config.appearance?.header ?? "full"}
          prompt={config.prompt ? <SafeHtml html={config.prompt} /> : undefined}
        />

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="kukui-al__image-wrap">
            {config.image ? (
              <img
                src={config.image.src}
                alt={config.image.alt ?? ""}
                className="kukui-al__image"
                draggable={false}
              />
            ) : (
              <div className="kukui-al__empty" role="status">
                <strong>Add an image to label.</strong>
                <span>Open the Editor tab and pick a diagram for learners to annotate.</span>
              </div>
            )}
            {config.targets.map((t) => {
              const occupantId = occupantByTarget[t.id];
              const occupant = occupantId ? labelsById[occupantId] : undefined;
              const correct = occupantId ? isCorrect(occupantId, t.id) : false;
              const idx = targetIndexById[t.id]!;
              const style: CSSProperties = {
                left: `${t.position.x * 100}%`,
                top: `${t.position.y * 100}%`,
              };
              // The placed chip normally floats above the circle, but the
              // image wrap clips (overflow: hidden) — near the top edge the
              // chip flips below the circle, and near the side edges it
              // clamps toward the image instead of centering. Thresholds
              // are normalized image fractions.
              const edgeClasses = [
                t.position.y < 0.12 ? "is-chip-below" : "",
                t.position.x < 0.12 ? "is-chip-left" : "",
                t.position.x > 0.88 ? "is-chip-right" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <Target
                  key={t.id}
                  targetId={t.id}
                  index={idx}
                  style={style}
                  edgeClasses={edgeClasses}
                  occupantLabel={occupant?.text}
                  occupantLabelId={occupantId}
                  submitted={submitted}
                  correct={correct}
                />
              );
            })}
          </div>

          <Tray>
            {trayLabels.map((l) => (
              <TrayLabel key={l.id} labelId={l.id} text={l.text} disabled={submitted} />
            ))}
            {trayLabels.length === 0 ? (
              <p className="kukui-al__tray-empty">All labels placed.</p>
            ) : null}
          </Tray>
          <DragOverlay dropAnimation={null}>
            {activeDragId ? (
              <span className="kukui-al__chip kukui-al__chip--ghost" aria-hidden="true">
                {labelsById[activeDragId]?.text ?? ""}
              </span>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Keyboard / screen-reader fallback: each label picks a target by index. */}
        <FallbackList
          labels={config.labels}
          targets={config.targets}
          targetIndexById={targetIndexById}
          placement={state.placement}
          submitted={submitted}
          onPlace={placeIn}
        />

        <div
          className={["kukui-al__feedback", submitted ? "is-visible" : ""]
            .filter(Boolean)
            .join(" ")}
          role="status"
          aria-live="polite"
        >
          {submitted
            ? `${
                Object.entries(state.placement).filter(([id, tid]) => isCorrect(id, tid))
                  .length
              } of ${config.labels.length} labels correctly placed.`
            : ""}
        </div>

        {/* Post-submit the row never empties: the score line always renders,
            so turning retry off doesn't collapse the row (layout-stable). */}
        <div className="kukui-al__actions">
          {submitted ? (
            <>
              <output className="kukui-al__score">
                {scoreRaw} / {scoreMax}
                {banner ? <span className="kukui-al__band"> · {banner}</span> : null}
              </output>
              {scoring.enableRetry ? (
                <button type="button" className="kukui-al__secondary" onClick={tryAgain}>
                  {tryAgainLabel}
                </button>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              className="kukui-al__primary"
              disabled={!allPlaced}
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

function Tray({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "tray" });
  return (
    <div
      ref={setNodeRef}
      className={["kukui-al__tray", isOver ? "is-over" : ""].filter(Boolean).join(" ")}
      aria-label="Tray of unplaced labels"
    >
      {children}
    </div>
  );
}

function Target({
  targetId,
  index,
  style,
  edgeClasses,
  occupantLabel,
  occupantLabelId,
  submitted,
  correct,
}: {
  targetId: string;
  index: number;
  style: CSSProperties;
  edgeClasses?: string;
  occupantLabel: string | undefined;
  occupantLabelId: string | undefined;
  submitted: boolean;
  correct: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `target:${targetId}` });
  const stateClass = submitted && occupantLabelId
    ? correct ? "is-correct" : "is-incorrect"
    : "";
  return (
    // role="group": a bare div's aria-label is not exposed by most
    // screen readers; the group role makes "Target N: <label>" land.
    <div
      ref={setNodeRef}
      role="group"
      className={[
        "kukui-al__target",
        isOver ? "is-over" : "",
        occupantLabelId ? "is-occupied" : "",
        stateClass,
        edgeClasses ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      aria-label={
        occupantLabel
          ? `Target ${index}: ${occupantLabel}`
          : `Target ${index}: empty`
      }
    >
      {/* Not aria-hidden: the visible number is the same cue sighted
          learners use, and hiding it made the circles silent for SR
          users navigating by object. */}
      <span className="kukui-al__target-number">{index}</span>
      {occupantLabelId && occupantLabel ? (
        <PlacedLabel
          labelId={occupantLabelId}
          text={occupantLabel}
          submitted={submitted}
          correct={correct}
        />
      ) : null}
    </div>
  );
}

function TrayLabel({
  labelId,
  text,
  disabled,
}: {
  labelId: string;
  text: string;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: labelId,
    disabled,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={["kukui-al__chip", isDragging ? "is-dragging" : ""]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      {...listeners}
      {...attributes}
    >
      {text}
    </button>
  );
}

function PlacedLabel({
  labelId,
  text,
  submitted,
  correct,
}: {
  labelId: string;
  text: string;
  submitted: boolean;
  correct: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: labelId,
    disabled: submitted,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={[
        "kukui-al__chip",
        "is-placed",
        submitted && correct ? "is-correct" : "",
        submitted && !correct ? "is-incorrect" : "",
        isDragging ? "is-dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={submitted}
      {...listeners}
      {...attributes}
    >
      <span>{text}</span>
      {submitted ? (
        <span className="kukui-al__chip-icon" aria-hidden="true">
          {correct ? "✓" : "✗"}
        </span>
      ) : null}
    </button>
  );
}

function FallbackList({
  labels,
  targets,
  targetIndexById,
  placement,
  submitted,
  onPlace,
}: {
  labels: AnatomyLabelingConfig["labels"];
  targets: AnatomyLabelingConfig["targets"];
  targetIndexById: Record<string, number>;
  placement: Placement;
  submitted: boolean;
  onPlace: (labelId: string, targetId: string | null) => void;
}) {
  return (
    <fieldset className="kukui-al__fallback" disabled={submitted}>
      <legend className="kukui-al__fallback-legend">
        Keyboard placement (alternative to drag-and-drop)
      </legend>
      <ul className="kukui-al__fallback-list">
        {labels.map((l) => {
          const placedTarget = placement[l.id];
          const correctIdx = targetIndexById[l.correctTargetId];
          const isCorrect =
            submitted && placedTarget !== null && placedTarget === l.correctTargetId;
          const isWrong =
            submitted && placedTarget !== null && placedTarget !== l.correctTargetId;
          return (
            <li key={l.id} className="kukui-al__fallback-row">
              <label htmlFor={`fb-${l.id}`} className="kukui-al__fallback-label">
                {l.text}
              </label>
              <select
                id={`fb-${l.id}`}
                className={[
                  "kukui-al__fallback-select",
                  isCorrect ? "is-correct" : "",
                  isWrong ? "is-incorrect" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                value={placedTarget ?? ""}
                onChange={(e) => onPlace(l.id, e.target.value || null)}
                disabled={submitted}
              >
                <option value="">— Tray —</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    Target {targetIndexById[t.id]}
                  </option>
                ))}
              </select>
              {isWrong ? (
                <span className="kukui-al__fallback-correction">
                  Correct: target {correctIdx}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

function parseSuspend(
  s: string | undefined,
  config: AnatomyLabelingConfig,
): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (parsed && parsed.placement && typeof parsed.attempts === "number") {
      const validTargetIds = new Set(config.targets.map((t) => t.id));
      const placement: Placement = {};
      for (const l of config.labels) {
        const v = (parsed.placement as Placement)[l.id];
        if (typeof v === "string" && validTargetIds.has(v)) {
          placement[l.id] = v;
        } else {
          placement[l.id] = null;
        }
      }
      return {
        stage: parsed.stage === "submitted" ? "submitted" : "answering",
        placement,
        attempts: parsed.attempts,
      };
    }
  } catch {
    /* noop */
  }
  return null;
}
