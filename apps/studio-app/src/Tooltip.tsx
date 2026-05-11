import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Tooltip with an ⓘ button trigger and a bubble that rides in a portal
 * to document.body. The portal is essential — without it, the bubble
 * gets clipped by any ancestor with `overflow: hidden` (Studio's panel
 * and header containers both do), and z-index battles with overlay
 * UIs. Portalling sidesteps both problems.
 *
 * Position: computed from the trigger's getBoundingClientRect on hover
 * and focus, with a small flip so the bubble swaps top/bottom when it
 * would overflow the viewport. Re-runs on scroll and resize while the
 * tooltip is open so it stays anchored.
 */
export function Tooltip({
  text,
  label,
  className,
}: {
  text: ReactNode;
  /** aria-label on the trigger button. Default: "More information". */
  label?: string;
  className?: string;
}) {
  const id = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; placement: "top" | "bottom" } | null>(null);

  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const btn = btnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      // Default: bubble sits above the trigger (placement = "top"). If
      // there's not enough room above, flip below.
      const placement = r.top < 56 ? "bottom" : "top";
      setPosition({
        top: placement === "top" ? r.top - 8 : r.bottom + 8,
        left: r.left + r.width / 2,
        placement,
      });
    };
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  // Close on Escape so a keyboard user can dismiss without moving focus.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <span className={["kukui-tooltip", className].filter(Boolean).join(" ")}>
      <button
        ref={btnRef}
        type="button"
        className="kukui-tooltip__btn"
        aria-label={label ?? "More information"}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
      >
        ⓘ
      </button>
      {open && position
        ? createPortal(
            <span
              id={id}
              role="tooltip"
              className={[
                "kukui-tooltip__bubble",
                `kukui-tooltip__bubble--${position.placement}`,
              ].join(" ")}
              style={{
                top: position.top,
                left: position.left,
              }}
            >
              {text}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
