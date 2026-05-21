import { lazy, type ComponentType } from "react";
import type { ActivityManifest } from "@kukui/activities/types";
import { Hotspot2DConfigSchema } from "./schema.js";
import uiSchema from "./ui-schema.js";
import starter from "./starter.js";
import { Icon } from "./icon.js";
import { label, description, bloom, live } from "./meta.js";

// Component's typed props (ActivityProps<Hotspot2DConfig>) are stricter
// than ActivityManifest's Component slot (ComponentType<unknown>), which
// the engine intentionally treats as opaque — config is JSON-validated at
// the engine boundary, not statically at the manifest seam.
const Component = lazy(() =>
  import("./Component.js").then((m) => ({
    default: m.default as unknown as ComponentType<unknown>,
  })),
);

export const activity: ActivityManifest<"hotspot-2d"> = {
  kind: "hotspot-2d",
  schema: Hotspot2DConfigSchema,
  Component,
  uiSchema,
  starter,
  Icon,
  label,
  description,
  bloom,
  live,
};
