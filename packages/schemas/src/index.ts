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
export {
  CategorizationConfigSchema,
  type CategorizationConfig,
} from "./categorization.js";
export {
  SequenceStepsConfigSchema,
  type SequenceStepsConfig,
} from "./sequence-steps.js";
export {
  ReflectionPromptConfigSchema,
  type ReflectionPromptConfig,
} from "./reflection-prompt.js";
export {
  FlashcardsConfigSchema,
  type FlashcardsConfig,
} from "./flashcards.js";
export {
  ImageComparisonSliderConfigSchema,
  type ImageComparisonSliderConfig,
} from "./image-comparison-slider.js";
export {
  AnatomyLabelingConfigSchema,
  type AnatomyLabelingConfig,
} from "./anatomy-labeling.js";
export {
  MatchingPairsConfigSchema,
  type MatchingPairsConfig,
} from "./matching-pairs.js";
export {
  HighlightTextConfigSchema,
  type HighlightTextConfig,
} from "./highlight-text.js";
export { StubConfigSchema, type StubConfig } from "./stub.js";

import { MultipleChoiceConfigSchema } from "./multiple-choice.js";
import { FillInTheBlanksConfigSchema } from "./fill-in-the-blanks.js";
import { DragAndDropConfigSchema } from "./drag-and-drop.js";
import { CoursePresentationConfigSchema } from "./course-presentation.js";
import { QuestionSetConfigSchema } from "./question-set.js";
import { Hotspot3DConfigSchema } from "./hotspot-3d.js";
import { Hotspot2DConfigSchema } from "./hotspot-2d.js";
import { VirtualTourConfigSchema } from "./virtual-tour.js";
import { CategorizationConfigSchema } from "./categorization.js";
import { SequenceStepsConfigSchema } from "./sequence-steps.js";
import { ReflectionPromptConfigSchema } from "./reflection-prompt.js";
import { FlashcardsConfigSchema } from "./flashcards.js";
import { ImageComparisonSliderConfigSchema } from "./image-comparison-slider.js";
import { AnatomyLabelingConfigSchema } from "./anatomy-labeling.js";
import { MatchingPairsConfigSchema } from "./matching-pairs.js";
import { HighlightTextConfigSchema } from "./highlight-text.js";
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
  // Newly built (was stubbed):
  "sequence-steps": SequenceStepsConfigSchema,
  "matching-pairs": MatchingPairsConfigSchema,
  categorization: CategorizationConfigSchema,
  "image-comparison-slider": ImageComparisonSliderConfigSchema,
  "anatomy-labeling": AnatomyLabelingConfigSchema,
  "highlight-text": HighlightTextConfigSchema,
  flashcards: FlashcardsConfigSchema,
  "reflection-prompt": ReflectionPromptConfigSchema,
  // Still stubbed (next wave):
  "concept-map": StubConfigSchema,
  "image-annotation": StubConfigSchema,
  "branching-scenario": StubConfigSchema,
  "interactive-video": StubConfigSchema,
  "audio-recording": StubConfigSchema,
  "lab-panel": StubConfigSchema,
  "ddx-tree": StubConfigSchema,
  osce: StubConfigSchema,
} as const;

export type SchemaRegistryKey = keyof typeof SchemaRegistry;
