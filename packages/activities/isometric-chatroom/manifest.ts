import { lazy, type ComponentType } from "react";
import type { ActivityManifest } from "@kukui/activities/types";
import { IsometricChatroomConfigSchema } from "./schema.js";
import uiSchema from "./ui-schema.js";
import starter from "./starter.js";
import { Icon } from "./icon.js";
import { label, description, bloom, live } from "./meta.js";

// Component's typed props (ActivityProps<IsometricChatroomConfig>) are
// stricter than ActivityManifest's Component slot (ComponentType<unknown>),
// which the engine intentionally treats as opaque — config is JSON-
// validated at the engine boundary, not statically at the manifest seam.
//
// NB: Component.tsx is currently a thin re-export of @kukui/core's
// StubActivity — Isometric Chatroom is Live-only and has no dedicated
// engine-mode view yet. Swap the file out (not the manifest) once a real
// engine preview is designed.
const Component = lazy(() =>
  import("./Component.js").then((m) => ({
    default: m.default as unknown as ComponentType<unknown>,
  })),
);

export const activity: ActivityManifest<"isometric-chatroom"> = {
  kind: "isometric-chatroom",
  schema: IsometricChatroomConfigSchema,
  Component,
  uiSchema,
  starter,
  Icon,
  label,
  description,
  bloom,
  live,
};
