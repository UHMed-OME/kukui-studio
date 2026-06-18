import { useEffect, useId, useMemo, useState } from "react";
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
import type { CategorizationConfig } from "./schema.js";
import type { ActivityProps } from "@kukui/core/types";
import { ActivityHeader, SafeHtml } from "@kukui/core";
import { resolveScoring } from "@kukui/core/scoring";
import "./Component.css";

type Stage = "answering" | "submitted";

/** Map of itemId → categoryId or null (still in tray). */
type Placement = Record<string, string | null>;

type State = {
  stage: Stage;
  placement: Placement;
  attempts: number;
};

export default function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<CategorizationConfig>) {
  const headingId = useId();
  const promptId = useId();

  const initial = useMemo<State>(
    () => ({
      stage: "answering",
      placement: Object.fromEntries(config.items.map((i) => [i.id, null])),
      attempts: 0,
    }),
    [config.items],
  );

  const [state, setState] = useState<State>(() => parseSuspend(suspendData, config) ?? initial);

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

  const placeIn = (itemId: string, categoryId: string | null) => {
    if (state.stage !== "answering") return;
    if (categoryId !== null && !config.categories.some((c) => c.id === categoryId)) return;
    setState((s) => ({ ...s, placement: { ...s.placement, [itemId]: categoryId } }));
  };

  // Track the actively-dragged id so <DragOverlay> can render a ghost
  // chip under the cursor while the original stays in its tray/bin slot.
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const handleDragStart = (e: DragStartEvent) => {
    setActiveDragId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDragId(null);
    const itemId = String(e.active.id);
    if (!e.over) return;
    const overId = String(e.over.id);
    if (overId === "tray") {
      placeIn(itemId, null);
    } else if (overId.startsWith("cat:")) {
      placeIn(itemId, overId.slice("cat:".length));
    }
  };

  const handleDragCancel = () => setActiveDragId(null);

  const isCorrect = (itemId: string, categoryId: string | null): boolean => {
    if (!categoryId) return false;
    const item = config.items.find((i) => i.id === itemId);
    if (!item) return false;
    return item.correctCategory === categoryId;
  };

  const scoring = useMemo(() => resolveScoring(config, { mode: "points" }), [config]);

  const submit = () => {
    if (state.stage !== "answering") return;
    const total = config.items.length;
    const correct = Object.entries(state.placement).filter(([id, cid]) => isCorrect(id, cid))
      .length;
    const singlePoint = scoring.mode === "all-or-nothing";
    const max = singlePoint ? 1 : total;
    const allRight = correct === total;
    const raw = singlePoint ? (allRight ? 1 : 0) : correct;
    const next: State = { ...state, stage: "submitted", attempts: state.attempts + 1 };
    setState(next);
    onSubmit({ raw, max, success: allRight, suspendData: JSON.stringify(next) });
  };

  const tryAgain = () => setState(initial);

  const ui = config.ui ?? {};
  const checkLabel = ui.checkAnswerButton ?? "Check";
  const tryAgainLabel = ui.tryAgainButton ?? "Try again";

  const submitted = state.stage === "submitted";
  const allPlaced = Object.values(state.placement).every((c) => c !== null);

  const itemsById = useMemo(
    () => Object.fromEntries(config.items.map((i) => [i.id, i])),
    [config.items],
  );
  const categoryById = useMemo(
    () => Object.fromEntries(config.categories.map((c) => [c.id, c])),
    [config.categories],
  );

  const categoryOccupants = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of config.categories) map.set(c.id, []);
    for (const [itemId, cid] of Object.entries(state.placement)) {
      if (cid) map.get(cid)?.push(itemId);
    }
    return map;
  }, [config.categories, state.placement]);

  // Item ordering: stable by config order, optionally randomized once on mount.
  const orderedItems = useMemo(() => {
    if (!config.behaviour?.randomizeItems) return config.items;
    const arr = [...config.items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
    // We deliberately re-randomize only when items list reference changes.
  }, [config.items, config.behaviour?.randomizeItems]);

  const trayItems = orderedItems.filter((i) => state.placement[i.id] === null);

  return (
    <div className="kukui-cat">
      <article
        className="kukui-cat__card"
        aria-labelledby={headingId}
        aria-describedby={promptId}
      >
        <ActivityHeader
          title={config.title}
          titleId={headingId}
          headingLevel={headingLevel}
          variant={config.appearance?.header ?? "full"}
          prompt={<SafeHtml html={config.prompt} />}
        />

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <Tray>
            {trayItems.map((i) => (
              <TrayItem key={i.id} itemId={i.id} text={i.text} disabled={submitted} />
            ))}
            {trayItems.length === 0 ? (
              <p className="kukui-cat__tray-empty">All items placed.</p>
            ) : null}
          </Tray>

          <div
            className="kukui-cat__bins"
            role="group"
            aria-label="Category bins"
          >
            {config.categories.map((cat) => {
              const occupants = categoryOccupants.get(cat.id) ?? [];
              return (
                <Bin key={cat.id} categoryId={cat.id} label={cat.label}>
                  {occupants.map((itemId) => {
                    const item = itemsById[itemId];
                    if (!item) return null;
                    const correct = isCorrect(itemId, cat.id);
                    const correctCat = categoryById[item.correctCategory];
                    return (
                      <PlacedItem
                        key={itemId}
                        itemId={itemId}
                        text={item.text}
                        submitted={submitted}
                        correct={correct}
                        correctCategoryLabel={correctCat?.label ?? item.correctCategory}
                      />
                    );
                  })}
                </Bin>
              );
            })}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeDragId ? (
              <span className="kukui-cat__chip kukui-cat__chip--ghost" aria-hidden="true">
                {itemsById[activeDragId]?.text ?? ""}
              </span>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Keyboard / screen-reader fallback: each item picks its category. */}
        <FallbackList
          items={config.items}
          categories={config.categories}
          placement={state.placement}
          submitted={submitted}
          onPlace={placeIn}
        />

        <div
          className={["kukui-cat__feedback", submitted ? "is-visible" : ""]
            .filter(Boolean)
            .join(" ")}
          role="status"
          aria-live="polite"
        >
          {submitted
            ? `${
                Object.entries(state.placement).filter(([id, cid]) => isCorrect(id, cid)).length
              } of ${config.items.length} correctly categorized.`
            : ""}
        </div>

        <div className="kukui-cat__actions">
          {submitted ? (
            scoring.enableRetry ? (
              <button type="button" className="kukui-cat__secondary" onClick={tryAgain}>
                {tryAgainLabel}
              </button>
            ) : null
          ) : (
            <button
              type="button"
              className="kukui-cat__primary"
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
      className={["kukui-cat__tray", isOver ? "is-over" : ""].filter(Boolean).join(" ")}
      aria-label="Tray of unsorted items"
    >
      {children}
    </div>
  );
}

function Bin({
  categoryId,
  label,
  children,
}: {
  categoryId: string;
  label: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `cat:${categoryId}` });
  return (
    <div
      ref={setNodeRef}
      className={["kukui-cat__bin", isOver ? "is-over" : ""].filter(Boolean).join(" ")}
      aria-label={label}
    >
      <div className="kukui-cat__bin-label">{label}</div>
      <div className="kukui-cat__bin-body">{children}</div>
    </div>
  );
}

function TrayItem({
  itemId,
  text,
  disabled,
}: {
  itemId: string;
  text: string;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: itemId,
    disabled,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={["kukui-cat__chip", isDragging ? "is-dragging" : ""]
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

function PlacedItem({
  itemId,
  text,
  submitted,
  correct,
  correctCategoryLabel,
}: {
  itemId: string;
  text: string;
  submitted: boolean;
  correct: boolean;
  correctCategoryLabel: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: itemId,
    disabled: submitted,
  });
  return (
    <span className="kukui-cat__chip-wrap">
      <button
        ref={setNodeRef}
        type="button"
        className={[
          "kukui-cat__chip",
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
          <span className="kukui-cat__chip-icon" aria-hidden="true">
            {correct ? "✓" : "✗"}
          </span>
        ) : null}
      </button>
      {submitted && !correct ? (
        <span className="kukui-cat__chip-correction">
          Correct: {correctCategoryLabel}
        </span>
      ) : null}
    </span>
  );
}

function FallbackList({
  items,
  categories,
  placement,
  submitted,
  onPlace,
}: {
  items: CategorizationConfig["items"];
  categories: CategorizationConfig["categories"];
  placement: Placement;
  submitted: boolean;
  onPlace: (itemId: string, categoryId: string | null) => void;
}) {
  return (
    <fieldset className="kukui-cat__fallback" disabled={submitted}>
      <legend className="kukui-cat__fallback-legend">
        Keyboard categorization (alternative to drag-and-drop)
      </legend>
      <ul className="kukui-cat__fallback-list">
        {items.map((it) => (
          <li key={it.id} className="kukui-cat__fallback-row">
            <label htmlFor={`fb-${it.id}`} className="kukui-cat__fallback-label">
              {it.text}
            </label>
            <select
              id={`fb-${it.id}`}
              className="kukui-cat__fallback-select"
              value={placement[it.id] ?? ""}
              onChange={(e) => onPlace(it.id, e.target.value || null)}
              disabled={submitted}
            >
              <option value="">— Tray —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function parseSuspend(
  s: string | undefined,
  config: CategorizationConfig,
): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (parsed && parsed.placement && typeof parsed.attempts === "number") {
      const validCategoryIds = new Set(config.categories.map((c) => c.id));
      const placement: Placement = {};
      for (const it of config.items) {
        const v = (parsed.placement as Placement)[it.id];
        if (typeof v === "string" && validCategoryIds.has(v)) {
          placement[it.id] = v;
        } else {
          placement[it.id] = null;
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
