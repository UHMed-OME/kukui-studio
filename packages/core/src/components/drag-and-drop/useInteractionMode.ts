import { useEffect, useState } from "react";

/**
 * Effective interaction mode for the DnD activity. Two values:
 *  - "drag": @dnd-kit DndContext is mounted, chips support useDraggable.
 *  - "tap":  chips/zones use click + keyboard handlers only.
 *
 * Detection rules (in priority order):
 *  1. Author override (`override` arg) wins if not "auto" or undefined.
 *  2. Below the mobile breakpoint (760 px) the mode is always "tap" —
 *     drag fights page scroll on phones.
 *  3. Otherwise: the first observed `pointermove` event decides. Mouse
 *     and pen pointer types → "drag". Touch → "tap". The listener
 *     unregisters after firing once, so the mode is stable for the
 *     session.
 *
 * Default before the first event: "drag" on desktops, "tap" on mobile.
 * Most users are on mouse — defaulting to drag means no flicker for the
 * common path.
 */

export type InteractionMode = "drag" | "tap";

const MOBILE_BREAKPOINT_PX = 760;

function isMobileWidth(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < MOBILE_BREAKPOINT_PX;
}

export function useInteractionMode(
  override?: "drag" | "tap" | "auto",
): InteractionMode {
  // Initial mode: respect override if absolute; otherwise default
  // based on viewport width.
  const compute = (): InteractionMode => {
    if (override === "drag" || override === "tap") return override;
    return isMobileWidth() ? "tap" : "drag";
  };
  const [mode, setMode] = useState<InteractionMode>(compute);

  // Re-sync when the override changes (e.g. author flips it in Studio
  // Preview) or when the viewport crosses the breakpoint.
  useEffect(() => {
    setMode(compute());
    // Listen for viewport resize crossings — only relevant when there's
    // no absolute override.
    if (override === "drag" || override === "tap") return;
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    const onChange = () => setMode(compute());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [override]);

  // Pointer-type detection. Only runs when override is "auto" or
  // undefined AND we're above the mobile breakpoint — otherwise the
  // mode is forced by other rules and the listener would be useless.
  useEffect(() => {
    if (override === "drag" || override === "tap") return;
    if (typeof window === "undefined") return;
    if (isMobileWidth()) return;

    const onMove = (e: PointerEvent) => {
      // First pointermove decides for the session.
      window.removeEventListener("pointermove", onMove);
      if (e.pointerType === "touch") {
        setMode("tap");
      } else {
        // mouse or pen → drag
        setMode("drag");
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [override]);

  return mode;
}
