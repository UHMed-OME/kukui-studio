import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from "react";
import type { AnatomyLabelingConfig } from "@kukui/schemas";
import { ContextMenu, type ContextMenuPos } from "./ContextMenu.js";
import { StageHeader } from "./StageHeader.js";
import { reorder, roundCoord, type ZOrderOp } from "./zorder.js";

const roundPoint = <T extends { x: number; y: number }>(p: T): T => ({
  ...p,
  x: roundCoord(p.x),
  y: roundCoord(p.y),
});

type Point = AnatomyLabelingConfig["targets"][number]["position"];

type DragState =
  | { kind: "idle" }
  | {
      kind: "down";
      pointerId: number;
      startX: number;
      startY: number;
      moved: boolean;
    }
  | {
      kind: "move";
      pointerId: number;
      targetId: string;
      offsetX: number;
      offsetY: number;
      position: Point;
    };

const MOVE_THRESHOLD = 0.005;

const newTargetId = (existing: string[]): string => {
  let i = existing.length + 1;
  while (existing.includes(`t-${i}`)) i += 1;
  return `t-${i}`;
};

/**
 * Visual editor for Anatomy Labeling. The image has point-markers (targets);
 * labels live in the form because they're text. Click empty image to drop a
 * new target. Drag to reposition. Right-click for stacking + delete.
 *
 * Each target shows the text of the label whose `correctTargetId` matches
 * — that's the marker authors are aiming when they place a target.
 */
export function AnatomyLabelingEditor({
  config,
  onChange,
}: {
  config: AnatomyLabelingConfig;
  onChange: (next: AnatomyLabelingConfig) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState>({ kind: "idle" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; pos: ContextMenuPos } | null>(null);

  const livePos: { id: string; position: Point } | null =
    drag.kind === "move" ? { id: drag.targetId, position: drag.position } : null;

  const toNormalized = (clientX: number, clientY: number) => {
    const board = boardRef.current;
    if (!board) return { x: 0, y: 0 };
    const r = board.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (clientY - r.top) / r.height)),
    };
  };

  const startBoardDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.target !== boardRef.current) return;
    const { x, y } = toNormalized(e.clientX, e.clientY);
    setSelectedId(null);
    setDrag({ kind: "down", pointerId: e.pointerId, startX: x, startY: y, moved: false });
    boardRef.current?.setPointerCapture(e.pointerId);
  };

  const startTargetMove = (targetId: string) => (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const t = config.targets.find((x) => x.id === targetId);
    if (!t) return;
    const { x, y } = toNormalized(e.clientX, e.clientY);
    setSelectedId(targetId);
    setDrag({
      kind: "move",
      pointerId: e.pointerId,
      targetId,
      offsetX: x - t.position.x,
      offsetY: y - t.position.y,
      position: t.position,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.kind === "idle") return;
    const { x, y } = toNormalized(e.clientX, e.clientY);

    if (drag.kind === "down") {
      const dx = Math.abs(x - drag.startX);
      const dy = Math.abs(y - drag.startY);
      if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
        setDrag({ ...drag, moved: true });
      }
      return;
    }

    if (drag.kind === "move") {
      setDrag({
        ...drag,
        position: {
          x: Math.max(0, Math.min(1, x - drag.offsetX)),
          y: Math.max(0, Math.min(1, y - drag.offsetY)),
        },
      });
    }
  };

  const handlePointerUp = () => {
    if (drag.kind === "down" && !drag.moved) {
      const id = newTargetId(config.targets.map((t) => t.id));
      onChange({
        ...config,
        targets: [
          ...config.targets,
          { id, position: roundPoint({ x: drag.startX, y: drag.startY }) },
        ],
      });
      setSelectedId(id);
    } else if (drag.kind === "move") {
      const next = roundPoint(drag.position);
      onChange({
        ...config,
        targets: config.targets.map((t) =>
          t.id === drag.targetId ? { ...t, position: next } : t,
        ),
      });
    }
    setDrag({ kind: "idle" });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (selectedId && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        deleteTarget(selectedId);
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const deleteTarget = (targetId: string) => {
    onChange({ ...config, targets: config.targets.filter((t) => t.id !== targetId) });
    setSelectedId(null);
  };

  const openContextMenu = (targetId: string) => (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(targetId);
    setMenu({ id: targetId, pos: { x: e.clientX, y: e.clientY } });
  };

  const applyZOrder = (targetId: string, op: ZOrderOp) => {
    const index = config.targets.findIndex((t) => t.id === targetId);
    if (index < 0) return;
    onChange({ ...config, targets: reorder(config.targets, index, op) });
  };

  // Build a target → label text map so each marker shows the label it
  // belongs to. Falls back to the target id when no label points at it.
  const labelByTarget = new Map<string, string>();
  for (const l of config.labels) {
    if (!labelByTarget.has(l.correctTargetId)) labelByTarget.set(l.correctTargetId, l.text);
  }

  return (
    <div className="ks-edit-canvas">
      <StageHeader
        title={typeof config.title === "string" ? config.title : ""}
        prompt={typeof config.prompt === "string" ? config.prompt : ""}
        promptRequired
        onPatch={(patch) => onChange({ ...config, ...patch })}
      />
      <p className="ks-edit-canvas__hint">
        Click the image to drop a target. Drag to reposition. Right-click for stacking.
        <kbd>Delete</kbd> removes the selected target. Labels are edited in the form on the
        right — they reference targets by id.
      </p>
      <div
        ref={boardRef}
        className="ks-edit-canvas__board is-dropping"
        style={{ backgroundImage: config.image?.src ? `url(${config.image.src})` : undefined }}
        onPointerDown={startBoardDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {config.targets.map((t) => {
          const pos = livePos && livePos.id === t.id ? livePos.position : t.position;
          const style: CSSProperties = {
            left: `${pos.x * 100}%`,
            top: `${pos.y * 100}%`,
          };
          const isSelected = t.id === selectedId;
          const isThisDragging = drag.kind === "move" && drag.targetId === t.id;
          return (
            <div
              key={t.id}
              className={[
                "ks-edit-point",
                isSelected ? "is-selected" : "",
                isThisDragging ? "is-dragging" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={style}
              onPointerDown={startTargetMove(t.id)}
              onContextMenu={openContextMenu(t.id)}
              title={labelByTarget.get(t.id) ?? t.id}
            >
              <span aria-hidden="true">{labelShort(labelByTarget.get(t.id) ?? t.id)}</span>
            </div>
          );
        })}
      </div>
      {menu ? (
        <ContextMenu
          pos={menu.pos}
          index={config.targets.findIndex((t) => t.id === menu.id)}
          length={config.targets.length}
          onAction={(op) => applyZOrder(menu.id, op)}
          onDelete={() => deleteTarget(menu.id)}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  );
}

function labelShort(text: string): string {
  const t = text.trim();
  if (t.length <= 3) return t.toUpperCase();
  const words = t.split(/\s+/).filter((w) => w.length > 0);
  if (words.length >= 2) {
    const a = words[0]?.[0] ?? "";
    const b = words[1]?.[0] ?? "";
    return (a + b).toUpperCase();
  }
  return t.slice(0, 2).toUpperCase();
}
