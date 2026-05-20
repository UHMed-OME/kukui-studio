import { lazy, type ComponentType } from "react";
import type { ActivityManifest } from "@kukui/activities/types";
import { MultipleChoiceConfigSchema } from "./schema.js";
import uiSchema from "./ui-schema.js";
import starter from "./starter.js";
import { label, description, bloom, live } from "./meta.js";

// Component's typed props (ActivityProps<MultipleChoiceConfig>) are stricter
// than ActivityManifest's Component slot (ComponentType<unknown>), which the
// engine intentionally treats as opaque — config is JSON-validated at the
// engine boundary, not statically at the manifest seam.
const Component = lazy(() =>
  import("./Component.js").then((m) => ({
    default: m.default as unknown as ComponentType<unknown>,
  })),
);

export const activity: ActivityManifest<"multiple-choice"> = {
  kind: "multiple-choice",
  schema: MultipleChoiceConfigSchema,
  Component,
  uiSchema,
  starter,
  label,
  description,
  bloom,
  live,
  // Icon intentionally omitted — Studio's activityIcons.tsx today omits
  // multiple-choice from its Partial<Record<...>> map; the manifest
  // mirrors that contract (Icon is optional on ActivityManifest).
};
