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

import { ACTIVITY_MANIFESTS_SCHEMAS } from "@kukui/activities";

/**
 * Map of activity-kind → Zod schema. Derived from `@kukui/activities`
 * manifests so the registry stays in lockstep with the built activity
 * catalog — no hand-maintained list to drift. ActivityHost validates JSON
 * against the matching schema before handing it to the activity component.
 *
 * Typed as `Record<string, z.ZodTypeAny>` (not a literal union) to avoid a
 * workspace cycle: literal-union narrowing would require `BuiltActivityKind`
 * from core, which already depends on this package. Consumers narrow at the
 * call site via `kind as SchemaRegistryKey` against a runtime guard.
 */
export const SchemaRegistry = ACTIVITY_MANIFESTS_SCHEMAS;

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
