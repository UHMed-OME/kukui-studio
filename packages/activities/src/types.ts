import type { ComponentType, LazyExoticComponent } from "react";
import type { z } from "zod";

export type BloomLevel =
  | "remember"
  | "understand"
  | "apply"
  | "analyze"
  | "evaluate"
  | "create";

export interface ActivityManifest<K extends string = string> {
  /** Stable kebab-case identifier. Must be unique across all activities. */
  kind: K;
  /** Zod schema that validates this activity's JSON config. */
  schema: z.ZodTypeAny;
  /** Engine-mode React component, lazy-loaded so Vite chunk-splits per activity. */
  Component: LazyExoticComponent<ComponentType<unknown>>;
  /** RJSF uiSchema for Studio's form editor. */
  uiSchema: Record<string, unknown>;
  /** Minimal valid config used as Studio's "new activity" starter template. */
  starter: unknown;
  /** SVG icon for Studio's sidebar/picker. */
  Icon: ComponentType<{ className?: string }>;
  /** Display name shown in Studio's catalog. */
  label: string;
  /** One-line description for Studio's catalog and learning-objective matching. */
  description: string;
  /** Bloom's taxonomy level — drives Studio's cognitive-level filter. */
  bloom: BloomLevel;
  /** True if this activity has a Live (Phase 3) classroom variant in apps/live-mode. */
  live: boolean;
  /** Optional visual canvas editor for Studio (lazy-loaded). */
  Editor?: LazyExoticComponent<ComponentType<unknown>>;
}
