/**
 * Minimum-size helpers shared by the rectangle editors (hotspot-2d,
 * drag-and-drop, image-annotation).
 *
 * Rects are stored normalized (0..1), but "is this big enough to click?" is a
 * pixel question — 2% of a 600px image is 12px, which is impossible to grab or
 * select. So we derive the minimum from the live board size and hold every
 * drawn/resized region to at least a WCAG tap target, regardless of how large
 * the underlying image renders.
 */

/** Min region size in CSS px — WCAG 2.5.5 target size. */
export const MIN_HOTSPOT_PX = 44;
/** Below this drag distance the gesture is treated as a click, not a draw. */
export const DRAG_THRESHOLD_PX = 6;

type Rectish = { x: number; y: number; w: number; h: number };

/**
 * Normalized min width/height for the current board. Clamped to 0.5 so a tiny
 * board can't demand more than half the canvas per region.
 */
export function minNormalized(board: HTMLElement | null): { mw: number; mh: number } {
  const r = board?.getBoundingClientRect();
  const w = r && r.width > 0 ? r.width : 1;
  const h = r && r.height > 0 ? r.height : 1;
  return {
    mw: Math.min(0.5, MIN_HOTSPOT_PX / w),
    mh: Math.min(0.5, MIN_HOTSPOT_PX / h),
  };
}

/** Largest pixel dimension of a normalized rect on the given board. */
export function rectMaxPx(board: HTMLElement | null, rect: { w: number; h: number }): number {
  const r = board?.getBoundingClientRect();
  return Math.max(rect.w * (r?.width ?? 1), rect.h * (r?.height ?? 1));
}

/** Grow a rect to at least (mw, mh), nudging x/y so it stays within 0..1. */
export function enforceMinRect<T extends Rectish>(rect: T, mw: number, mh: number): T {
  const w = Math.min(1, Math.max(rect.w, mw));
  const h = Math.min(1, Math.max(rect.h, mh));
  const x = Math.max(0, Math.min(rect.x, 1 - w));
  const y = Math.max(0, Math.min(rect.y, 1 - h));
  return { ...rect, x, y, w, h };
}
