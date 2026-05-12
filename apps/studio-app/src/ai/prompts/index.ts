/**
 * Per-kind prompt registry — combines the global system prompt with the
 * activity-specific pedagogical fragment.
 *
 * The 12 priority kinds get bespoke fragments; everything media-heavy
 * (image / 3D / canvas / video / audio) falls back to a shared default
 * that calls out the media-gap behaviour.
 */
import type { SchemaRegistryKey } from "@kukui/schemas";
import { SYSTEM_BASE } from "./system-base.js";
import { PROMPT as MULTIPLE_CHOICE } from "./per-kind/multiple-choice.js";
import { PROMPT as FILL_IN_THE_BLANKS } from "./per-kind/fill-in-the-blanks.js";
import { PROMPT as FLASHCARDS } from "./per-kind/flashcards.js";
import { PROMPT as BRANCHING_SCENARIO } from "./per-kind/branching-scenario.js";
import { PROMPT as DDX_TREE } from "./per-kind/ddx-tree.js";
import { PROMPT as REFLECTION_PROMPT } from "./per-kind/reflection-prompt.js";
import { PROMPT as MATCHING_PAIRS } from "./per-kind/matching-pairs.js";
import { PROMPT as SEQUENCE_STEPS } from "./per-kind/sequence-steps.js";
import { PROMPT as CATEGORIZATION } from "./per-kind/categorization.js";
import { PROMPT as HIGHLIGHT_TEXT } from "./per-kind/highlight-text.js";
import { PROMPT as LAB_PANEL } from "./per-kind/lab-panel.js";
import { PROMPT as OSCE } from "./per-kind/osce.js";
import { PROMPT as CROSSWORD } from "./per-kind/crossword.js";
import { PROMPT as STRAW_POLL } from "./per-kind/straw-poll.js";
import { PROMPT as DEFAULT } from "./per-kind/default.js";

const PER_KIND: Partial<Record<SchemaRegistryKey, string>> = {
  "multiple-choice": MULTIPLE_CHOICE,
  "fill-in-the-blanks": FILL_IN_THE_BLANKS,
  flashcards: FLASHCARDS,
  "branching-scenario": BRANCHING_SCENARIO,
  "ddx-tree": DDX_TREE,
  "reflection-prompt": REFLECTION_PROMPT,
  "matching-pairs": MATCHING_PAIRS,
  "sequence-steps": SEQUENCE_STEPS,
  categorization: CATEGORIZATION,
  "highlight-text": HIGHLIGHT_TEXT,
  "lab-panel": LAB_PANEL,
  osce: OSCE,
  crossword: CROSSWORD,
  "straw-poll": STRAW_POLL,
};

export function systemPromptFor(kind: SchemaRegistryKey): string {
  const fragment = PER_KIND[kind] ?? DEFAULT;
  return `${SYSTEM_BASE}\n\n${fragment}`;
}

export { SYSTEM_BASE };
