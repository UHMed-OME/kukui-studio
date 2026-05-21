import { lazy, type ComponentType } from "react";
import type { ActivityManifest } from "@kukui/activities/types";
import { FillInTheBlanksConfigSchema } from "./schema.js";
import uiSchema from "./ui-schema.js";
import starter from "./starter.js";
import { label, description, bloom, live } from "./meta.js";

// Component's typed props (ActivityProps<FillInTheBlanksConfig>) are stricter
// than ActivityManifest's Component slot (ComponentType<unknown>), which the
// engine intentionally treats as opaque — config is JSON-validated at the
// engine boundary, not statically at the manifest seam.
const Component = lazy(() =>
  import("./Component.js").then((m) => ({
    default: m.default as unknown as ComponentType<unknown>,
  })),
);

export const activity: ActivityManifest<"fill-in-the-blanks"> = {
  kind: "fill-in-the-blanks",
  schema: FillInTheBlanksConfigSchema,
  Component,
  uiSchema,
  starter,
  label,
  description,
  bloom,
  live,
  // Icon intentionally omitted — fill-in-the-blanks isn't in Studio's
  // activityIcons map (quiz-style kind suppressed via STUDIO_SUPPRESSED).
};
