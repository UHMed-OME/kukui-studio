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
export {
  Hotspot3DConfigSchema,
  type Hotspot3DConfig,
} from "@kukui/activities/hotspot-3d/schema";
export {
  Hotspot2DConfigSchema,
  type Hotspot2DConfig,
} from "@kukui/activities/hotspot-2d/schema";
export {
  VirtualTourConfigSchema,
  type VirtualTourConfig,
} from "@kukui/activities/virtual-tour/schema";
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
export {
  StrawPollConfigSchema,
  type StrawPollConfig,
} from "@kukui/activities/straw-poll/schema";
export {
  ConfidenceMeterConfigSchema,
  type ConfidenceMeterConfig,
} from "@kukui/activities/confidence-meter/schema";
export {
  WordCloudConfigSchema,
  type WordCloudConfig,
} from "@kukui/activities/word-cloud/schema";
export {
  QABoardConfigSchema,
  type QABoardConfig,
} from "@kukui/activities/qa-board/schema";
export {
  QuickQuizConfigSchema,
  type QuickQuizConfig,
} from "@kukui/activities/quick-quiz/schema";
export {
  IsometricChatroomConfigSchema,
  type IsometricChatroomConfig,
} from "@kukui/activities/isometric-chatroom/schema";
export { StubConfigSchema, type StubConfig } from "./stub.js";

import { MultipleChoiceConfigSchema } from "@kukui/activities/multiple-choice/schema";
import { FillInTheBlanksConfigSchema } from "@kukui/activities/fill-in-the-blanks/schema";
import { DragAndDropConfigSchema } from "@kukui/activities/drag-and-drop/schema";
import { QuestionSetConfigSchema } from "@kukui/activities/question-set/schema";
import { Hotspot3DConfigSchema } from "@kukui/activities/hotspot-3d/schema";
import { Hotspot2DConfigSchema } from "@kukui/activities/hotspot-2d/schema";
import { VirtualTourConfigSchema } from "@kukui/activities/virtual-tour/schema";
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
import { StrawPollConfigSchema } from "@kukui/activities/straw-poll/schema";
import { ConfidenceMeterConfigSchema } from "@kukui/activities/confidence-meter/schema";
import { WordCloudConfigSchema } from "@kukui/activities/word-cloud/schema";
import { QABoardConfigSchema } from "@kukui/activities/qa-board/schema";
import { QuickQuizConfigSchema } from "@kukui/activities/quick-quiz/schema";
import { IsometricChatroomConfigSchema } from "@kukui/activities/isometric-chatroom/schema";

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
