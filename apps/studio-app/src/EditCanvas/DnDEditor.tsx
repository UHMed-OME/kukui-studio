import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import type { DragAndDropConfig } from "@kukui/schemas";
import { ContextMenu, type ContextMenuPos } from "./ContextMenu.js";
import { DnDChipPanel } from "./DnDChipPanel.js";
import { DnDLinkOverlay } from "./DnDLinkOverlay.js";
import { reorder, roundCoord, type ZOrderOp } from "./zorder.js";

const roundRect = <T extends { x: number; y: number; w: number; h: number }>(r: T): T => ({
  ...r,
  x: roundCoord(r.x),
  y: roundCoord(r.y),
  w: roundCoord(r.w),
  h: roundCoord(r.h),
});

type Rect = DragAndDropConfig["dropZones"][number]["rect"];

type DragState =
  | { kind: "idle" }
  | { kind: "draw"; pointerId: number; startX: number; startY: number; rect: Rect }
  | {
      kind: "move";
      pointerId: number;
      zoneId: string;
      offsetX: number;
      offsetY: number;
      rect: Rect;
    }
  | {
      kind: "resize";
      pointerId: number;
      zoneId: string;
      anchorX: number;
      anchorY: number;
      rect: Rect;
    };

const MIN_RECT = 0.02;

const DEFAULT_NEW_ZONE_ID = (existing: string[]): string => {
  let i = existing.length + 1;
  while (existing.includes(`z-${i}`)) i += 1;
  return `z-${i}`;
};

/**
 * Drag-and-Drop visual editor.
 *
 * Draw on the board to create zones, drag to move, corner handle to resize,
 * ✕ or Delete to remove. The dragged zone is tracked in local state during
 * the gesture, so the cursor stays glued to the element regardless of how
 * slow the upstream form re-render is. The committed state is emitted via
 * onChange on pointer-up only — the schema-form pane updates once per
 * gesture instead of once per frame.
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
  const [selectedChipId, setSelectedChipId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; pos: ContextMenuPos } | null>(null);
  const [dropTargetZoneId, setDropTargetZoneId] = useState<string | null>(null);

  // Local override for the zone currently being dragged. Lets the visible
  // element track the cursor at the device's refresh rate without bouncing
  // through the parent state.
  const liveRect: { id: string; rect: Rect } | null =
    drag.kind === "move" || drag.kind === "resize"
      ? { id: drag.zoneId, rect: drag.rect }
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

  const startDrawZone = (e: PointerEvent<HTMLDivElement>) => {
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

  const startMoveZone = (zoneId: string) => (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const zone = config.dropZones.find((z) => z.id === zoneId);
    if (!zone) return;
    const { x, y } = toNormalized(e.clientX, e.clientY);
    setSelectedId(zoneId);
    setDrag({
      kind: "move",
      pointerId: e.pointerId,
      zoneId,
      offsetX: x - zone.rect.x,
      offsetY: y - zone.rect.y,
      rect: zone.rect,
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
      pointerId: e.pointerId,
      zoneId,
      anchorX: zone.rect.x,
      anchorY: zone.rect.y,
      rect: zone.rect,
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
        const id = DEFAULT_NEW_ZONE_ID(config.dropZones.map((z) => z.id));
        onChange({
          ...config,
          dropZones: [
            ...config.dropZones,
            { id, label: `Zone ${config.dropZones.length + 1}`, rect: roundRect(drag.rect) },
          ],
        });
        setSelectedId(id);
      }
    } else if (drag.kind === "move" || drag.kind === "resize") {
      const next = roundRect(drag.rect);
      onChange({
        ...config,
        dropZones: config.dropZones.map((z) =>
          z.id === drag.zoneId ? { ...z, rect: next } : z,
        ),
      });
    }
    setDrag({ kind: "idle" });
  };

  // Keyboard: Delete / Backspace removes the selected zone (when not typing
  // into an input). Esc deselects.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (selectedId && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        deleteZone(selectedId);
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const deleteZone = (zoneId: string) => {
    onChange({ ...config, dropZones: config.dropZones.filter((z) => z.id !== zoneId) });
    setSelectedId(null);
  };

  const openContextMenu = (zoneId: string) => (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(zoneId);
    setMenu({ id: zoneId, pos: { x: e.clientX, y: e.clientY } });
  };

  const applyZOrder = (zoneId: string, op: ZOrderOp) => {
    const index = config.dropZones.findIndex((z) => z.id === zoneId);
    if (index < 0) return;
    onChange({ ...config, dropZones: reorder(config.dropZones, index, op) });
  };

  const isDragging = drag.kind !== "idle";

  // Drag-from-side-panel → drop-on-zone. When the author drags a chip
  // row from the panel and drops it on a zone here, the dragged chip's
  // correctZones gets the zone's id appended. Lighter than reworking
  // the pointer-based geometry editor; HTML5 drag uses different
  // events so the two flows don't collide.
  const handleZoneDragOver = (zoneId: string) => (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes("application/x-kukui-chip")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "link";
    if (dropTargetZoneId !== zoneId) setDropTargetZoneId(zoneId);
  };

  const handleZoneDragLeave = () => {
    setDropTargetZoneId(null);
  };

  const handleZoneDrop = (zoneId: string) => (e: DragEvent<HTMLDivElement>) => {
    const chipId = e.dataTransfer.getData("application/x-kukui-chip");
    setDropTargetZoneId(null);
    if (!chipId) return;
    e.preventDefault();
    const chip = config.draggables.find((d) => d.id === chipId);
    if (!chip || chip.correctZones.includes(zoneId)) return;
    onChange({
      ...config,
      draggables: config.draggables.map((d) =>
        d.id === chipId ? { ...d, correctZones: [...d.correctZones, zoneId] } : d,
      ),
    });
    setSelectedChipId(chipId);
  };

  const handleZoneClick = (zoneId: string) => {
    setSelectedId((cur) => (cur === zoneId ? null : zoneId));
  };

  return (
    <div className="ks-edit-dnd">
      <p className="ks-edit-dnd__hint">
        Drag on the background to draw a zone. Click a zone to select; drag to move, corner
        handle to resize, ✕ or <kbd>Delete</kbd> to remove. Right-click a zone for stacking
        options. Drag a chip from the side panel onto a zone to link them.
      </p>
      <div className="ks-edit-dnd__layout">
        <div
          ref={boardRef}
          className={["ks-edit-dnd__board", isDragging ? "is-dragging" : ""]
            .filter(Boolean)
            .join(" ")}
          style={{
            backgroundImage: config.background?.src
              ? `url(${config.background.src})`
              : undefined,
          }}
          onPointerDown={startDrawZone}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {config.dropZones.map((z) => {
            // If this zone is currently being dragged, render with the live
            // rect so the element tracks the cursor 1:1.
            const rect = liveRect && liveRect.id === z.id ? liveRect.rect : z.rect;
            const style: CSSProperties = {
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.w * 100}%`,
              height: `${rect.h * 100}%`,
            };
            const isSelected = z.id === selectedId;
            const isThisDragging =
              drag.kind !== "idle" && "zoneId" in drag && drag.zoneId === z.id;
            const isDropTarget = dropTargetZoneId === z.id;
            return (
              <div
                key={z.id}
                className={[
                  "ks-edit-dnd__zone",
                  isSelected ? "is-selected" : "",
                  isThisDragging ? "is-dragging" : "",
                  isDropTarget ? "is-drop-target" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={style}
                onPointerDown={startMoveZone(z.id)}
                onClick={(e) => {
                  // Only treat as zone-selection click if we're not in
                  // the middle of a geometry drag.
                  if (drag.kind === "idle") {
                    e.stopPropagation();
                    handleZoneClick(z.id);
                  }
                }}
                onContextMenu={openContextMenu(z.id)}
                onDragOver={handleZoneDragOver(z.id)}
                onDragLeave={handleZoneDragLeave}
                onDrop={handleZoneDrop(z.id)}
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
              className="ks-edit-dnd__draft"
              style={{
                left: `${drag.rect.x * 100}%`,
                top: `${drag.rect.y * 100}%`,
                width: `${drag.rect.w * 100}%`,
                height: `${drag.rect.h * 100}%`,
              }}
            />
          ) : null}
          <DnDLinkOverlay
            config={config}
            selectedChipId={selectedChipId}
            selectedZoneId={selectedId}
          />
        </div>
        <DnDChipPanel
          config={config}
          onChange={onChange}
          selectedChipId={selectedChipId}
          onSelectChip={setSelectedChipId}
          selectedZoneId={selectedId}
        />
      </div>
      {menu ? (
        <ContextMenu
          pos={menu.pos}
          index={config.dropZones.findIndex((z) => z.id === menu.id)}
          length={config.dropZones.length}
          onAction={(op) => applyZOrder(menu.id, op)}
          onDelete={() => deleteZone(menu.id)}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  );
}
