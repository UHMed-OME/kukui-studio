import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { DragAndDropConfig } from "@kukui/schemas";
import type { ActivityProps } from "../../types.js";
import "./DragAndDrop.css";

type Stage = "answering" | "submitted";

/** Map of draggableId → zoneId or null (still in tray). */
type Placement = Record<string, string | null>;

type State = {
  stage: Stage;
  placement: Placement;
  attempts: number;
};

export function DragAndDrop({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<DragAndDropConfig>) {
  const HeadingTag = `h${headingLevel}` as "h1" | "h2" | "h3";
  const headingId = useId();
  const initial = useMemo<State>(
    () => ({
      stage: "answering",
      placement: Object.fromEntries(config.draggables.map((d) => [d.id, null])),
      attempts: 0,
    }),
    [config.draggables],
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

  const placeIn = (draggableId: string, zoneId: string | null) => {
    if (state.stage !== "answering") return;
    // Honour zone capacity (default 1).
    if (zoneId) {
      const zone = config.dropZones.find((z) => z.id === zoneId);
      if (!zone) return;
      const cap = zone.capacity ?? 1;
      const already = Object.entries(state.placement).filter(
        ([id, zid]) => zid === zoneId && id !== draggableId,
      );
      if (already.length >= cap) return;
    }
    setState((s) => ({ ...s, placement: { ...s.placement, [draggableId]: zoneId } }));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const draggableId = String(e.active.id);
    if (e.over) {
      const overId = String(e.over.id);
      if (overId === "tray") {
        placeIn(draggableId, null);
      } else if (overId.startsWith("zone:")) {
        placeIn(draggableId, overId.slice("zone:".length));
      }
    }
  };

  const isCorrect = (draggableId: string, zoneId: string | null): boolean => {
    if (!zoneId) return false;
    const draggable = config.draggables.find((d) => d.id === draggableId);
    if (!draggable) return false;
    return draggable.correctZones.includes(zoneId);
  };

  const submit = () => {
    if (state.stage !== "answering") return;
    const total = config.draggables.length;
    const correct = Object.entries(state.placement).filter(([id, zid]) => isCorrect(id, zid))
      .length;
    const singlePoint = config.behaviour?.singlePoint ?? false;
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
  const allPlaced = Object.values(state.placement).every((z) => z !== null);

  // Group placements by zone for rendering.
  const draggablesById = useMemo(
    () => Object.fromEntries(config.draggables.map((d) => [d.id, d])),
    [config.draggables],
  );

  const zoneOccupants = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const z of config.dropZones) map.set(z.id, []);
    for (const [dragId, zid] of Object.entries(state.placement)) {
      if (zid) map.get(zid)?.push(dragId);
    }
    return map;
  }, [config.dropZones, state.placement]);

  const trayItems = config.draggables.filter((d) => state.placement[d.id] === null);

  return (
    <div className="kukui-dnd">
      <article className="kukui-dnd__card" aria-labelledby={headingId}>
        <HeadingTag id={headingId} className="kukui-dnd__title">
          {config.title}
        </HeadingTag>
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="kukui-dnd__layout">
            <div
              className="kukui-dnd__board"
              style={{ backgroundImage: `url(${config.background.src})` }}
              role="img"
              // Don't fall back to the activity title — that would just have
              // assistive tech read the title twice. Empty alt here means
              // sighted-keyboard users still see the visual; AT users rely on
              // the fallback list below for the activity's full structure.
              aria-label={config.background.alt ?? ""}
            >
              {config.dropZones.map((zone) => {
                const occupants = zoneOccupants.get(zone.id) ?? [];
                const style: CSSProperties = {
                  left: `${zone.rect.x * 100}%`,
                  top: `${zone.rect.y * 100}%`,
                  width: `${zone.rect.w * 100}%`,
                  height: `${zone.rect.h * 100}%`,
                };
                return (
                  <Zone key={zone.id} zoneId={zone.id} style={style} label={zone.label}>
                    {occupants.map((dragId) => {
                      const d = draggablesById[dragId];
                      if (!d) return null;
                      const correct = isCorrect(dragId, zone.id);
                      return (
                        <PlacedDraggable
                          key={dragId}
                          dragId={dragId}
                          label={d.label}
                          submitted={submitted}
                          correct={correct}
                        />
                      );
                    })}
                  </Zone>
                );
              })}
            </div>
            <Tray>
              {trayItems.map((d) => (
                <TrayDraggable key={d.id} dragId={d.id} label={d.label} disabled={submitted} />
              ))}
              {trayItems.length === 0 ? (
                <p className="kukui-dnd__tray-empty">All draggables placed.</p>
              ) : null}
            </Tray>
          </div>
        </DndContext>

        {/* Keyboard / screen-reader fallback: select draggable → select zone */}
        <FallbackList
          draggables={config.draggables}
          dropZones={config.dropZones}
          placement={state.placement}
          submitted={submitted}
          onPlace={placeIn}
        />

        <div
          className={["kukui-dnd__feedback", submitted ? "is-visible" : ""]
            .filter(Boolean)
            .join(" ")}
          role="status"
          aria-live="polite"
        >
          {submitted
            ? `${
                Object.entries(state.placement).filter(([id, zid]) => isCorrect(id, zid)).length
              } of ${config.draggables.length} correctly placed.`
            : ""}
        </div>

        {submitted ? (
          <section
            className="kukui-dnd__summary"
            aria-label="Per-draggable summary"
          >
            <ul className="kukui-dnd__summary-list">
              {config.draggables.map((d) => {
                const zid = state.placement[d.id] ?? null;
                const correct = isCorrect(d.id, zid);
                return (
                  <li key={d.id} className="kukui-dnd__summary-item">
                    <span
                      className="kukui-dnd__summary-icon"
                      aria-hidden="true"
                    >
                      {correct ? "✓" : "✗"}
                    </span>
                    <span className="kukui-dnd__summary-name">{d.label}</span>
                    {d.feedback ? (
                      <span className="kukui-dnd__summary-feedback">
                        {d.feedback}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <div className="kukui-dnd__actions">
          {submitted ? (
            config.behaviour?.enableRetry ? (
              <button type="button" className="kukui-dnd__secondary" onClick={tryAgain}>
                {tryAgainLabel}
              </button>
            ) : null
          ) : (
            <button
              type="button"
              className="kukui-dnd__primary"
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
      className={["kukui-dnd__tray", isOver ? "is-over" : ""].filter(Boolean).join(" ")}
      aria-label="Tray of unplaced draggables"
    >
      {children}
    </div>
  );
}

function Zone({
  zoneId,
  style,
  label,
  children,
}: {
  zoneId: string;
  style: CSSProperties;
  label?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `zone:${zoneId}` });
  return (
    <div
      ref={setNodeRef}
      className={["kukui-dnd__zone", isOver ? "is-over" : ""].filter(Boolean).join(" ")}
      style={style}
      aria-label={label ?? zoneId}
    >
      {children}
    </div>
  );
}

function TrayDraggable({
  dragId,
  label,
  disabled,
}: {
  dragId: string;
  label: string;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    disabled,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={["kukui-dnd__chip", isDragging ? "is-dragging" : ""]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      {...listeners}
      {...attributes}
    >
      {label}
    </button>
  );
}

function PlacedDraggable({
  dragId,
  label,
  submitted,
  correct,
}: {
  dragId: string;
  label: string;
  submitted: boolean;
  correct: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    disabled: submitted,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={[
        "kukui-dnd__chip",
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
      <span>{label}</span>
      {submitted ? (
        <span className="kukui-dnd__chip-icon" aria-hidden="true">
          {correct ? "✓" : "✗"}
        </span>
      ) : null}
    </button>
  );
}

function FallbackList({
  draggables,
  dropZones,
  placement,
  submitted,
  onPlace,
}: {
  draggables: DragAndDropConfig["draggables"];
  dropZones: DragAndDropConfig["dropZones"];
  placement: Placement;
  submitted: boolean;
  onPlace: (dragId: string, zoneId: string | null) => void;
}) {
  return (
    <fieldset className="kukui-dnd__fallback" disabled={submitted}>
      <legend className="kukui-dnd__fallback-legend">
        Keyboard placement (alternative to drag-and-drop)
      </legend>
      <ul className="kukui-dnd__fallback-list">
        {draggables.map((d) => (
          <li key={d.id} className="kukui-dnd__fallback-row">
            <label htmlFor={`fb-${d.id}`} className="kukui-dnd__fallback-label">
              {d.label}
            </label>
            <select
              id={`fb-${d.id}`}
              className="kukui-dnd__fallback-select"
              value={placement[d.id] ?? ""}
              onChange={(e) => onPlace(d.id, e.target.value || null)}
              disabled={submitted}
            >
              <option value="">— Tray —</option>
              {dropZones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label ?? z.id}
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
  config: DragAndDropConfig,
): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (parsed && parsed.placement && typeof parsed.attempts === "number") {
      // Validate placement keys against current config draggables.
      const placement: Placement = {};
      for (const d of config.draggables) {
        const v = (parsed.placement as Placement)[d.id];
        placement[d.id] = typeof v === "string" || v === null ? v : null;
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
