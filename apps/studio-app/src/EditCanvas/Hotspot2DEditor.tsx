import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from "react";
import type { Hotspot2DConfig } from "@kukui/schemas";
import { ContextMenu, type ContextMenuPos } from "./ContextMenu.js";
import { StageHeader } from "./StageHeader.js";
import { reorder, roundCoord, type ZOrderOp } from "./zorder.js";
import {
  minNormalized,
  enforceMinRect,
  rectMaxPx,
  DRAG_THRESHOLD_PX,
} from "./minRect.js";

const roundRect = <T extends { x: number; y: number; w: number; h: number }>(r: T): T => ({
  ...r,
  x: roundCoord(r.x),
  y: roundCoord(r.y),
  w: roundCoord(r.w),
  h: roundCoord(r.h),
});

type Rect = Hotspot2DConfig["hotspots"][number]["rect"];

type DragState =
  | { kind: "idle" }
  | { kind: "draw"; pointerId: number; startX: number; startY: number; rect: Rect }
  | {
      kind: "move";
      pointerId: number;
      hotspotId: string;
      offsetX: number;
      offsetY: number;
      rect: Rect;
    }
  | {
      kind: "resize";
      pointerId: number;
      hotspotId: string;
      anchorX: number;
      anchorY: number;
      rect: Rect;
    };

const newHotspotId = (existing: string[]): string => {
  let i = existing.length + 1;
  while (existing.includes(`h-${i}`)) i += 1;
  return `h-${i}`;
};

/**
 * Visual editor for Hotspot 2D. Same gesture model as DnDEditor but each
 * hotspot is also flagged correct/incorrect — that toggle lives on the
 * selected element so the visual state matches the form.
 */
export function Hotspot2DEditor({
  config,
  onChange,
}: {
  config: Hotspot2DConfig;
  onChange: (next: Hotspot2DConfig) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState>({ kind: "idle" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; pos: ContextMenuPos } | null>(null);

  const liveRect: { id: string; rect: Rect } | null =
    drag.kind === "move" || drag.kind === "resize"
      ? { id: drag.hotspotId, rect: drag.rect }
      : null;

  const toNormalized = (clientX: number, clientY: number) => {
    const board = boardRef.current;
    if (!board) return { x: 0, y: 0 };
    const r = board.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (clientY - r.top) / r.height)),
    };
  };

  const startDraw = (e: PointerEvent<HTMLDivElement>) => {
    if (e.target !== boardRef.current) return;
    const { x, y } = toNormalized(e.clientX, e.clientY);
    setSelectedId(null);
    setDrag({
      kind: "draw",
      pointerId: e.pointerId,
      startX: x,
      startY: y,
      rect: { x, y, w: 0, h: 0 },
    });
    boardRef.current?.setPointerCapture(e.pointerId);
  };

  const startMove = (hotspotId: string) => (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const h = config.hotspots.find((x) => x.id === hotspotId);
    if (!h) return;
    const { x, y } = toNormalized(e.clientX, e.clientY);
    setSelectedId(hotspotId);
    setDrag({
      kind: "move",
      pointerId: e.pointerId,
      hotspotId,
      offsetX: x - h.rect.x,
      offsetY: y - h.rect.y,
      rect: h.rect,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const startResize = (hotspotId: string) => (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const h = config.hotspots.find((x) => x.id === hotspotId);
    if (!h) return;
    setSelectedId(hotspotId);
    setDrag({
      kind: "resize",
      pointerId: e.pointerId,
      hotspotId,
      anchorX: h.rect.x,
      anchorY: h.rect.y,
      rect: h.rect,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.kind === "idle") return;
    const { x, y } = toNormalized(e.clientX, e.clientY);

    if (drag.kind === "draw") {
      setDrag({
        ...drag,
        rect: {
          x: Math.min(drag.startX, x),
          y: Math.min(drag.startY, y),
          w: Math.abs(x - drag.startX),
          h: Math.abs(y - drag.startY),
        },
      });
      return;
    }

    if (drag.kind === "move") {
      const newX = Math.max(0, Math.min(1 - drag.rect.w, x - drag.offsetX));
      const newY = Math.max(0, Math.min(1 - drag.rect.h, y - drag.offsetY));
      setDrag({ ...drag, rect: { ...drag.rect, x: newX, y: newY } });
      return;
    }

    if (drag.kind === "resize") {
      const { mw, mh } = minNormalized(boardRef.current);
      const w = Math.max(mw, x - drag.anchorX);
      const h = Math.max(mh, y - drag.anchorY);
      setDrag({ ...drag, rect: { x: drag.anchorX, y: drag.anchorY, w, h } });
    }
  };

  const handlePointerUp = () => {
    if (drag.kind === "draw") {
      if (rectMaxPx(boardRef.current, drag.rect) >= DRAG_THRESHOLD_PX) {
        const { mw, mh } = minNormalized(boardRef.current);
        const id = newHotspotId(config.hotspots.map((h) => h.id));
        onChange({
          ...config,
          hotspots: [
            ...config.hotspots,
            {
              id,
              label: `Region ${config.hotspots.length + 1}`,
              rect: roundRect(enforceMinRect(drag.rect, mw, mh)),
              correct: config.hotspots.length === 0,
            },
          ],
        });
        setSelectedId(id);
      }
    } else if (drag.kind === "move" || drag.kind === "resize") {
      const next = roundRect(drag.rect);
      onChange({
        ...config,
        hotspots: config.hotspots.map((h) =>
          h.id === drag.hotspotId ? { ...h, rect: next } : h,
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
        deleteHotspot(selectedId);
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const deleteHotspot = (hotspotId: string) => {
    onChange({ ...config, hotspots: config.hotspots.filter((h) => h.id !== hotspotId) });
    setSelectedId(null);
  };

  const toggleCorrect = (hotspotId: string) => {
    onChange({
      ...config,
      hotspots: config.hotspots.map((h) =>
        h.id === hotspotId ? { ...h, correct: !h.correct } : h,
      ),
    });
  };

  const openContextMenu = (hotspotId: string) => (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(hotspotId);
    setMenu({ id: hotspotId, pos: { x: e.clientX, y: e.clientY } });
  };

  const applyZOrder = (hotspotId: string, op: ZOrderOp) => {
    const index = config.hotspots.findIndex((h) => h.id === hotspotId);
    if (index < 0) return;
    onChange({ ...config, hotspots: reorder(config.hotspots, index, op) });
  };

  const isDragging = drag.kind !== "idle";

  return (
    <div className="ks-edit-canvas">
      <StageHeader
        title={typeof config.title === "string" ? config.title : ""}
        prompt={typeof config.prompt === "string" ? config.prompt : ""}
        promptRequired
        onPatch={(patch) => onChange({ ...config, ...patch })}
      />
      <p className="ks-edit-canvas__hint">
        Drag on the image to draw a hotspot. Click to select; drag to move, corner handle to
        resize. Toggle <em>Correct</em> on a selected hotspot. Right-click a hotspot for
        stacking options. <kbd>Delete</kbd> removes the selected hotspot.
      </p>
      <div
        ref={boardRef}
        className={[
          "ks-edit-canvas__board",
          isDragging ? "is-dragging" : "is-drawing",
        ]
          .filter(Boolean)
          .join(" ")}
        onPointerDown={startDraw}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {config.image?.src ? (
          <img className="ks-edit-canvas__img" src={config.image.src} alt="" draggable={false} />
        ) : null}
        {config.hotspots.map((h) => {
          const rect = liveRect && liveRect.id === h.id ? liveRect.rect : h.rect;
          const style: CSSProperties = {
            left: `${rect.x * 100}%`,
            top: `${rect.y * 100}%`,
            width: `${rect.w * 100}%`,
            height: `${rect.h * 100}%`,
          };
          const isSelected = h.id === selectedId;
          const isThisDragging =
            drag.kind !== "idle" && "hotspotId" in drag && drag.hotspotId === h.id;
          return (
            <div
              key={h.id}
              className={[
                "ks-edit-rect",
                h.correct ? "is-correct" : "",
                isSelected ? "is-selected" : "",
                isThisDragging ? "is-dragging" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={style}
              onPointerDown={startMove(h.id)}
              onContextMenu={openContextMenu(h.id)}
            >
              <span className="ks-edit-rect__label">
                {h.label ?? h.id} {h.correct ? "✓" : ""}
              </span>
              {isSelected ? (
                <>
                  <button
                    type="button"
                    className="ks-edit-rect__correct-toggle"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCorrect(h.id);
                    }}
                    aria-pressed={h.correct}
                  >
                    {h.correct ? "Correct ✓" : "Mark correct"}
                  </button>
                  <div
                    className="ks-edit-rect__handle"
                    onPointerDown={startResize(h.id)}
                    aria-label="Resize"
                    role="button"
                    tabIndex={-1}
                  />
                </>
              ) : null}
            </div>
          );
        })}
        {drag.kind === "draw" && drag.rect.w > 0 && drag.rect.h > 0 ? (
          <div
            className="ks-edit-canvas__draft"
            style={{
              left: `${drag.rect.x * 100}%`,
              top: `${drag.rect.y * 100}%`,
              width: `${drag.rect.w * 100}%`,
              height: `${drag.rect.h * 100}%`,
            }}
          />
        ) : null}
      </div>
      {menu ? (
        <ContextMenu
          pos={menu.pos}
          index={config.hotspots.findIndex((h) => h.id === menu.id)}
          length={config.hotspots.length}
          onAction={(op) => applyZOrder(menu.id, op)}
          onDelete={() => deleteHotspot(menu.id)}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  );
}
