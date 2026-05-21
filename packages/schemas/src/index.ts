export {
  MultipleChoiceConfigSchema,
  type MultipleChoiceConfig,
} from "@kukui/activities/multiple-choice/schema";
export {
  FillInTheBlanksConfigSchema,
  type FillInTheBlanksConfig,
  parseClozeText,
} from "@kukui/activities/fill-in-the-blanks/schema";
export {
  DragAndDropConfigSchema,
  type DragAndDropConfig,
} from "@kukui/activities/drag-and-drop/schema";
export {
  QuestionSetConfigSchema,
  type QuestionSetConfig,
} from "@kukui/activities/question-set/schema";
export { Hotspot3DConfigSchema, type Hotspot3DConfig } from "./hotspot-3d.js";
export { Hotspot2DConfigSchema, type Hotspot2DConfig } from "./hotspot-2d.js";
export { VirtualTourConfigSchema, type VirtualTourConfig } from "./virtual-tour.js";
export {
  CategorizationConfigSchema,
  type CategorizationConfig,
} from "@kukui/activities/categorization/schema";
export {
  SequenceStepsConfigSchema,
  type SequenceStepsConfig,
} from "@kukui/activities/sequence-steps/schema";
export {
  ReflectionPromptConfigSchema,
  type ReflectionPromptConfig,
} from "@kukui/activities/reflection-prompt/schema";
export {
  FlashcardsConfigSchema,
  type FlashcardsConfig,
} from "@kukui/activities/flashcards/schema";
export {
  ImageComparisonSliderConfigSchema,
  type ImageComparisonSliderConfig,
} from "@kukui/activities/image-comparison-slider/schema";
export {
  AnatomyLabelingConfigSchema,
  type AnatomyLabelingConfig,
} from "@kukui/activities/anatomy-labeling/schema";
export {
  MatchingPairsConfigSchema,
  type MatchingPairsConfig,
} from "@kukui/activities/matching-pairs/schema";
export {
  HighlightTextConfigSchema,
  type HighlightTextConfig,
} from "@kukui/activities/highlight-text/schema";
export {
  InteractiveVideoConfigSchema,
  type InteractiveVideoConfig,
} from "@kukui/activities/interactive-video/schema";
export {
  AudioRecordingConfigSchema,
  type AudioRecordingConfig,
} from "@kukui/activities/audio-recording/schema";
export {
  BranchingScenarioConfigSchema,
  type BranchingScenarioConfig,
} from "@kukui/activities/branching-scenario/schema";
export {
  ImageAnnotationConfigSchema,
  type ImageAnnotationConfig,
} from "@kukui/activities/image-annotation/schema";
export {
  ConceptMapConfigSchema,
  type ConceptMapConfig,
} from "@kukui/activities/concept-map/schema";
export {
  LabPanelConfigSchema,
  type LabPanelConfig,
} from "@kukui/activities/lab-panel/schema";
export {
  DDxTreeConfigSchema,
  type DDxTreeConfig,
} from "@kukui/activities/ddx-tree/schema";
export {
  OSCEConfigSchema,
  type OSCEConfig,
} from "@kukui/activities/osce/schema";
export {
  CrosswordConfigSchema,
  type CrosswordConfig,
} from "@kukui/activities/crossword/schema";
export { StrawPollConfigSchema, type StrawPollConfig } from "./straw-poll.js";
export {
  ConfidenceMeterConfigSchema,
  type ConfidenceMeterConfig,
} from "./confidence-meter.js";
export { WordCloudConfigSchema, type WordCloudConfig } from "./word-cloud.js";
export { QABoardConfigSchema, type QABoardConfig } from "./qa-board.js";
export { QuickQuizConfigSchema, type QuickQuizConfig } from "./quick-quiz.js";
export {
  IsometricChatroomConfigSchema,
  type IsometricChatroomConfig,
} from "./isometric-chatroom.js";
export { StubConfigSchema, type StubConfig } from "./stub.js";

import { MultipleChoiceConfigSchema } from "@kukui/activities/multiple-choice/schema";
import { FillInTheBlanksConfigSchema } from "@kukui/activities/fill-in-the-blanks/schema";
import { DragAndDropConfigSchema } from "@kukui/activities/drag-and-drop/schema";
import { QuestionSetConfigSchema } from "@kukui/activities/question-set/schema";
import { Hotspot3DConfigSchema } from "./hotspot-3d.js";
import { Hotspot2DConfigSchema } from "./hotspot-2d.js";
import { VirtualTourConfigSchema } from "./virtual-tour.js";
import { CategorizationConfigSchema } from "@kukui/activities/categorization/schema";
import { SequenceStepsConfigSchema } from "@kukui/activities/sequence-steps/schema";
import { ReflectionPromptConfigSchema } from "@kukui/activities/reflection-prompt/schema";
import { FlashcardsConfigSchema } from "@kukui/activities/flashcards/schema";
import { ImageComparisonSliderConfigSchema } from "@kukui/activities/image-comparison-slider/schema";
import { AnatomyLabelingConfigSchema } from "@kukui/activities/anatomy-labeling/schema";
import { MatchingPairsConfigSchema } from "@kukui/activities/matching-pairs/schema";
import { HighlightTextConfigSchema } from "@kukui/activities/highlight-text/schema";
import { InteractiveVideoConfigSchema } from "@kukui/activities/interactive-video/schema";
import { AudioRecordingConfigSchema } from "@kukui/activities/audio-recording/schema";
import { BranchingScenarioConfigSchema } from "@kukui/activities/branching-scenario/schema";
import { ImageAnnotationConfigSchema } from "@kukui/activities/image-annotation/schema";
import { ConceptMapConfigSchema } from "@kukui/activities/concept-map/schema";
import { LabPanelConfigSchema } from "@kukui/activities/lab-panel/schema";
import { DDxTreeConfigSchema } from "@kukui/activities/ddx-tree/schema";
import { OSCEConfigSchema } from "@kukui/activities/osce/schema";
import { CrosswordConfigSchema } from "@kukui/activities/crossword/schema";
import { StrawPollConfigSchema } from "./straw-poll.js";
import { ConfidenceMeterConfigSchema } from "./confidence-meter.js";
import { WordCloudConfigSchema } from "./word-cloud.js";
import { QABoardConfigSchema } from "./qa-board.js";
import { QuickQuizConfigSchema } from "./quick-quiz.js";
import {
  IsometricChatroomConfigSchema,
} from "./isometric-chatroom.js";

/**
 * Map of activity-kind → Zod schema. Keys match `ActivityKind` in
 * @kukui/core/types. ActivityHost validates JSON against the matching
 * schema before handing it to the activity component. All 24 first-pass
 * activities now have real schemas.
 */
export const SchemaRegistry = {
  "multiple-choice": MultipleChoiceConfigSchema,
  "fill-in-the-blanks": FillInTheBlanksConfigSchema,
  "drag-and-drop": DragAndDropConfigSchema,
  "question-set": QuestionSetConfigSchema,
  "hotspot-3d": Hotspot3DConfigSchema,
  "hotspot-2d": Hotspot2DConfigSchema,
  "virtual-tour": VirtualTourConfigSchema,
  "sequence-steps": SequenceStepsConfigSchema,
  "matching-pairs": MatchingPairsConfigSchema,
  categorization: CategorizationConfigSchema,
  "image-comparison-slider": ImageComparisonSliderConfigSchema,
  "anatomy-labeling": AnatomyLabelingConfigSchema,
  "highlight-text": HighlightTextConfigSchema,
  flashcards: FlashcardsConfigSchema,
  "reflection-prompt": ReflectionPromptConfigSchema,
  "branching-scenario": BranchingScenarioConfigSchema,
  "image-annotation": ImageAnnotationConfigSchema,
  "concept-map": ConceptMapConfigSchema,
  "interactive-video": InteractiveVideoConfigSchema,
  "audio-recording": AudioRecordingConfigSchema,
  "lab-panel": LabPanelConfigSchema,
  "ddx-tree": DDxTreeConfigSchema,
  osce: OSCEConfigSchema,
  crossword: CrosswordConfigSchema,
  "straw-poll": StrawPollConfigSchema,
  "confidence-meter": ConfidenceMeterConfigSchema,
  "word-cloud": WordCloudConfigSchema,
  "qa-board": QABoardConfigSchema,
  "quick-quiz": QuickQuizConfigSchema,
  "isometric-chatroom": IsometricChatroomConfigSchema,
} as const;

export type SchemaRegistryKey = keyof typeof SchemaRegistry;

export {
  ScoringSchema,
  SCORING_MODES,
  type Scoring,
  type ScoringMode,
} from "./scoring.js";
export {
  AppearanceSchema,
  THEME_VALUES,
  type Appearance,
  type Theme,
} from "./appearance.js";
export { migrateToScoring, migrateUnknown, syncLegacyFields } from "./migrate.js";
