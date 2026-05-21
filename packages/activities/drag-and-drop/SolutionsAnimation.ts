/*
 * SolutionsAnimation
 *
 * The "animation" here is purely CSS-driven (see `.kukui-dnd--showing-solution
 *  .kukui-dnd__chip.is-placed` in DragAndDrop.css). When the user clicks
 * "Show solution", the top-level DragAndDrop component:
 *
 *   1. Computes `solutionAssignment(config)` — first-correct-zone per chip
 *      that fits within capacity (see state.ts).
 *   2. Dispatches `{ type: "show-solution", assignment }`.
 *   3. The reducer marks `stage = "showing-solution"` and writes the new
 *      placement. The board re-renders with the new chip positions.
 *   4. DnDActivity adds the `kukui-dnd--showing-solution` modifier class,
 *      and each placed chip plays a 600 ms settle animation. Under
 *      `prefers-reduced-motion: reduce` the animation degrades to a focus
 *      pulse with no movement.
 *
 * This module exists as a single point of reference for the animation's
 * shape and timing. There is no React component because the animation
 * has no state of its own — it's driven by the reducer.
 */

export const SOLUTIONS_ANIMATION_DURATION_MS = 600;
