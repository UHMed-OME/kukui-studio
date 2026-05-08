import { useEffect, useRef } from "react";
import { ZORDER_LABELS, isOpEnabled, type ZOrderOp } from "./zorder.js";

export type ContextMenuPos = { x: number; y: number };

/**
 * Right-click context menu shown on a selected element in any 2D placement
 * editor. Z-order operations reorder the underlying array; Delete is offered
 * as a convenience so authors don't need the keyboard.
 *
 * Closes on outside click, Escape, or after any action fires.
 */
export function ContextMenu({
  pos,
  index,
  length,
  onAction,
  onDelete,
  onClose,
}: {
  pos: ContextMenuPos;
  index: number;
  length: number;
  onAction: (op: ZOrderOp) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  const ops: ZOrderOp[] = ["front", "forward", "backward", "back"];

  return (
    <ul
      ref={ref}
      className="ks-ctx-menu"
      role="menu"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {ops.map((op) => {
        const enabled = isOpEnabled(op, index, length);
        return (
          <li key={op}>
            <button
              type="button"
              role="menuitem"
              className="ks-ctx-menu__btn"
              disabled={!enabled}
              onClick={() => {
                onAction(op);
                onClose();
              }}
            >
              {ZORDER_LABELS[op]}
            </button>
          </li>
        );
      })}
      <li className="ks-ctx-menu__sep" role="separator" />
      <li>
        <button
          type="button"
          role="menuitem"
          className="ks-ctx-menu__btn ks-ctx-menu__btn--danger"
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          Delete
        </button>
      </li>
    </ul>
  );
}
