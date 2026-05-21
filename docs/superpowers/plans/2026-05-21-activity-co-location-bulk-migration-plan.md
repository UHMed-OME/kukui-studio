# Activity Co-Location Bulk Migration Implementation Plan (Plan 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the remaining 29 activities (everything except `multiple-choice`, which Plan 1 piloted) into `packages/activities/{slug}/`, deleting their entries from the legacy aggregator maps along the way. After this plan ships, all Studio aggregator fallback paths can be removed (Plan 3 cleans them up), and `packages/schemas/src/` will contain only `shared.ts` + `scoring.ts` + `appearance.ts` + `migrate.ts` + `stub.ts` + tests + `index.ts` (no per-kind schemas).

**Architecture:** Each activity follows the Plan 1 migration template — move schema + component + samples into the co-located folder, extract uiSchema/starter/icon/meta, wire manifest.ts. Tier classification orders them simple-to-complex so each tier builds on patterns proven by the prior one.

**Tech Stack:** Same as Plan 1 — pnpm workspaces, TS project references, Vite 6 `import.meta.glob`, Vitest 3, React 19, Zod 4.

---

## Tier classification

29 activities ordered by migration complexity:

| Tier | Count | Activities | Why this tier |
|---|---|---|---|
| **1 — Standard** | 18 | fill-in-the-blanks, drag-and-drop, sequence-steps, matching-pairs, categorization, reflection-prompt, flashcards, anatomy-labeling, highlight-text, image-comparison-slider, image-annotation, concept-map, ddx-tree, osce, lab-panel, crossword, audio-recording, branching-scenario | No Live variant, no sub-component embedding, plain JSON samples |
| **2 — Composite** | 2 | question-set, interactive-video | Embed `MultipleChoice` (and possibly other sub-components); Plan 1 already wired aliased default imports — verify imports survive migration |
| **3 — Asset-heavy** | 3 | hotspot-2d, hotspot-3d, virtual-tour | Samples include `.glb` binaries; SCORM packaging must round-trip them |
| **4 — Live-enabled** | 6 | straw-poll, confidence-meter, word-cloud, qa-board, quick-quiz, isometric-chatroom | Have `*Live.tsx` files in `apps/live-mode/src/activities/` that import from the engine component being moved; `meta.ts` must set `live: true`; `apps/live-mode/src/LiveHost.tsx` if-chain dispatch may need import updates |

Total: 18 + 2 + 3 + 6 = **29**.

---

## Per-activity migration template

Each task in this plan applies this 11-step template to a single slug `<slug>` (kebab-case). The `<PascalSlug>` is the component class name (e.g. `fill-in-the-blanks` → `FillInTheBlanks`). The destination folder is `packages/activities/<slug>/`.

The template is what Plan 1's Tasks 5–17 collectively did for `multiple-choice`, condensed into one task per activity now that the pattern is proven.

```
A. Move schema
   1. git mv packages/schemas/src/<slug>.ts packages/activities/<slug>/schema.ts
   2. In the moved file, change imports:
      - `from "./scoring.js"` → `from "@kukui/schemas/shared"`
      - `from "./appearance.js"` → `from "@kukui/schemas/shared"`
      (Often combined into one import line.)
   3. Add an explicit subpath export to packages/activities/package.json:
        "./<slug>/schema": "./<slug>/schema.ts",
      Place alphabetically near existing entries.
   4. Edit packages/schemas/src/index.ts:
      - Remove the `export { <Slug>ConfigSchema, type <Slug>Config } from "./<slug>.js";` block
      - Remove the `import { <Slug>ConfigSchema } from "./<slug>.js";` line
      - Remove the `"<slug>": <Slug>ConfigSchema,` line from the SchemaRegistry literal
      (The manifest will register the schema via @kukui/activities, not directly.)
   5. Remove "./<slug>": "./src/<slug>.ts" from packages/schemas/package.json exports.

B. Move component
   6. git mv packages/core/src/components/<slug>/<PascalSlug>.tsx packages/activities/<slug>/Component.tsx
      git mv packages/core/src/components/<slug>/<PascalSlug>.test.tsx packages/activities/<slug>/Component.test.tsx
      git mv packages/core/src/components/<slug>/<PascalSlug>.css packages/activities/<slug>/Component.css   (skip if no CSS file)
      git rm packages/core/src/components/<slug>/index.ts
      (Some activities have additional files in their folder — like drag-and-drop has state.ts, Chip.tsx, etc. Move those into packages/activities/<slug>/ too, preserving filenames.)
   7. In packages/activities/<slug>/Component.tsx:
      - Rename the React component identifier from <PascalSlug> to `Component` (function declaration, JSX usage, default export)
      - DO NOT rename CSS class names, string literals containing the kind, or imported types like <Slug>Config
      - Change `import "./<PascalSlug>.css";` → `import "./Component.css";` (if applicable)
      - Rewrite cross-package imports: any `from "../../<x>.js"` referring to core utilities becomes `from "@kukui/core/<x>"` or `from "@kukui/core"` for the barrel
   8. In Component.test.tsx, update imports to `import Component from "./Component.js";` and replace JSX `<<PascalSlug> ... />` with `<Component ... />`. Keep schema/type imports unchanged.
   9. In packages/core/src/components/registry.ts, change the line:
        "<slug>": lazy(() => import("./<slug>/index.js")),
      To:
        "<slug>": lazy(() => import("@kukui/activities/<slug>/Component")),
   10. Add an explicit subpath export to packages/activities/package.json:
        "./<slug>/Component": "./<slug>/Component.tsx",
   11. If the component imports MultipleChoice or another already-migrated sibling (Tier 2 case), update the import to alias the new default export:
        import <SiblingPascal> from "@kukui/activities/<sibling-slug>/Component";

C. Move samples
   12. mkdir -p packages/activities/<slug>/samples/_invalid 2>/dev/null
       git mv apps/engine-web/public/samples/<slug>/basic.json packages/activities/<slug>/samples/basic.json
       git mv apps/engine-web/public/samples/<slug>/full.json packages/activities/<slug>/samples/full.json   (skip if no full.json)
       For each file in apps/engine-web/public/samples/<slug>/_invalid/, git mv it into packages/activities/<slug>/samples/_invalid/
       For Tier 3 (asset-heavy): also git mv any *.glb (or other binary) files from apps/engine-web/public/samples/<slug>/ into packages/activities/<slug>/samples/
   13. If apps/engine-web/public/samples/<slug>/ is now empty, remove the directory: `rmdir apps/engine-web/public/samples/<slug>/_invalid; rmdir apps/engine-web/public/samples/<slug>/`

D. Extract uiSchema
   14. In apps/studio-app/src/uiSchemas.ts:
       - Find the `"<slug>":` entry in `LEGACY_UI_SCHEMAS` (or whichever the renamed map is; Task 14 of Plan 1 renamed UI_SCHEMAS to LEGACY_UI_SCHEMAS)
       - Copy the body of the entry into a new file packages/activities/<slug>/ui-schema.ts wrapping it as:
         ```ts
         /** RJSF uiSchema for the <slug> activity. Extracted from apps/studio-app/src/uiSchemas.ts. */
         const uiSchema = {
           // <body copied verbatim>
         } as const;
         export default uiSchema;
         ```
       - If the entry references shared identifiers (COMMON, TITLE, HIDDEN, f(), etc. — see Plan 1 Task 10 report), inline those values into the new file as local constants
       - Delete the entire `"<slug>": { ... },` entry from LEGACY_UI_SCHEMAS (including the trailing comma)

E. Extract starter + label + bloom
   15. In apps/studio-app/src/starters.ts:
       - Find the `"<slug>": { ... },` entry in `LEGACY_STARTERS` — copy the body into packages/activities/<slug>/starter.ts:
         ```ts
         /** Minimal valid config used as Studio's "new activity" template. */
         const starter = {
           // <body copied verbatim>
         };
         export default starter;
         ```
       - Delete that entry from LEGACY_STARTERS
       - Find the `"<slug>": "..."` entry in `LEGACY_LABELS` — note the label string
       - Delete that entry from LEGACY_LABELS
   16. Create packages/activities/<slug>/starter.test.ts:
       ```ts
       import { describe, it, expect } from "vitest";
       import starter from "./starter.js";
       import { <Slug>ConfigSchema } from "./schema.js";

       describe("<slug> starter", () => {
         it("validates against the schema", () => {
           const result = <Slug>ConfigSchema.safeParse(starter);
           if (!result.success) {
             console.error("starter failed:", JSON.stringify(result.error.issues, null, 2));
           }
           expect(result.success).toBe(true);
         });
       });
       ```
   17. In apps/studio-app/src/App.tsx LEGACY_BLOOM map:
       - Find the `"<slug>": "..."` entry (if present — quiz-style and some others aren't there)
       - Note the bloom level
       - Delete the entry (if present)

F. Extract icon (only if present in activityIcons.tsx)
   18. In apps/studio-app/src/activityIcons.tsx:
       - Check if `"<slug>":` exists in LEGACY_ICONS — if not, skip this section entirely (manifest will simply omit Icon)
       - If present: copy the SVG markup into packages/activities/<slug>/icon.tsx:
         ```tsx
         import type { ComponentType } from "react";
         export const Icon: ComponentType<{ className?: string }> = ({ className }) => (
           <svg className={className} viewBox="..." /* rest verbatim */>
             {/* paths verbatim */}
           </svg>
         );
         ```
       - Delete the entry from LEGACY_ICONS

G. Create meta.ts
   19. Create packages/activities/<slug>/meta.ts using the label from Step 15, bloom from Step 17 (or pick from BloomLevel based on the activity's pedagogical nature if it wasn't in LEGACY_BLOOM), and `live: true` only for Tier 4 activities:
       ```ts
       import type { BloomLevel } from "@kukui/activities/types";
       export const label = "<Label>";
       export const description = "<One-line description>";
       export const bloom: BloomLevel = "<level>";
       export const live = <true|false>;
       ```

H. Wire manifest.ts
   20. Create packages/activities/<slug>/manifest.ts:
       ```ts
       import { lazy } from "react";
       import type { ActivityManifest } from "@kukui/activities/types";
       import { <Slug>ConfigSchema } from "./schema.js";
       import uiSchema from "./ui-schema.js";
       import starter from "./starter.js";
       import { Icon } from "./icon.js";   // OMIT this import if no icon.tsx exists
       import { label, description, bloom, live } from "./meta.js";

       export const activity: ActivityManifest<"<slug>"> = {
         kind: "<slug>",
         schema: <Slug>ConfigSchema,
         Component: lazy(() => import("./Component.js")) as unknown as ActivityManifest["Component"],
         uiSchema,
         starter,
         Icon,   // OMIT this field if no icon.tsx
         label,
         description,
         bloom,
         live,
       };
       ```
       (The `as unknown as` cast is documented in packages/activities/src/types.ts line 17–26.)

I. Live wrapper (Tier 4 only)
   21. Verify the activity's Live variant in apps/live-mode/src/activities/ still compiles:
       - Find `<PascalSlug>Live.tsx` (e.g. StrawPollLive.tsx). Look for imports from the engine component being moved.
       - If it imports `from "@kukui/core/components/<slug>/..."` or similar (using the OLD path), update to `from "@kukui/activities/<slug>/Component"`.
       - If LiveHost.tsx imports the schema config type from `@kukui/schemas`, that import keeps working (schemas package still re-exports it transitively via the SchemaRegistry path).

J. Verify
   22. Run `pnpm typecheck`. Expected: PASS. If fails, the most likely cause is a forgotten import rewrite in the component file — read the error and fix.
   23. Run `pnpm test --run`. Expected: PASS. Test count grows by +1 from the new starter.test.ts and the manifest contributes 0–3 tests if you wrote a manifest.test.ts. The fixtures.test.ts (which auto-discovers samples) should still cover this slug's basic/full/_invalid fixtures via the new location.
   24. Optional but recommended for Tier 3 (asset-heavy): build engine and confirm assets round-trip:
       ```
       pnpm --filter @kukui/engine-web build
       ls apps/engine-web/dist/samples/<slug>/
       ```
       Should include the .glb files.

K. Commit
   25. Commit in two parts (main change + lockfile):
       ```
       git add packages/activities/<slug>/ \
               packages/activities/package.json \
               packages/schemas/src/index.ts \
               packages/schemas/package.json \
               packages/core/src/components/registry.ts \
               apps/studio-app/src/uiSchemas.ts \
               apps/studio-app/src/starters.ts \
               apps/studio-app/src/activityIcons.tsx \
               apps/studio-app/src/App.tsx
       # Plus any apps/live-mode/src/activities/<...>Live.tsx changes for Tier 4
       # The git-rm'd old files are auto-staged
       git commit -m "refactor(activities): migrate <slug> into @kukui/activities"

       # If pnpm install ran:
       git add pnpm-lock.yaml
       git commit -m "chore: update pnpm-lock for <slug> migration"
       ```
```

---

## Hard rules carried from Plan 1

- Never write "H5P" in any generated file (per CLAUDE.md).
- Never invent design-token values; only reference tokens in `docs/design-system.md`.
- Pre-existing untracked files in the working tree (`CLAUDE.md` mod, `.claude/commands/`, `AGENTS.md`, `apps/live-mode/src/activities/CLAUDE.md`, `docs/ux-design.md`) must remain unstaged — do not touch them.
- Quiz-style suppression (`STUDIO_SUPPRESSED` set in App.tsx): `fill-in-the-blanks` and `question-set` are in that set. After their migrations land, **do not remove them from the suppression set** — they should continue to be hidden from Studio's catalog even though they have manifests. (Same reason as multiple-choice: they're embedded sub-components.)

---

## Tier 1 — Standard activities (18 tasks)

Each task is "apply the template (A–K, skipping I) to one activity." Per-activity notes call out anything that deviates from the template's assumed shape.

### Task 1: Migrate `fill-in-the-blanks`

**Files (in addition to the standard template set):**
- `packages/core/src/components/fill-in-the-blanks/` likely contains additional helper files (cloze parser? Check before moving).

**Per-activity notes:**
- `parseClozeText` may be exported from the schema file (`packages/schemas/src/fill-in-the-blanks.ts`). Keep that named export available — downstream tools (Studio, AI editor) may import it via `@kukui/schemas`. Solution: add `export { parseClozeText } from "@kukui/activities/fill-in-the-blanks/schema";` to `packages/schemas/src/index.ts` (mirroring how multiple-choice's `MultipleChoiceConfigSchema` got hoisted).
- This activity belongs to `STUDIO_SUPPRESSED` — leave the entry in `App.tsx`'s suppression set after migration.

- [ ] **Steps:** Apply template steps A–K (skip I). Verify `parseClozeText` is still importable from `@kukui/schemas` by running `pnpm test --run` and watching for downstream import failures in AI editor or interactive-video tests.

- [ ] **Commit message:** `refactor(activities): migrate fill-in-the-blanks into @kukui/activities`

---

### Task 2: Migrate `drag-and-drop`

**Per-activity notes:**
- The component folder is **multi-file**: `packages/core/src/components/drag-and-drop/` has `DragAndDrop.tsx`, `Chip.tsx`, `DragLayer.tsx`, `TapLayer.tsx`, `state.ts`, `DnDActivity.tsx`, plus tests and CSS. **All of them move** into `packages/activities/drag-and-drop/`. Preserve their filenames (don't rename Chip.tsx → Chip-Component.tsx etc.). Rename only the **top-level** component (DragAndDrop → Component in DragAndDrop.tsx, plus the file rename to Component.tsx).
- Multiple internal imports between these files exist — they're relative (`./Chip.js` etc.) and survive the move unchanged.
- `packages/schemas/src/dnd-flow.test.ts` may reference the drag-and-drop schema — verify it still works (it imports from `./drag-and-drop.js`, which no longer exists at that path). Likely fix: change to `import { DragAndDropConfigSchema } from "@kukui/activities/drag-and-drop/schema";`

- [ ] **Steps:** Apply template, paying attention to the multi-file component move (Step B Step 6 moves multiple .tsx/.ts files, not just one). After the move, update `packages/schemas/src/dnd-flow.test.ts` if it has broken imports.

- [ ] **Commit message:** `refactor(activities): migrate drag-and-drop into @kukui/activities (multi-file component)`

---

### Task 3: Migrate `sequence-steps`

**Per-activity notes:** Standard shape. The schema uses ScoringSchema and AppearanceSchema (verified). No sub-components.

- [ ] **Steps:** Apply template A–K (skip I).
- [ ] **Commit message:** `refactor(activities): migrate sequence-steps into @kukui/activities`

---

### Task 4: Migrate `matching-pairs`

**Per-activity notes:** Standard. May have helper modules (item shuffle, pair-validation utilities) in its component folder — move all of them.

- [ ] **Steps:** Apply template.
- [ ] **Commit message:** `refactor(activities): migrate matching-pairs into @kukui/activities`

---

### Task 5: Migrate `categorization`

**Per-activity notes:** Standard. Note this kind has NO basic.json fixture (per Task 20 audit: it's listed in SchemaRegistry but missing samples). The samples migration step (C, 12) becomes a no-op for this kind. Adding a real `basic.json` is out of scope.

- [ ] **Steps:** Apply template, skipping step C entirely.
- [ ] **Commit message:** `refactor(activities): migrate categorization into @kukui/activities (no samples to move yet)`

---

### Task 6: Migrate `reflection-prompt`

**Per-activity notes:** Standard. Output-only activity (no scoring per the schema).

- [ ] **Steps:** Apply template.
- [ ] **Commit message:** `refactor(activities): migrate reflection-prompt into @kukui/activities`

---

### Task 7: Migrate `flashcards`

**Per-activity notes:** Standard. Has a small library of internal helpers (card-shuffle, progress state) — move all files in `packages/core/src/components/flashcards/`.

- [ ] **Steps:** Apply template.
- [ ] **Commit message:** `refactor(activities): migrate flashcards into @kukui/activities`

---

### Task 8: Migrate `anatomy-labeling`

**Per-activity notes:** Standard. The schema references image-asset shapes — the component likely uses canvas/SVG. Check for any imported SVG-helper modules from `@kukui/core` and rewrite imports per template Step 7.

- [ ] **Steps:** Apply template.
- [ ] **Commit message:** `refactor(activities): migrate anatomy-labeling into @kukui/activities`

---

### Task 9: Migrate `highlight-text`

**Per-activity notes:** Standard text-selection activity. No assets.

- [ ] **Steps:** Apply template.
- [ ] **Commit message:** `refactor(activities): migrate highlight-text into @kukui/activities`

---

### Task 10: Migrate `image-comparison-slider`

**Per-activity notes:** Standard. Uses two image URLs in the config. No internal sub-components.

- [ ] **Steps:** Apply template.
- [ ] **Commit message:** `refactor(activities): migrate image-comparison-slider into @kukui/activities`

---

### Task 11: Migrate `image-annotation`

**Per-activity notes:** Standard. Component may have a draw/annotate helper module — move all files in its folder.

- [ ] **Steps:** Apply template.
- [ ] **Commit message:** `refactor(activities): migrate image-annotation into @kukui/activities`

---

### Task 12: Migrate `concept-map`

**Per-activity notes:** Standard. Likely uses a graph-rendering helper — move all files in its folder.

- [ ] **Steps:** Apply template.
- [ ] **Commit message:** `refactor(activities): migrate concept-map into @kukui/activities`

---

### Task 13: Migrate `ddx-tree`

**Per-activity notes:** Differential-diagnosis tree. Standard shape.

- [ ] **Steps:** Apply template.
- [ ] **Commit message:** `refactor(activities): migrate ddx-tree into @kukui/activities`

---

### Task 14: Migrate `osce`

**Per-activity notes:** Objective Structured Clinical Examination. Standard shape. May have nested checklist/rubric helpers — move all files in its folder.

- [ ] **Steps:** Apply template.
- [ ] **Commit message:** `refactor(activities): migrate osce into @kukui/activities`

---

### Task 15: Migrate `lab-panel`

**Per-activity notes:** Lab-results review activity. Standard shape.

- [ ] **Steps:** Apply template.
- [ ] **Commit message:** `refactor(activities): migrate lab-panel into @kukui/activities`

---

### Task 16: Migrate `crossword`

**Per-activity notes:** Crossword puzzle. The schema and component are likely substantial (grid generation, clue rendering). Move all files in the folder.

- [ ] **Steps:** Apply template.
- [ ] **Commit message:** `refactor(activities): migrate crossword into @kukui/activities`

---

### Task 17: Migrate `audio-recording`

**Per-activity notes:** Audio-recording activity. Component uses MediaRecorder API. Standard shape. No assets in samples.

- [ ] **Steps:** Apply template.
- [ ] **Commit message:** `refactor(activities): migrate audio-recording into @kukui/activities`

---

### Task 18: Migrate `branching-scenario`

**Per-activity notes:** Branching narrative. The schema is recursive (each branch has nested branches). Component may have complex state for tracking visited paths. Move all files in the folder.

- [ ] **Steps:** Apply template.
- [ ] **Commit message:** `refactor(activities): migrate branching-scenario into @kukui/activities`

---

## Tier 2 — Composite activities (2 tasks)

These embed already-migrated sibling components. Plan 1 already wired aliased default imports for `MultipleChoice` in both (commit `1a43595`); make sure those imports survive the migration intact.

### Task 19: Migrate `question-set`

**Per-activity notes:**
- The component at `packages/core/src/components/question-set/QuestionSet.tsx` already imports `MultipleChoice` from `@kukui/activities/multiple-choice/Component` (Plan 1 commit `1a43595`).
- It also likely imports `FillInTheBlanks` similarly — by the time you reach this task, FIB is also migrated (Task 1), so update the import to `import FillInTheBlanks from "@kukui/activities/fill-in-the-blanks/Component";` if it currently points at the legacy path.
- The component composes other activity types as nested questions. Check for any other sibling-component imports and update them similarly.
- This activity is in `STUDIO_SUPPRESSED` — leave it there.

- [ ] **Steps:** Apply template. During Step 7, verify all sibling component imports point at `@kukui/activities/<sibling>/Component`.
- [ ] **Commit message:** `refactor(activities): migrate question-set into @kukui/activities (composite)`

---

### Task 20: Migrate `interactive-video`

**Per-activity notes:**
- Similar to question-set — embeds MultipleChoice and possibly FillInTheBlanks for video-overlay questions.
- The component at `packages/core/src/components/interactive-video/InteractiveVideo.tsx` already imports `MultipleChoice` from `@kukui/activities/multiple-choice/Component` (Plan 1 commit `1a43595`).
- Update sibling component imports during the move (same pattern as Task 19).
- Component may have timing/seek helpers — move all files in the folder.

- [ ] **Steps:** Apply template.
- [ ] **Commit message:** `refactor(activities): migrate interactive-video into @kukui/activities (composite)`

---

## Tier 3 — Asset-heavy activities (3 tasks)

These have binary samples (.glb 3D models). The template's Step 12 explicitly handles this; just verify after move that `apps/engine-web/dist/samples/<slug>/` includes the binaries after `pnpm --filter @kukui/engine-web build`.

### Task 21: Migrate `hotspot-2d`

**Per-activity notes:**
- Samples directory may contain image files — move them all (use `git mv apps/engine-web/public/samples/hotspot-2d/* packages/activities/hotspot-2d/samples/` and verify).
- The schema and component handle SVG hotspot coordinates over images.

- [ ] **Steps:** Apply template, paying attention to Step 12 for any non-JSON files in the samples folder.
- [ ] **Verify after migration:** `pnpm --filter @kukui/engine-web build && ls apps/engine-web/dist/samples/hotspot-2d/` includes all expected files.
- [ ] **Commit message:** `refactor(activities): migrate hotspot-2d into @kukui/activities`

---

### Task 22: Migrate `hotspot-3d`

**Per-activity notes:**
- Has `box.glb` (3D model) in samples. Studio also maintains its own copy at `apps/studio-app/public/samples/hotspot-3d/box.glb` (per Plan 1 explore findings) — leave Studio's copy untouched for now (it's referenced by `starters.ts:92` as a placeholder). Plan 3 (cleanup) handles the eventual deduplication.
- Component uses react-three-fiber. Internal modules likely include `HotspotPin.tsx`, scene setup, etc. — move all.

- [ ] **Steps:** Apply template.
- [ ] **Verify after migration:** `apps/engine-web/dist/samples/hotspot-3d/box.glb` exists; `pnpm test --run` includes hotspot-3d fixture tests.
- [ ] **Commit message:** `refactor(activities): migrate hotspot-3d into @kukui/activities (3D assets)`

---

### Task 23: Migrate `virtual-tour`

**Per-activity notes:**
- Has `box.glb` in samples. Same Studio-copy situation as hotspot-3d (`starters.ts:149` references it).
- Component uses react-three-fiber for scene navigation. Move all internal files in the folder.

- [ ] **Steps:** Apply template.
- [ ] **Verify:** `apps/engine-web/dist/samples/virtual-tour/box.glb` exists.
- [ ] **Commit message:** `refactor(activities): migrate virtual-tour into @kukui/activities (3D assets)`

---

## Tier 4 — Live-enabled activities (6 tasks)

These have `*Live.tsx` files in `apps/live-mode/src/activities/` that stay in place (per spec: "Live variants do not move into packages/activities/"). The migration must:
1. Set `live: true` in `meta.ts`
2. Update any imports inside the `*Live.tsx` file that referenced the OLD engine-component path
3. Update `apps/live-mode/src/LiveHost.tsx`'s if-chain dispatch if it imports the engine component directly

### Task 24: Migrate `straw-poll`

**Per-activity notes:**
- Live wrapper: `apps/live-mode/src/activities/StrawPollLive.tsx` + `useStrawPoll.ts` + `StrawPollLive.test.tsx`. These stay where they are.
- Check if `StrawPollLive.tsx` imports anything from `@kukui/core/components/straw-poll/...` — if so, rewrite to `@kukui/activities/straw-poll/Component`.
- `LiveHost.tsx:189-224` has a hardcoded if-chain dispatch using `StrawPollLive` (eagerly imported at the top). Those imports are from `apps/live-mode/src/activities/`, not from the engine — they don't need updating.
- `meta.ts`: `live: true`.

- [ ] **Steps:** Apply template A–K including I (Live wrapper). After moving, run `pnpm --filter @kukui/live-mode build` and confirm it builds.
- [ ] **Commit message:** `refactor(activities): migrate straw-poll into @kukui/activities (live=true)`

---

### Task 25: Migrate `confidence-meter`

**Per-activity notes:**
- Live wrapper: `ConfidenceMeterLive.tsx` + `useConfidenceMeter.ts`. Stay in place.
- This activity has NO basic.json fixture (Plan 1 Task 20 audit) — Step C becomes a no-op.
- `meta.ts`: `live: true`.

- [ ] **Steps:** Apply template, skipping Step C (no samples to move).
- [ ] **Commit message:** `refactor(activities): migrate confidence-meter into @kukui/activities (live=true, no samples)`

---

### Task 26: Migrate `word-cloud`

**Per-activity notes:**
- Live wrapper: `WordCloudLive.tsx` + `useWordCloud.ts`. Stay in place.
- No basic.json fixture (Task 20 audit) — skip Step C.
- `meta.ts`: `live: true`.

- [ ] **Steps:** Apply template, skipping Step C.
- [ ] **Commit message:** `refactor(activities): migrate word-cloud into @kukui/activities (live=true, no samples)`

---

### Task 27: Migrate `qa-board`

**Per-activity notes:**
- Live wrapper: `QABoardLive.tsx` + `useQABoard.ts`. Stay in place.
- No basic.json fixture (Task 20 audit) — skip Step C.
- `meta.ts`: `live: true`.

- [ ] **Steps:** Apply template, skipping Step C.
- [ ] **Commit message:** `refactor(activities): migrate qa-board into @kukui/activities (live=true, no samples)`

---

### Task 28: Migrate `quick-quiz`

**Per-activity notes:**
- Live wrapper: `QuickQuizLive.tsx` (no separate hook file — state is internal per Plan 1 exploration). Stays in place.
- No basic.json fixture (Task 20 audit) — skip Step C.
- `meta.ts`: `live: true`.

- [ ] **Steps:** Apply template, skipping Step C.
- [ ] **Commit message:** `refactor(activities): migrate quick-quiz into @kukui/activities (live=true, no samples)`

---

### Task 29: Migrate `isometric-chatroom` (special case)

**Per-activity notes:**
- This is the **stub-backed** activity — `packages/core/src/components/registry.ts:54` currently points it at `_stub/index.js`, NOT a real component. There's no `packages/core/src/components/isometric-chatroom/` directory to move from.
- Live wrapper: `IsometricChatroomLive.tsx` + `useIsometricChatroom.ts` + `IsometricRoom.tsx` + `IsometricChatroomLive.css` + `isometric-sprites.ts` in apps/live-mode. Those stay.
- Schema EXISTS at `packages/schemas/src/isometric-chatroom.ts` — move it per Step A.
- For Step B (component move): since there's no real engine component, **create a thin placeholder** at `packages/activities/isometric-chatroom/Component.tsx` that imports and re-exports `StubActivity` from `@kukui/core/components/_stub/StubActivity`:
  ```tsx
  import StubActivity from "@kukui/core/components/_stub/StubActivity";
  export default StubActivity;
  ```
  And a minimal `Component.test.tsx` that just imports and asserts it renders.
- Update `packages/core/src/components/registry.ts:54` to `"isometric-chatroom": lazy(() => import("@kukui/activities/isometric-chatroom/Component")),`
- No samples exist (Task 20 audit) — skip Step C.
- `meta.ts`: `live: true`.

- [ ] **Steps:** Apply template with the placeholder-component variation in Step B; skip Step C.
- [ ] **Commit message:** `refactor(activities): migrate isometric-chatroom (stub-backed engine component)`

---

## Final verification (after all 29 tasks)

### Task 30: End-to-end validation

**Goal:** confirm the bulk migration left the tree in a known-good state.

- [ ] **Step 1:** Confirm legacy maps are now empty (or near-empty):
  ```bash
  grep -c '":' apps/studio-app/src/uiSchemas.ts | head -1   # LEGACY_UI_SCHEMAS entries
  grep -c '":' apps/studio-app/src/starters.ts | head -1    # LEGACY_STARTERS entries
  grep -c '":' apps/studio-app/src/activityIcons.tsx | head -1  # LEGACY_ICONS entries
  ```
  Each should report a much smaller number than before (ideally 0 within the legacy maps, but shared identifiers and PLANNED_STUBS entries will keep some matches).

- [ ] **Step 2:** Confirm `packages/schemas/src/` no longer contains per-kind schemas:
  ```bash
  ls packages/schemas/src/*.ts | grep -v "index.ts\|appearance.ts\|migrate.ts\|scoring.ts\|shared.ts\|stub.ts\|url.ts\|\.test\."
  ```
  Should return empty.

- [ ] **Step 3:** Confirm `packages/core/src/components/` no longer contains per-activity folders:
  ```bash
  ls packages/core/src/components/
  ```
  Should list only `_live-preview/`, `_shared/`, `_stub/`, and `registry.ts`.

- [ ] **Step 4:** Run full typecheck:
  ```bash
  pnpm typecheck
  ```
  Expected: PASS.

- [ ] **Step 5:** Run full test suite:
  ```bash
  pnpm test --run 2>&1 | tail -10
  ```
  Expected: PASS. Test count should be around 568 + ~30 starter tests + manifest tests = ~600+.

- [ ] **Step 6:** Run full build:
  ```bash
  pnpm build 2>&1 | tail -15
  ```
  Expected: all three apps build.

- [ ] **Step 7:** SCORM package the full catalog:
  ```bash
  node packaging/pack-scorm.js --all 2>&1 | tail -5
  ls packaging/build/kukui-*.zip 2>/dev/null | wc -l
  rm -f packaging/build/kukui-*.zip
  ```
  Expected: ~25 zips (same as Plan 1).

- [ ] **Step 8:** Spot-check Studio dev:
  ```bash
  pnpm dev:studio &
  DEV_PID=$!
  sleep 8
  curl -sf http://localhost:5174/ -o /dev/null -w "HTTP %{http_code}\n"
  kill $DEV_PID 2>/dev/null; wait $DEV_PID 2>/dev/null
  ```
  Expected: HTTP 200.

- [ ] **Step 9:** Confirm working tree is clean of stray files:
  ```bash
  git status --short
  ```
  Expected: only the same pre-existing untracked files from Plan 1 (`CLAUDE.md` mod, `.claude/commands/`, `AGENTS.md`, `apps/live-mode/src/activities/CLAUDE.md`, `docs/ux-design.md`).

- [ ] **Step 10:** Tag the bulk migration as complete:
  ```bash
  git tag -a activity-colocation-bulk-migration -m "All 30 activities now live in packages/activities/<slug>/. Legacy aggregator maps in Studio reduced to (or near) empty; ready for Plan 3 cleanup."
  ```

---

## What this plan does NOT do (deferred to Plan 3)

- Remove the `LEGACY_*` / `PLANNED_STUBS` scaffolding from Studio aggregators (they're empty after this plan, but the merge spread still includes them — Plan 3 simplifies to just `MANIFEST_*`)
- Remove the duplicated `box.glb` files in `apps/studio-app/public/samples/{hotspot-3d,virtual-tour}/` (Studio-only assets used by starters.ts)
- Refactor `packages/schemas/src/index.ts` from `SchemaRegistry` literal to derive from `ACTIVITY_MANIFESTS` (currently each migration removes one entry; after this plan the literal is empty and can be replaced by a glob-derived merge)
- Delete the `packages/schemas/src/{slug}` subpath exports (Plan 3 audits each unused export)
- Refactor `apps/live-mode/src/LiveHost.tsx`'s if-chain dispatch into a barrel-driven registry (Plan 3 work)
- Rewrite the `/kukui` slash command for the new layout (Plan 4)
- Address the deferred workspace dep cycles (`activities ↔ schemas`, `activities ↔ core`) — Plan 3 considers extracting shared primitives to a leaf package
- Backfill missing `basic.json` fixtures for the 5 kinds with no samples (`confidence-meter`, `word-cloud`, `qa-board`, `quick-quiz`, `isometric-chatroom`)

---

## Execution notes for the orchestrator

- **Each task is independent of the others within a tier** — Tier 1 tasks can be done in any order (or by different agents working serially). Tier 2 tasks depend on Tier 1 (because they import sibling components that were migrated in Tier 1). Tier 3 and Tier 4 are independent of Tiers 1–2.
- **Don't dispatch parallel implementers** — each task touches several shared files (`registry.ts`, `uiSchemas.ts`, `starters.ts`, etc.). Two parallel migrations will conflict on these files. Serial is the safe choice.
- **Expect surprises per activity** — Plan 1 surfaced new wrinkles in nearly every task (cycle resolution, vite types, noUncheckedIndexedAccess, embedded sub-components, missing icons, ComponentType cast). The template above captures the patterns we know about; new ones will surface. The two-stage review (spec compliance + code quality) per task is still warranted.
- **After Tier 1 completes**, the merge order in aggregators becomes mostly empty. Watch for test count growing as more manifest tests land (each migration adds at least starter.test.ts; some add manifest.test.ts).

---

## Plan complete and saved to `docs/superpowers/plans/2026-05-21-activity-co-location-bulk-migration-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks. Each task touches many files (8–20 edits per activity), so spec + code review per task catches drift early.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch by tier with checkpoints for your review.

Which approach?
