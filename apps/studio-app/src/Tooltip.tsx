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
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    placement: "top" | "bottom";
    offsetX: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const btn = btnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      // Default: bubble sits above the trigger; flip below if too near
      // the top of the viewport.
      const placement = r.top < 56 ? "bottom" : "top";
      // Centre on the trigger horizontally...
      let left = r.left + r.width / 2;
      let offsetX = 0;
      // ...then clamp to the viewport with an 8 px margin so a bubble
      // anchored near the right or left edge of the screen doesn't
      // overflow. The arrow stays under the trigger via `offsetX`
      // (negative if we slid the bubble left, positive if right).
      const bubble = bubbleRef.current;
      if (bubble) {
        const bw = bubble.offsetWidth;
        const halfBw = bw / 2;
        const min = 8 + halfBw;
        const max = window.innerWidth - 8 - halfBw;
        const clamped = Math.max(min, Math.min(max, left));
        offsetX = clamped - left;
        left = clamped;
      }
      setPosition({
        top: placement === "top" ? r.top - 8 : r.bottom + 8,
        left,
        placement,
        offsetX,
      });
    };
    // First paint of the bubble has no measured width; reposition once
    // to centre, then once more on the next frame after the bubble has
    // mounted so we can read its width and clamp.
    reposition();
    const raf = requestAnimationFrame(reposition);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      cancelAnimationFrame(raf);
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
      {open
        ? createPortal(
            <span
              ref={bubbleRef}
              id={id}
              role="tooltip"
              className={[
                "kukui-tooltip__bubble",
                position
                  ? `kukui-tooltip__bubble--${position.placement}`
                  : "kukui-tooltip__bubble--measuring",
              ].join(" ")}
              style={
                position
                  ? {
                      top: position.top,
                      left: position.left,
                      // CSS uses this to nudge the ::after arrow back
                      // under the trigger when we slid the bubble.
                      ["--kukui-tooltip-arrow-x" as unknown as string]:
                        `${-position.offsetX}px`,
                    }
                  : {
                      // First frame before width measurement — keep
                      // off-screen so the user doesn't see the un-
                      // clamped centre flash.
                      top: -9999,
                      left: -9999,
                    }
              }
            >
              {text}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
