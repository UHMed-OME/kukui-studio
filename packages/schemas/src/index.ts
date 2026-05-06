export {
  MultipleChoiceConfigSchema,
  type MultipleChoiceConfig,
} from "./multiple-choice.js";
export {
  FillInTheBlanksConfigSchema,
  type FillInTheBlanksConfig,
  parseClozeText,
} from "./fill-in-the-blanks.js";
export { DragAndDropConfigSchema, type DragAndDropConfig } from "./drag-and-drop.js";
export {
  CoursePresentationConfigSchema,
  type CoursePresentationConfig,
} from "./course-presentation.js";
export { QuestionSetConfigSchema, type QuestionSetConfig } from "./question-set.js";
export { Hotspot3DConfigSchema, type Hotspot3DConfig } from "./hotspot-3d.js";
export { Hotspot2DConfigSchema, type Hotspot2DConfig } from "./hotspot-2d.js";
export { VirtualTourConfigSchema, type VirtualTourConfig } from "./virtual-tour.js";
export { StubConfigSchema, type StubConfig } from "./stub.js";

import { MultipleChoiceConfigSchema } from "./multiple-choice.js";
import { FillInTheBlanksConfigSchema } from "./fill-in-the-blanks.js";
import { DragAndDropConfigSchema } from "./drag-and-drop.js";
import { CoursePresentationConfigSchema } from "./course-presentation.js";
import { QuestionSetConfigSchema } from "./question-set.js";
import { Hotspot3DConfigSchema } from "./hotspot-3d.js";
import { Hotspot2DConfigSchema } from "./hotspot-2d.js";
import { VirtualTourConfigSchema } from "./virtual-tour.js";
import { StubConfigSchema } from "./stub.js";

/**
 * Map of activity-kind → Zod schema. The keys match `ActivityKind` in
 * @kukui/core/types. Used by ActivityHost to validate JSON before handing
 * the config to the matching component.
 *
 * Activity kinds in `PlannedActivityKind` (at @kukui/core/planned) all map
 * to StubConfigSchema until each one ships its own real schema.
 */
export const SchemaRegistry = {
  "multiple-choice": MultipleChoiceConfigSchema,
  "fill-in-the-blanks": FillInTheBlanksConfigSchema,
  "drag-and-drop": DragAndDropConfigSchema,
  "course-presentation": CoursePresentationConfigSchema,
  "question-set": QuestionSetConfigSchema,
  "hotspot-3d": Hotspot3DConfigSchema,
  "hotspot-2d": Hotspot2DConfigSchema,
  "virtual-tour": VirtualTourConfigSchema,
  // Planned (stubbed):
  "sequence-steps": StubConfigSchema,
  "matching-pairs": StubConfigSchema,
  categorization: StubConfigSchema,
  "concept-map": StubConfigSchema,
  "image-annotation": StubConfigSchema,
  "image-comparison-slider": StubConfigSchema,
  "anatomy-labeling": StubConfigSchema,
  "branching-scenario": StubConfigSchema,
  "interactive-video": StubConfigSchema,
  "audio-recording": StubConfigSchema,
  "highlight-text": StubConfigSchema,
  "lab-panel": StubConfigSchema,
  "ddx-tree": StubConfigSchema,
  osce: StubConfigSchema,
  flashcards: StubConfigSchema,
  "reflection-prompt": StubConfigSchema,
} as const;

export type SchemaRegistryKey = keyof typeof SchemaRegistry;
