import type { CSSProperties, KeyboardEvent } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { DragAndDropConfig } from "@kukui/schemas";

/**
 * A single chip — used both in the tray and inside zones (when placed).
 *
 * The chip is always a `<button>` so keyboard users can Tab to it and
 * activate via Space/Enter. The same DOM is used for drag and tap
 * modes — the difference is just whether we hand the `useDraggable`
 * listeners to it (drag) or attach onClick / onKeyDown (tap).
 *
 * In drag mode the chip itself follows the cursor — dnd-kit's
 * `transform` value is applied to the button's inline style. This
 * sidesteps the DragOverlay portal entirely. The overlay path had
 * recurring "ghost invisible, can't drop" reports because the
 * portal's positioning context could collapse the ghost to 0 width
 * in some layouts; moving the source itself is unambiguous.
 */

type ChipProps = {
  chip: DragAndDropConfig["draggables"][number];
  /** "tray" when sitting in the tray, "placed" when inside a zone. */
  location: "tray" | "placed";
  /** Active interaction mode. */
  mode: "drag" | "tap";
  /** Whether this chip is the tap-to-place selection. */
  selected: boolean;
  /** Whether the board is locked (submitted / showing-solution). */
  locked: boolean;
  /** Post-submit correctness — only meaningful when locked is true. */
  correct?: boolean;
  /** Click / Space / Enter: select or deselect (tap mode). */
  onSelect?: () => void;
  /** Per-zone solutions animation: temporary transform override. */
  style?: CSSProperties;
  /** id attribute on the rendered button — used to drive focus on select. */
  domId?: string;
};

export function Chip({
  chip,
  location,
  mode,
  selected,
  locked,
  correct,
  onSelect,
  style,
  domId,
}: ChipProps) {
  // Always register with dnd-kit so the draggable identity exists when
  // DndContext is mounted. In tap mode there is no DndContext, so the
  // hook degrades to a no-op — useDraggable handles a missing context
  // by returning null listeners.
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: chip.id,
    disabled: locked || mode !== "drag",
  });

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (mode !== "tap" || locked) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onSelect?.();
    }
  };

  const handleClick = () => {
    if (locked) return;
    if (mode === "tap") onSelect?.();
  };

  const className = [
    "kukui-dnd__chip",
    location === "placed" ? "is-placed" : "",
    locked && correct === true ? "is-correct" : "",
    locked && correct === false && location === "placed" ? "is-incorrect" : "",
    isDragging ? "is-dragging" : "",
    selected ? "is-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Compose dnd-kit listeners only in drag mode; bare button otherwise.
  const dragProps = mode === "drag" ? { ...listeners, ...attributes } : {};

  // While dragging, translate the chip so it follows the cursor. dnd-kit
  // hands us a transform `{x, y}` derived from the pointer delta; the
  // `CSS.Translate.toString` helper formats it as a translate3d() so we
  // get GPU-accelerated motion. When idle, transform is null and the
  // outer style (e.g., solutions animation) wins.
  const dragStyle: CSSProperties =
    mode === "drag" && transform
      ? { transform: CSS.Translate.toString(transform), ...style }
      : (style ?? {});

  return (
    <button
      ref={setNodeRef}
      id={domId}
      type="button"
      className={className}
      disabled={locked}
      aria-pressed={mode === "tap" ? selected : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={dragStyle}
      {...dragProps}
    >
      <span className="kukui-dnd__chip-label">{chip.label}</span>
      {locked && location === "placed" ? (
        <span className="kukui-dnd__chip-icon" aria-hidden="true">
          {correct ? "✓" : "✗"}
        </span>
      ) : null}
    </button>
  );
}
