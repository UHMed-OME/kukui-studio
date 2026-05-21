import { useEffect, useRef, useState } from "react";
import type { DragAndDropConfig } from "@kukui/schemas";
import { DnDActivity, type DnDActivityProps } from "./DnDActivity.js";
import type { State } from "./state.js";

/**
 * Tap-to-place wrapper. No DndContext is mounted in this layer — the
 * Chip and Zone components handle their own onClick / onKeyDown
 * (Space/Enter) handlers. The reason for the wrapper to exist at all
 * is the aria-live announcer: it watches `state` transitions and
 * announces "Chip X selected", "Placed X in Zone Y", etc.
 */

type TapLayerProps = Omit<DnDActivityProps, "announcerSlot"> & {
  config: DragAndDropConfig;
};

function chipLabel(config: DragAndDropConfig, id: string | null): string {
  if (!id) return "";
  return config.draggables.find((d) => d.id === id)?.label ?? id;
}

function zoneLabel(config: DragAndDropConfig, id: string | null): string {
  if (!id) return "";
  const z = config.dropZones.find((z) => z.id === id);
  return z?.label ?? id;
}

export function TapLayer(props: TapLayerProps) {
  const { config, state } = props;
  const prev = useRef<State>(state);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const before = prev.current;
    prev.current = state;

    // Selection change.
    if (before.selectedChipId !== state.selectedChipId) {
      if (state.selectedChipId) {
        setMessage(
          `Label "${chipLabel(config, state.selectedChipId)}" selected. Tap a zone to place.`,
        );
        return;
      }
      // Selection cleared without a placement — happens on toggle.
      if (
        before.selectedChipId &&
        JSON.stringify(before.placement) === JSON.stringify(state.placement)
      ) {
        setMessage(`Label "${chipLabel(config, before.selectedChipId)}" deselected.`);
        return;
      }
    }

    // Placement change. Find chips whose zone changed.
    for (const chipId of Object.keys(state.placement)) {
      const was = before.placement[chipId] ?? null;
      const now = state.placement[chipId] ?? null;
      if (was === now) continue;
      if (now) {
        setMessage(
          `Placed "${chipLabel(config, chipId)}" in "${zoneLabel(config, now)}".`,
        );
      } else {
        setMessage(`Lifted "${chipLabel(config, chipId)}" back to the tray.`);
      }
      return;
    }
  }, [state, config]);

  return (
    <DnDActivity
      {...props}
      announcerSlot={
        <div
          className="kukui-dnd__sr-only"
          aria-live="polite"
          aria-atomic="true"
          role="status"
        >
          {message}
        </div>
      }
    />
  );
}
