import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { BuiltActivityKind } from "../types.js";
import type { ActivityProps } from "../types.js";

/**
 * Shared dispatch table from `BuiltActivityKind` -> lazy component. Used by
 * both `<ActivityHost>` (engine context) and Studio's `<Preview>` (authoring
 * context). Keeping it in one place means:
 *
 * 1. Adding a new activity kind only touches this file + the per-kind dirs,
 *    not every consumer's switch statement.
 * 2. Each entry imports from its own subpath, so Vite/Rollup emits one chunk
 *    per activity instead of one giant bundle that drags every other
 *    activity in. Engine HTML pages each lazy-load only the kind they host;
 *    Studio Preview only fetches the kind currently being previewed.
 *
 * The wide `any` on props is the same compromise as the old switch table:
 * runtime Zod validation narrows config to the right shape, but TypeScript
 * can't track that across the dispatch.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ActivityComponent = LazyExoticComponent<ComponentType<ActivityProps<any>>>;

export const ACTIVITY_REGISTRY: Record<BuiltActivityKind, ActivityComponent> = {
  "multiple-choice": lazy(() => import("@kukui/activities/multiple-choice/Component")),
  "fill-in-the-blanks": lazy(() => import("@kukui/activities/fill-in-the-blanks/Component")),
  "drag-and-drop": lazy(() => import("@kukui/activities/drag-and-drop/Component")),
  "question-set": lazy(() => import("./question-set/index.js")),
  "hotspot-3d": lazy(() => import("./hotspot-3d/index.js")),
  "hotspot-2d": lazy(() => import("./hotspot-2d/index.js")),
  "virtual-tour": lazy(() => import("./virtual-tour/index.js")),
  "sequence-steps": lazy(() => import("@kukui/activities/sequence-steps/Component")),
  "matching-pairs": lazy(() => import("@kukui/activities/matching-pairs/Component")),
  "categorization": lazy(() => import("@kukui/activities/categorization/Component")),
  "image-comparison-slider": lazy(() => import("./image-comparison-slider/index.js")),
  "anatomy-labeling": lazy(() => import("./anatomy-labeling/index.js")),
  "highlight-text": lazy(() => import("./highlight-text/index.js")),
  "flashcards": lazy(() => import("./flashcards/index.js")),
  "reflection-prompt": lazy(() => import("./reflection-prompt/index.js")),
  "branching-scenario": lazy(() => import("./branching-scenario/index.js")),
  "image-annotation": lazy(() => import("./image-annotation/index.js")),
  "concept-map": lazy(() => import("./concept-map/index.js")),
  "interactive-video": lazy(() => import("./interactive-video/index.js")),
  "audio-recording": lazy(() => import("./audio-recording/index.js")),
  "lab-panel": lazy(() => import("./lab-panel/index.js")),
  "ddx-tree": lazy(() => import("./ddx-tree/index.js")),
  "osce": lazy(() => import("./osce/index.js")),
  "crossword": lazy(() => import("./crossword/index.js")),
  "straw-poll": lazy(() => import("./straw-poll/index.js")),
  "confidence-meter": lazy(() => import("./confidence-meter/index.js")),
  "word-cloud": lazy(() => import("./word-cloud/index.js")),
  "qa-board": lazy(() => import("./qa-board/index.js")),
  "quick-quiz": lazy(() => import("./quick-quiz/index.js")),
  "isometric-chatroom": lazy(() => import("./_stub/index.js")),
};

/**
 * Lazy stub fallback. Used by ActivityHost when the requested kind isn't yet
 * implemented (lives in `PLANNED_ACTIVITY_KINDS`) and by Preview as the
 * default-case render.
 */
export const StubActivityLazy: ActivityComponent = lazy(
  () => import("./_stub/index.js"),
);
