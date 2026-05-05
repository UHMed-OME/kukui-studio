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
export { VirtualTourConfigSchema, type VirtualTourConfig } from "./virtual-tour.js";

import { MultipleChoiceConfigSchema } from "./multiple-choice.js";
import { FillInTheBlanksConfigSchema } from "./fill-in-the-blanks.js";
import { DragAndDropConfigSchema } from "./drag-and-drop.js";
import { CoursePresentationConfigSchema } from "./course-presentation.js";
import { QuestionSetConfigSchema } from "./question-set.js";
import { Hotspot3DConfigSchema } from "./hotspot-3d.js";
import { VirtualTourConfigSchema } from "./virtual-tour.js";

/**
 * Map of activity-kind → Zod schema. The keys match `ActivityKind` in
 * @kukui/core/types. Used by ActivityHost to validate JSON before handing
 * the config to the matching component.
 */
export const SchemaRegistry = {
  "multiple-choice": MultipleChoiceConfigSchema,
  "fill-in-the-blanks": FillInTheBlanksConfigSchema,
  "drag-and-drop": DragAndDropConfigSchema,
  "course-presentation": CoursePresentationConfigSchema,
  "question-set": QuestionSetConfigSchema,
  "hotspot-3d": Hotspot3DConfigSchema,
  "virtual-tour": VirtualTourConfigSchema,
} as const;

export type SchemaRegistryKey = keyof typeof SchemaRegistry;
