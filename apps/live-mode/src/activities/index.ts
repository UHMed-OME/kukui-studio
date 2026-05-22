import type { ActivityKind } from "@kukui/core";
import type { LiveActivityManifest } from "./types.js";

/**
 * Eagerly imports every per-activity Live manifest. Eager (not lazy) because
 * Live dispatch can't tolerate chunk-fetch latency in a real-time session —
 * matches the previous if-chain pattern in LiveHost.tsx that imported each
 * *Live component at the top of the file.
 */
const modules = import.meta.glob<{ liveActivity: LiveActivityManifest }>(
  "./*Live.tsx",
  { eager: true },
);

export const LIVE_ACTIVITY_REGISTRY: Partial<Record<ActivityKind, LiveActivityManifest>> =
  Object.fromEntries(
    Object.values(modules)
      .filter((m): m is { liveActivity: LiveActivityManifest } => "liveActivity" in m)
      .map((m) => [m.liveActivity.kind, m.liveActivity]),
  );

export function getLiveActivity(kind: ActivityKind): LiveActivityManifest | undefined {
  return LIVE_ACTIVITY_REGISTRY[kind];
}
