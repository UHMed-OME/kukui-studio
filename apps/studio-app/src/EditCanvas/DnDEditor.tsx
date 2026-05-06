import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { DragAndDropConfig } from "@kukui/schemas";

type Rect = DragAndDropConfig["dropZones"][number]["rect"];

type DragState =
  | { kind: "idle" }
  | { kind: "draw"; startX: number; startY: number; rect: Rect }
  | { kind: "move"; zoneId: string; offsetX: number; offsetY: number }
  | { kind: "resize"; zoneId: string; anchorX: number; anchorY: number };

const DEFAULT_NEW_ZONE_ID = (existing: string[]): string => {
  let i = existing.length + 1;
  while (existing.includes(`z-${i}`)) i += 1;
  return `z-${i}`;
};

/**
 * Drag-and-Drop visual editor.
 *
 * Click-and-drag on empty space draws a new drop zone. Click a zone to
 * select it. Drag a selected zone to move it. Drag the corner handle to
 * resize. ✕ on a selected zone deletes it. All edits flow through onChange
 * back to the form's value, so the schema-form pane stays in sync.
 */
export function DnDEditor({
  config,
  onChange,
}: {
  config: DragAndDropConfig;
  onChange: (next: DragAndDropConfig) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState>({ kind: "idle" });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const board = boardRef.current;

  const toNormalized = (clientX: number, clientY: number) => {
    if (!board) return { x: 0, y: 0 };
    const r = board.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (clientY - r.top) / r.height)),
    };
  };

  const startDrawZone = (e: PointerEvent<HTMLDivElement>) => {
    if (e.target !== boardRef.current) return; // only when clicking blank board
    const { x, y } = toNormalized(e.clientX, e.clientY);
    setSelectedId(null);
    setDrag({ kind: "draw", startX: x, startY: y, rect: { x, y, w: 0, h: 0 } });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const startMoveZone = (zoneId: string) => (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const zone = config.dropZones.find((z) => z.id === zoneId);
    if (!zone) return;
    const { x, y } = toNormalized(e.clientX, e.clientY);
    setSelectedId(zoneId);
    setDrag({
      kind: "move",
      zoneId,
      offsetX: x - zone.rect.x,
      offsetY: y - zone.rect.y,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const startResizeZone = (zoneId: string) => (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const zone = config.dropZones.find((z) => z.id === zoneId);
    if (!zone) return;
    setSelectedId(zoneId);
    setDrag({
      kind: "resize",
      zoneId,
      anchorX: zone.rect.x,
      anchorY: zone.rect.y,
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
    } else if (drag.kind === "move") {
      const zone = config.dropZones.find((z) => z.id === drag.zoneId);
      if (!zone) return;
      const newX = Math.max(0, Math.min(1 - zone.rect.w, x - drag.offsetX));
      const newY = Math.max(0, Math.min(1 - zone.rect.h, y - drag.offsetY));
      onChange({
        ...config,
        dropZones: config.dropZones.map((z) =>
          z.id === drag.zoneId ? { ...z, rect: { ...z.rect, x: newX, y: newY } } : z,
        ),
      });
    } else if (drag.kind === "resize") {
      const w = Math.max(0.02, x - drag.anchorX);
      const h = Math.max(0.02, y - drag.anchorY);
      onChange({
        ...config,
        dropZones: config.dropZones.map((z) =>
          z.id === drag.zoneId ? { ...z, rect: { ...z.rect, w, h } } : z,
        ),
      });
    }
  };

  const handlePointerUp = () => {
    if (drag.kind === "draw") {
      // Commit the drawn rect as a new zone, but only if it has size.
      if (drag.rect.w >= 0.02 && drag.rect.h >= 0.02) {
        const id = DEFAULT_NEW_ZONE_ID(config.dropZones.map((z) => z.id));
        onChange({
          ...config,
          dropZones: [
            ...config.dropZones,
            { id, label: `Zone ${config.dropZones.length + 1}`, rect: drag.rect },
          ],
        });
        setSelectedId(id);
      }
    }
    setDrag({ kind: "idle" });
  };

  const deleteZone = (zoneId: string) => {
    onChange({ ...config, dropZones: config.dropZones.filter((z) => z.id !== zoneId) });
    setSelectedId(null);
  };

  return (
    <div className="ks-edit-dnd">
      <p className="ks-edit-dnd__hint">
        Drag on the background to draw a drop zone. Click a zone to select it; drag to move; drag
        the corner handle to resize; ✕ to delete. The schema form on the left updates as you go.
      </p>
      <div
        ref={boardRef}
        className="ks-edit-dnd__board"
        style={{
          backgroundImage: config.background.src ? `url(${config.background.src})` : undefined,
        }}
        onPointerDown={startDrawZone}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {config.dropZones.map((z) => {
          const style: CSSProperties = {
            left: `${z.rect.x * 100}%`,
            top: `${z.rect.y * 100}%`,
            width: `${z.rect.w * 100}%`,
            height: `${z.rect.h * 100}%`,
          };
          const isSelected = z.id === selectedId;
          return (
            <div
              key={z.id}
              className={["ks-edit-dnd__zone", isSelected ? "is-selected" : ""]
                .filter(Boolean)
                .join(" ")}
              style={style}
              onPointerDown={startMoveZone(z.id)}
            >
              <span className="ks-edit-dnd__zone-label">{z.label ?? z.id}</span>
              {isSelected ? (
                <>
                  <button
                    type="button"
                    className="ks-edit-dnd__delete"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteZone(z.id);
                    }}
                    aria-label={`Delete zone ${z.label ?? z.id}`}
                  >
                    ✕
                  </button>
                  <div
                    className="ks-edit-dnd__handle ks-edit-dnd__handle--se"
                    onPointerDown={startResizeZone(z.id)}
                    aria-label="Resize"
                  />
                </>
              ) : null}
            </div>
          );
        })}
        {drag.kind === "draw" && drag.rect.w > 0 && drag.rect.h > 0 ? (
          <div
            className="ks-edit-dnd__draft"
            style={{
              left: `${drag.rect.x * 100}%`,
              top: `${drag.rect.y * 100}%`,
              width: `${drag.rect.w * 100}%`,
              height: `${drag.rect.h * 100}%`,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
