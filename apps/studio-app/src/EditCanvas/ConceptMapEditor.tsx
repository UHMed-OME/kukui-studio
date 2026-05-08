import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from "react";
import type { ConceptMapConfig } from "@kukui/schemas";
import { ContextMenu, type ContextMenuPos } from "./ContextMenu.js";
import { reorder, roundCoord, type ZOrderOp } from "./zorder.js";

const roundPoint = <T extends { x: number; y: number }>(p: T): T => ({
  ...p,
  x: roundCoord(p.x),
  y: roundCoord(p.y),
});

type SeedNode = NonNullable<ConceptMapConfig["seedNodes"]>[number];
type Position = SeedNode["position"];

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
      nodeId: string;
      offsetX: number;
      offsetY: number;
      position: Position;
    };

const MOVE_THRESHOLD = 0.005;

const newNodeId = (existing: string[]): string => {
  let i = existing.length + 1;
  while (existing.includes(`n-${i}`)) i += 1;
  return `n-${i}`;
};

/**
 * Visual editor for Concept Map. The instructor places seed-node positions
 * on the canvas; the labels themselves are edited in the form. Click the
 * empty board to drop a new node, drag any node to reposition, right-click
 * for stacking + delete.
 */
export function ConceptMapEditor({
  config,
  onChange,
}: {
  config: ConceptMapConfig;
  onChange: (next: ConceptMapConfig) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState>({ kind: "idle" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; pos: ContextMenuPos } | null>(null);

  const seedNodes: readonly SeedNode[] = config.seedNodes ?? [];

  const livePos: { id: string; position: Position } | null =
    drag.kind === "move" ? { id: drag.nodeId, position: drag.position } : null;

  const toNormalized = (clientX: number, clientY: number) => {
    const board = boardRef.current;
    if (!board) return { x: 0, y: 0 };
    const r = board.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (clientY - r.top) / r.height)),
    };
  };

  const writeNodes = (next: SeedNode[]) => {
    onChange({ ...config, seedNodes: next });
  };

  const startBoardDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.target !== boardRef.current) return;
    const { x, y } = toNormalized(e.clientX, e.clientY);
    setSelectedId(null);
    setDrag({ kind: "down", pointerId: e.pointerId, startX: x, startY: y, moved: false });
    boardRef.current?.setPointerCapture(e.pointerId);
  };

  const startNodeMove = (nodeId: string) => (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const node = seedNodes.find((n) => n.id === nodeId);
    if (!node) return;
    const { x, y } = toNormalized(e.clientX, e.clientY);
    setSelectedId(nodeId);
    setDrag({
      kind: "move",
      pointerId: e.pointerId,
      nodeId,
      offsetX: x - node.position.x,
      offsetY: y - node.position.y,
      position: node.position,
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
      const id = newNodeId(seedNodes.map((n) => n.id));
      writeNodes([
        ...seedNodes,
        {
          id,
          label: `Concept ${seedNodes.length + 1}`,
          position: roundPoint({ x: drag.startX, y: drag.startY }),
        },
      ]);
      setSelectedId(id);
    } else if (drag.kind === "move") {
      const next = roundPoint(drag.position);
      writeNodes(
        seedNodes.map((n) => (n.id === drag.nodeId ? { ...n, position: next } : n)),
      );
    }
    setDrag({ kind: "idle" });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (selectedId && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        deleteNode(selectedId);
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const deleteNode = (nodeId: string) => {
    writeNodes(seedNodes.filter((n) => n.id !== nodeId));
    setSelectedId(null);
  };

  const openContextMenu = (nodeId: string) => (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(nodeId);
    setMenu({ id: nodeId, pos: { x: e.clientX, y: e.clientY } });
  };

  const applyZOrder = (nodeId: string, op: ZOrderOp) => {
    const index = seedNodes.findIndex((n) => n.id === nodeId);
    if (index < 0) return;
    writeNodes(reorder(seedNodes, index, op));
  };

  return (
    <div className="ks-edit-canvas">
      <p className="ks-edit-canvas__hint">
        Click the canvas to drop a starter node. Drag to reposition. Right-click for stacking.
        <kbd>Delete</kbd> removes the selected node. Labels are edited in the form on the left.
      </p>
      <div
        ref={boardRef}
        className="ks-edit-canvas__board ks-edit-canvas__board--map is-dropping"
        onPointerDown={startBoardDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {seedNodes.map((n) => {
          const pos = livePos && livePos.id === n.id ? livePos.position : n.position;
          const style: CSSProperties = {
            left: `${pos.x * 100}%`,
            top: `${pos.y * 100}%`,
          };
          const isSelected = n.id === selectedId;
          const isThisDragging = drag.kind === "move" && drag.nodeId === n.id;
          return (
            <div
              key={n.id}
              className={[
                "ks-edit-node",
                isSelected ? "is-selected" : "",
                isThisDragging ? "is-dragging" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={style}
              onPointerDown={startNodeMove(n.id)}
              onContextMenu={openContextMenu(n.id)}
            >
              {n.label}
            </div>
          );
        })}
      </div>
      {menu ? (
        <ContextMenu
          pos={menu.pos}
          index={seedNodes.findIndex((n) => n.id === menu.id)}
          length={seedNodes.length}
          onAction={(op) => applyZOrder(menu.id, op)}
          onDelete={() => deleteNode(menu.id)}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  );
}
