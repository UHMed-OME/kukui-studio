import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";

/**
 * A drop zone — absolutely positioned over the board.
 *
 * In drag mode: registers with @dnd-kit as droppable.
 * In tap mode: the zone is a clickable target. When a chip is selected
 *  in the tray, clicking the zone places it; Space/Enter on a focused
 *  zone does the same.
 *
 * The zone renders as a `<div role="button">` rather than a real
 * `<button>` so it can contain placed `<Chip>` buttons (HTML forbids
 * nested interactive elements). We hand-roll the keyboard semantics:
 * tabindex, Space/Enter handlers, aria-disabled when locked.
 */

type ZoneProps = {
  zoneId: string;
  label?: string;
  showLabel?: boolean;
  style: CSSProperties;
  /** Active interaction mode. */
  mode: "drag" | "tap";
  /** Whether a chip is currently armed for tap-to-place. Drives the
   *  "Place here" affordance and aria-label hint. */
  awaitingPlacement: boolean;
  /** Board locked (submitted / showing-solution) — zone is inert. */
  locked: boolean;
  /** Tap target click handler. Only fires in tap mode + when awaiting. */
  onTap?: () => void;
  children: ReactNode;
  /** ID applied to the zone DOM node for aria-relationships / focus. */
  domId?: string;
};

export function Zone({
  zoneId,
  label,
  showLabel,
  style,
  mode,
  awaitingPlacement,
  locked,
  onTap,
  children,
  domId,
}: ZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `zone:${zoneId}`,
    disabled: locked || mode !== "drag",
  });

  const handleClick = () => {
    if (locked) return;
    if (mode === "tap" && awaitingPlacement) onTap?.();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (locked || mode !== "tap") return;
    if ((e.key === " " || e.key === "Enter") && awaitingPlacement) {
      e.preventDefault();
      onTap?.();
    }
  };

  const className = [
    "kukui-dnd__zone",
    isOver ? "is-over" : "",
    mode === "tap" && awaitingPlacement ? "is-awaiting" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // aria-label: zone label or fallback. When awaiting, include the
  // tap-to-place hint so a screen-reader user knows what activating
  // the button will do.
  const baseLabel = label ?? `Drop zone ${zoneId}`;
  const ariaLabel =
    mode === "tap" && awaitingPlacement
      ? `${baseLabel}. Activate to place the selected chip here.`
      : baseLabel;

  return (
    <div
      ref={setNodeRef}
      id={domId}
      role="button"
      tabIndex={locked ? -1 : 0}
      aria-disabled={locked || undefined}
      className={className}
      style={style}
      aria-label={ariaLabel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {showLabel && label ? (
        <span className="kukui-dnd__zone-label" aria-hidden="true">
          {label}
        </span>
      ) : null}
      {children}
      {mode === "tap" && awaitingPlacement ? (
        <span className="kukui-dnd__zone-cta" aria-hidden="true">
          Place here
        </span>
      ) : null}
    </div>
  );
}
