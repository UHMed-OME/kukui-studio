import type { ComponentType } from "react";
import type { ActivityKind } from "@kukui/core";
import type { LiveRoomHandle, Presence } from "@kukui/live";

/**
 * Shape of the props every `*Live.tsx` wrapper accepts. Mirrors the
 * `liveProps` object constructed in `LiveHost.tsx` plus the `config`
 * field that each branch narrows to its concrete schema type before
 * forwarding it to the component.
 *
 * `config` is `unknown` here because each Live component types its own
 * `config` against a specific schema (e.g. `StrawPollConfig`); the
 * `Component` field in `LiveActivityManifest` is widened with a cast at
 * the export site, the same pattern the engine uses for its
 * `ActivityComponent` registry entries.
 */
export interface LiveActivityProps {
  config: unknown;
  room: LiveRoomHandle;
  presence: Map<string, Presence>;
  role: "instructor" | "student";
  onLeave: () => void;
}

/**
 * Manifest exported by each `*Live.tsx` so a registry can dispatch on
 * `kind` without importing every component eagerly. Parameterised by
 * `ActivityKind` so the literal kind is preserved for downstream
 * discriminated unions.
 */
export interface LiveActivityManifest<K extends ActivityKind = ActivityKind> {
  kind: K;
  Component: ComponentType<LiveActivityProps>;
}
