/**
 * Stacking order for 2D placement editors.
 *
 * Stacking is implicit in array position: later items render on top because
 * later DOM siblings paint over earlier ones. We expose this to authors as
 * the familiar "Bring to Front / Send Backward" actions instead of a
 * numeric z-index field.
 */

/** Round normalized coordinates to 2 decimal places before committing them
 *  to state. Drags otherwise produce e.g. 0.31249999999, which clutters
 *  the form fields and the saved JSON. 0.01 matches the form's step. */
export function roundCoord(n: number): number {
  return Math.round(n * 100) / 100;
}
export type ZOrderOp = "front" | "forward" | "backward" | "back";

export const ZORDER_LABELS: Record<ZOrderOp, string> = {
  front: "Bring to Front",
  forward: "Bring Forward",
  backward: "Send Backward",
  back: "Send to Back",
};

export function reorder<T>(items: readonly T[], index: number, op: ZOrderOp): T[] {
  if (index < 0 || index >= items.length) return [...items];
  const next = [...items];
  const removed = next.splice(index, 1);
  const item = removed[0] as T;
  switch (op) {
    case "front":
      next.push(item);
      break;
    case "forward":
      next.splice(Math.min(items.length - 1, index + 1), 0, item);
      break;
    case "backward":
      next.splice(Math.max(0, index - 1), 0, item);
      break;
    case "back":
      next.unshift(item);
      break;
  }
  return next;
}

/** Disable the no-op direction at the edges of the array. */
export function isOpEnabled(op: ZOrderOp, index: number, length: number): boolean {
  if (length <= 1) return false;
  if (op === "front" || op === "forward") return index < length - 1;
  return index > 0;
}
