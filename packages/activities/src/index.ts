import type { ActivityManifest } from "./types.js";

export type { ActivityManifest, BloomLevel } from "./types.js";

/**
 * Eagerly imports every per-activity manifest at build time. Vite resolves
 * the glob during dev and bundling; manifests are tiny (schema refs + lazy
 * component refs + label/bloom/etc.) so eager is cheap. Components and
 * Editors inside the manifests remain lazy via React.lazy().
 *
 * Glob pattern matches `packages/activities/<slug>/manifest.ts` files
 * relative to this file. The leading `../` walks out of `src/`.
 */
const modules = import.meta.glob<{ activity: ActivityManifest<string> }>(
  "../*/manifest.ts",
  { eager: true },
);

/**
 * Map from activity kind (e.g. `"multiple-choice"`) to its full manifest.
 * Populated at module load time from the glob above.
 */
export const ACTIVITY_MANIFESTS: Record<string, ActivityManifest<string>> =
  Object.fromEntries(
    Object.values(modules).map((m) => [m.activity.kind, m.activity]),
  );

/**
 * Sorted list of all built activity kinds. Use for catalog iteration.
 * Sort keeps test snapshots and Studio's catalog deterministic.
 */
export const BUILT_ACTIVITY_KINDS: readonly string[] = Object.keys(
  ACTIVITY_MANIFESTS,
).sort();

/**
 * Look up a manifest by kind. Returns undefined if the kind isn't registered
 * (e.g. it's a `PlannedActivityKind` or a typo).
 */
export function getManifest(kind: string): ActivityManifest<string> | undefined {
  return ACTIVITY_MANIFESTS[kind];
}
