import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from "react";
import type { ImageAnnotationConfig } from "@kukui/schemas";
import { ContextMenu, type ContextMenuPos } from "./ContextMenu.js";
import { reorder, roundCoord, type ZOrderOp } from "./zorder.js";

const roundRect = <T extends { x: number; y: number; w: number; h: number }>(r: T): T => ({
  ...r,
  x: roundCoord(r.x),
  y: roundCoord(r.y),
  w: roundCoord(r.w),
  h: roundCoord(r.h),
});

type Annotation = NonNullable<ImageAnnotationConfig["expectedAnnotations"]>[number];
type Rect = Annotation["rect"];

type DragState =
  | { kind: "idle" }
  | { kind: "draw"; pointerId: number; startX: number; startY: number; rect: Rect }
  | {
      kind: "move";
      pointerId: number;
      annotationId: string;
      offsetX: number;
      offsetY: number;
      rect: Rect;
    }
  | {
      kind: "resize";
      pointerId: number;
      annotationId: string;
      anchorX: number;
      anchorY: number;
      rect: Rect;
    };

const MIN_RECT = 0.02;

const newAnnotationId = (existing: string[]): string => {
  let i = existing.length + 1;
  while (existing.includes(`a-${i}`)) i += 1;
  return `a-${i}`;
};

/**
 * Visual editor for Image Annotation. Draws the instructor's expected
 * answer rects (`expectedAnnotations`). The learner-side annotation tools
 * (rectangle/circle/freehand/etc.) are configured in the form, not here.
 */
export function ImageAnnotationEditor({
  config,
  onChange,
}: {
  config: ImageAnnotationConfig;
  onChange: (next: ImageAnnotationConfig) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState>({ kind: "idle" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; pos: ContextMenuPos } | null>(null);

  const annotations: readonly Annotation[] = config.expectedAnnotations ?? [];

  const liveRect: { id: string; rect: Rect } | null =
    drag.kind === "move" || drag.kind === "resize"
      ? { id: drag.annotationId, rect: drag.rect }
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

  const writeAnnotations = (next: Annotation[]) => {
    onChange({ ...config, expectedAnnotations: next });
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

  const startMove = (annotationId: string) => (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const a = annotations.find((x) => x.id === annotationId);
    if (!a) return;
    const { x, y } = toNormalized(e.clientX, e.clientY);
    setSelectedId(annotationId);
    setDrag({
      kind: "move",
      pointerId: e.pointerId,
      annotationId,
      offsetX: x - a.rect.x,
      offsetY: y - a.rect.y,
      rect: a.rect,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const startResize = (annotationId: string) => (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const a = annotations.find((x) => x.id === annotationId);
    if (!a) return;
    setSelectedId(annotationId);
    setDrag({
      kind: "resize",
      pointerId: e.pointerId,
      annotationId,
      anchorX: a.rect.x,
      anchorY: a.rect.y,
      rect: a.rect,
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
      const w = Math.max(MIN_RECT, x - drag.anchorX);
      const h = Math.max(MIN_RECT, y - drag.anchorY);
      setDrag({ ...drag, rect: { x: drag.anchorX, y: drag.anchorY, w, h } });
    }
  };

  const handlePointerUp = () => {
    if (drag.kind === "draw") {
      if (drag.rect.w >= MIN_RECT && drag.rect.h >= MIN_RECT) {
        const id = newAnnotationId(annotations.map((a) => a.id));
        writeAnnotations([
          ...annotations,
          { id, rect: roundRect(drag.rect), label: `Expected ${annotations.length + 1}` },
        ]);
        setSelectedId(id);
      }
    } else if (drag.kind === "move" || drag.kind === "resize") {
      const next = roundRect(drag.rect);
      writeAnnotations(
        annotations.map((a) => (a.id === drag.annotationId ? { ...a, rect: next } : a)),
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
        deleteAnnotation(selectedId);
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const deleteAnnotation = (annotationId: string) => {
    writeAnnotations(annotations.filter((a) => a.id !== annotationId));
    setSelectedId(null);
  };

  const openContextMenu = (annotationId: string) => (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(annotationId);
    setMenu({ id: annotationId, pos: { x: e.clientX, y: e.clientY } });
  };

  const applyZOrder = (annotationId: string, op: ZOrderOp) => {
    const index = annotations.findIndex((a) => a.id === annotationId);
    if (index < 0) return;
    writeAnnotations(reorder(annotations, index, op));
  };

  const isDragging = drag.kind !== "idle";

  return (
    <div className="ks-edit-canvas">
      <p className="ks-edit-canvas__hint">
        Drag on the image to draw an expected-answer region. These are the marks the activity
        will compare learner annotations against. Right-click for stacking. <kbd>Delete</kbd>
        removes the selected mark.
      </p>
      <div
        ref={boardRef}
        className={[
          "ks-edit-canvas__board",
          isDragging ? "is-dragging" : "is-drawing",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ backgroundImage: config.image.src ? `url(${config.image.src})` : undefined }}
        onPointerDown={startDraw}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {annotations.map((a) => {
          const rect = liveRect && liveRect.id === a.id ? liveRect.rect : a.rect;
          const style: CSSProperties = {
            left: `${rect.x * 100}%`,
            top: `${rect.y * 100}%`,
            width: `${rect.w * 100}%`,
            height: `${rect.h * 100}%`,
          };
          const isSelected = a.id === selectedId;
          const isThisDragging =
            drag.kind !== "idle" && "annotationId" in drag && drag.annotationId === a.id;
          return (
            <div
              key={a.id}
              className={[
                "ks-edit-rect",
                isSelected ? "is-selected" : "",
                isThisDragging ? "is-dragging" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={style}
              onPointerDown={startMove(a.id)}
              onContextMenu={openContextMenu(a.id)}
            >
              <span className="ks-edit-rect__label">{a.label ?? a.id}</span>
              {isSelected ? (
                <div
                  className="ks-edit-rect__handle"
                  onPointerDown={startResize(a.id)}
                  aria-label="Resize"
                  role="button"
                  tabIndex={-1}
                />
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
          index={annotations.findIndex((a) => a.id === menu.id)}
          length={annotations.length}
          onAction={(op) => applyZOrder(menu.id, op)}
          onDelete={() => deleteAnnotation(menu.id)}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  );
}
