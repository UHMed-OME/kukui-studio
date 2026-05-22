import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { ACTIVITY_COMPONENTS } from "@kukui/activities";
import type { ActivityProps, BuiltActivityKind } from "../types.js";

/**
 * Shared dispatch table from `BuiltActivityKind` -> lazy component. Derived
 * from `@kukui/activities`' ACTIVITY_COMPONENTS map at module load (which is
 * itself built from the per-activity manifest glob), so adding a new
 * activity only touches its own dir — no hand-maintained switch table or
 * literal here that can drift.
 *
 * Used by both `<ActivityHost>` (engine context) and Studio's `<Preview>`
 * (authoring context). Each manifest's `Component` is a `React.lazy(...)`,
 * so Vite/Rollup still emits one chunk per activity: engine HTML pages each
 * lazy-load only the kind they host; Studio Preview only fetches the kind
 * currently being previewed.
 *
 * The wide `any` on props is the same compromise as the old switch table:
 * runtime Zod validation narrows config to the right shape, but TypeScript
 * can't track that across the dispatch.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ActivityComponent = LazyExoticComponent<ComponentType<ActivityProps<any>>>;

export const ACTIVITY_REGISTRY: Record<BuiltActivityKind, ActivityComponent> =
  ACTIVITY_COMPONENTS as Record<BuiltActivityKind, ActivityComponent>;

/**
 * Lazy stub fallback. Used by ActivityHost when the requested kind isn't yet
 * implemented (lives in `PLANNED_ACTIVITY_KINDS`) and by Preview as the
 * default-case render.
 */
export const StubActivityLazy: ActivityComponent = lazy(
  () => import("./_stub/index.js"),
);
