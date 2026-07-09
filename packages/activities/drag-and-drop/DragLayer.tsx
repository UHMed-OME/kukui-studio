import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { DragAndDropConfig } from "@kukui/schemas";
import { DnDActivity, type DnDActivityProps } from "./DnDActivity.js";

/**
 * Wraps DnDActivity in a real @dnd-kit DndContext.
 *
 * On drag-end, dispatches `place` via the parent's place callback —
 * exactly the same path tap-to-place uses. The chip itself follows
 * the cursor (transform applied in Chip.tsx via dnd-kit's `transform`
 * value), so no DragOverlay portal is needed. Removing the overlay
 * killed an entire class of "ghost is invisible mid-drag" bugs in
 * the studio preview pane.
 */

type DragLayerProps = DnDActivityProps & {
  config: DragAndDropConfig;
  onPlace: (chipId: string, zoneId: string | null) => void;
};

export function DragLayer(props: DragLayerProps) {
  const { onPlace, ...activity } = props;
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  const handleDragEnd = (e: DragEndEvent) => {
    const chipId = String(e.active.id);
    if (!e.over) return;
    const overId = String(e.over.id);
    if (overId === "tray") {
      // Dropped back on the tray: lift the chip out of its zone.
      onPlace(chipId, null);
      return;
    }
    if (overId.startsWith("zone:")) {
      onPlace(chipId, overId.slice("zone:".length));
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <DnDActivity {...activity} />
    </DndContext>
  );
}
