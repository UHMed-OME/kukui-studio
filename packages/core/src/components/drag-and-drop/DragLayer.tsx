import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { DragAndDropConfig } from "@kukui/schemas";
import { DnDActivity, type DnDActivityProps } from "./DnDActivity.js";

/**
 * Wraps DnDActivity in a real @dnd-kit DndContext + DragOverlay.
 *
 * On drag-end, dispatches `place` via the parent's place callback —
 * exactly the same path tap-to-place uses. The DragOverlay renders
 * a ghost copy of the dragged chip directly under the cursor (the
 * original chip is hidden via `is-dragging` CSS).
 */

type DragLayerProps = Omit<DnDActivityProps, "trailingSlot"> & {
  config: DragAndDropConfig;
  onPlace: (chipId: string, zoneId: string | null) => void;
};

export function DragLayer(props: DragLayerProps) {
  const { onPlace, ...activity } = props;
  const config = props.config;
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragCancel = () => setActiveId(null);
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const chipId = String(e.active.id);
    if (!e.over) return;
    const overId = String(e.over.id);
    if (overId.startsWith("zone:")) {
      onPlace(chipId, overId.slice("zone:".length));
    }
  };

  const draggablesById = Object.fromEntries(
    config.draggables.map((d) => [d.id, d]),
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <DnDActivity
        {...activity}
        trailingSlot={
          <DragOverlay dropAnimation={null}>
            {activeId ? (
              // Mirror the original chip's DOM exactly (button + label) so
              // the ghost has the same intrinsic sizing as the source. A
              // `<span>` here was collapsing to ~0 width in some flex
              // contexts, making the chip look like it vanished during drag.
              <button
                type="button"
                disabled
                className="kukui-dnd__chip kukui-dnd__chip--ghost"
                aria-hidden="true"
              >
                <span className="kukui-dnd__chip-label">
                  {draggablesById[activeId]?.label ?? ""}
                </span>
              </button>
            ) : null}
          </DragOverlay>
        }
      />
    </DndContext>
  );
}
