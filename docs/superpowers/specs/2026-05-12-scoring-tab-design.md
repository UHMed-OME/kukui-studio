# Scoring tab — design

A new top-level tab in Kukui Studio, sitting between **Editor** and **Raw JSON**,
that owns every author-facing knob that affects what the LMS sees when the
learner finishes the activity. Today these knobs (`singlePoint`, `enableRetry`,
`enableSolutionsButton`, `passPercentage`, `overallFeedback` bands) live buried
in each activity's `behaviour` block in the Editor — the teacher has to scroll
past content fields to find them, and there's no single place that explains how
the choices map to the SCORM 1.2 row that lands in Lamakū's gradebook.

## Goal

A single tab where a teacher can:

1. Pick a **scoring mode** for the activity (Points, All-or-nothing, or
   Completion) — only the modes that make sense for this activity kind are
   shown.
2. Set the **pass threshold** via a slider when in Points mode.
3. Toggle **retry** and **show-solution** behaviour.
4. Edit **overall-feedback bands** (per-percentage messages shown to the
   learner after submit) in Points mode.
5. See a **gradebook preview** that re-renders as they drag the threshold —
   "if the learner scores N% the LMS will record `passed` / `failed`."
6. Read a short, plain-language summary of what gets sent to SCORM /
   Lamakū. No jargon-laden field-name documentation surface; that lives in
   a help link.

## Non-goals

- **Custom scaling.** SCORM 1.2 fixes the score range at 0–100. No custom
  weights, no per-question rubrics. (Question Set already has per-question
  `weight` — keep it in the Question Set editor, not here.)
- **Multi-attempt aggregation policy.** SCORM 1.2 records one score per
  session; the LMS decides how attempts roll up in the gradebook. The tab
  documents this; it doesn't try to override it.
- **Non-SCORM export targets.** Kukui Studio packages SCORM 1.2 only.
  This tab speaks SCORM 1.2.
- **Live activities** ship without a Scoring tab — they don't grade.

## Scoring modes

Three modes. Each activity declares which subset it supports.

| Mode | What learner sees | What SCORM gets |
| --- | --- | --- |
| **Points** | Raw correct count (e.g. "7 / 10 placed correctly") | `score.raw` = percent correct, `lesson_status` = `passed` if percent ≥ pass threshold else `failed` |
| **All-or-nothing** | "Fully correct" or "Try again" | `score.raw` = 100 if every item correct else 0, `lesson_status` = `passed` only on 100 |
| **Completion** | Same activity, no Check button | `score.raw` = 100 on submit / finish, `lesson_status` = `completed` always |

### Mode availability per activity kind

| Activity | Points | All-or-nothing | Completion |
| --- | :-: | :-: | :-: |
| Multiple Choice | ✅ (default) | ✅ | ✅ |
| Fill in the Blanks | ✅ (default) | ✅ | ✅ |
| Drag and Drop | ✅ (default) | ✅ | ✅ |
| Question Set | ✅ (default) | ✅ | ✅ |
| Hotspot 2D / 3D | — (single-answer) | ✅ (default) | ✅ |
| Sequence Steps | ✅ (default) | ✅ | ✅ |
| Matching Pairs | ✅ (default) | ✅ | ✅ |
| Categorization | ✅ (default) | ✅ | ✅ |
| Anatomy Labeling | ✅ (default) | ✅ | ✅ |
| Highlight Text | ✅ (default) | ✅ | ✅ |
| Crossword | ✅ (default) | ✅ | ✅ |
| Image Annotation | ✅ (default) | ✅ | ✅ |
| Concept Map | ✅ (default) | ✅ | ✅ |
| Interactive Video | ✅ (default — aggregated across interactions) | ✅ | ✅ |
| Lab Panel | ✅ (default) | ✅ | ✅ |
| DDx Tree | — (path-based) | ✅ (default — correct diagnosis or not) | ✅ |
| OSCE | ✅ (default — phase aggregate) | ✅ | ✅ |
| Branching Scenario | — | ✅ (default — outcome-based) | ✅ |
| Image Comparison Slider | — | — | ✅ (only mode) |
| Flashcards | — | — | ✅ (only mode) |
| Reflection Prompt | — | — | ✅ (only mode) |
| Audio Recording | — | — | ✅ (only mode) |
| Virtual Tour | — | — | ✅ (only mode) |

Live activities (Straw Poll, Confidence Meter, Word Cloud, Q&A Board, Quick
Quiz) have no Scoring tab — the tab header is hidden for those kinds.

## Schema changes

Today each activity stores scoring as scattered booleans inside `behaviour`:

```json
"behaviour": {
  "enableRetry": true,
  "enableSolutionsButton": true,
  "singlePoint": false
}
```

…with `passPercentage` and `overallFeedback` floating elsewhere on the root.
That representation muddles "is this scored?" and "how is it scored?" together.

Replace with a typed discriminated union under a new `scoring` block. The
shape is identical across every kind; the new field is what the Scoring tab
reads and writes.

```ts
type Scoring =
  | { mode: "points"; passPercentage?: number; bands?: ScoreBand[] }
  | { mode: "all-or-nothing" }
  | { mode: "completion" };
```

Per-activity behaviour fields that aren't *about scoring* stay in `behaviour`
(e.g. `randomAnswers`, `caseSensitive`, `aspectRatio`, `interaction`,
`acceptSpellingErrors`). The split is:

- **`behaviour`** = how the activity *plays*
- **`scoring`** = how the activity *counts*
- **`ui`** = button label overrides (unchanged)

### Migration

The Studio session must be able to open existing drafts without breaking. On
load, before validation, run a one-shot migrator that maps the old shape to
the new one:

| Old | New |
| --- | --- |
| `behaviour.singlePoint: true` | `scoring.mode: "all-or-nothing"` |
| `behaviour.singlePoint: false` or omitted | `scoring.mode: "points"` |
| `passPercentage` (root) | `scoring.passPercentage` |
| `overallFeedback` (root) | `scoring.bands` |
| `behaviour.enableRetry` | `scoring.enableRetry` |
| `behaviour.enableSolutionsButton` | `scoring.enableSolutionsButton` |
| Completion-only activities (Flashcards etc.) | `scoring.mode: "completion"` |

`enableRetry` and `enableSolutionsButton` move to a sibling block on the
new scoring root (still typed as part of `scoring` for ergonomics):

```ts
type Scoring =
  | { mode: "points"; passPercentage?: number; bands?: ScoreBand[];
      enableRetry?: boolean; enableSolutionsButton?: boolean }
  | { mode: "all-or-nothing";
      enableRetry?: boolean; enableSolutionsButton?: boolean }
  | { mode: "completion"; enableRetry?: boolean };
```

(`enableSolutionsButton` doesn't make sense in Completion mode — there's no
"solution" to reveal when the activity isn't scored — so it's not in that
variant.)

The migrator runs in three places: the form's draft loader, the JSON-import
path, and the AI-editor response parser. Old-shape JSON keeps working.

### What about Question Set?

Question Set keeps its existing `passPercentage` at the set level — it acts
as the overall scoring threshold, which is exactly what the new
`scoring.passPercentage` represents. The migrator just moves the field.
Per-question `weight` stays where it is (it's a content concern, not a
scoring-tab concern).

## UI

The tab has a single column. Top-to-bottom:

```
┌─ Scoring ─────────────────────────────────────────────────┐
│                                                           │
│  How is this activity graded?                             │
│  ○ Points          (raw correct count → percent)          │
│  ◉ All-or-nothing  (full credit only when fully correct)  │
│  ○ Completion      (always passed when finished)          │
│                                                           │
│  ──────────────────────────────────────────────────────   │
│                                                           │
│  Pass threshold                              ▼ 50%        │
│  [——————●——————————]   0%               100%              │
│  Learners scoring at or above 50% are recorded as         │
│  "passed" in the LMS gradebook.                           │
│                                                           │
│  ──────────────────────────────────────────────────────   │
│                                                           │
│  Retry & solution                                         │
│  [✓] Let learners try again                               │
│  [✓] Show "Show solution" button after submit             │
│                                                           │
│  ──────────────────────────────────────────────────────   │
│                                                           │
│  Feedback messages (optional)                             │
│  ┌───────────────────────────────────────────────────┐   │
│  │ 0–49%   "Review the chapter and try again."       │   │
│  │ 50–84%  "Solid work — keep going."                │   │
│  │ 85–100% "Excellent."                              │   │
│  │ + Add band                                        │   │
│  └───────────────────────────────────────────────────┘   │
│                                                           │
│  ──────────────────────────────────────────────────────   │
│                                                           │
│  What the LMS will record                                 │
│  ┌───────────────────────────────────────────────────┐   │
│  │ Simulated learner score: 7 / 10 (70%)             │   │
│  │ [—————————●———] drag to test                       │   │
│  │                                                   │   │
│  │ Lamakū gradebook row:                             │   │
│  │   • Score: 70 / 100                                │   │
│  │   • Status: passed                                 │   │
│  │   • Feedback shown: "Solid work — keep going."    │   │
│  └───────────────────────────────────────────────────┘   │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

Adapts to mode:

- **Points** — show all sections (mode picker, threshold slider, retry,
  bands, preview).
- **All-or-nothing** — hide the threshold slider (effectively 100%); hide
  the bands editor (a band per percentage doesn't make sense when the only
  outcomes are 0% and 100%). Keep retry + preview.
- **Completion** — show only the mode picker, retry toggle (if applicable),
  and a fixed preview: *"Lamakū will record `score: 100`, status:
  `completed` when the learner finishes."*

For activities that only support one mode (Flashcards, Reflection, etc.),
the mode picker collapses to a one-line summary: *"This activity records
completion only — there's nothing here to configure."* Plus the gradebook
preview row.

### Component breakdown

Each section is a small, isolated component:

- `ScoringModePicker` — radio group; reads `scoring.mode`, writes new mode
  (with the right zero-state for the other discriminant branches).
- `PassThresholdSlider` — 0–100 integer slider with a numeric input
  alongside (for keyboard / precise typing). Disabled when mode ≠ points.
- `RetrySolutionToggles` — two checkboxes; read/write `behaviour.enableRetry`
  + `behaviour.enableSolutionsButton`.
- `BandsEditor` — list of `{ from, to, message }` rows. Add, delete,
  reorder, with overlap detection (warn if two bands cover the same
  percent). Disabled outside points mode.
- `GradebookPreview` — pure render from current `scoring` + a local "what if
  the learner scored X%" slider state. Shows the LMS row in plain language;
  no SCORM field names. A small "Show SCORM fields" disclosure expander
  reveals `score.raw / score.max / lesson_status` for the curious.

The tab itself is `<ScoringTab kind={kind} value={value} onChange={markDirty} />`,
mirroring the `Preview` and `JsonEditor` panes.

### Where existing fields disappear from the Editor

After the migration, the Editor's `behaviour` block no longer shows:

- `singlePoint`
- `passPercentage` (Question Set + Interactive Video — moves to root
  `scoring.passPercentage`)
- The root-level `overallFeedback` block (moves to `scoring.bands`)

uiSchema files for each affected activity drop those entries. Tooltips
in the Editor on the remaining `behaviour` fields stay scoped to playback
(retry, shuffle, random-answers, etc.).

`enableRetry` and `enableSolutionsButton` move to the Scoring tab too — the
teacher's mental model groups "can they try again / see the answer" with
grading, not with playback. After migration the Editor's `behaviour` block
holds only true playback knobs (`randomAnswers`, `shuffle`, `caseSensitive`,
`interaction`, `aspectRatio`, etc.) and the Scoring tab owns every
post-submit affordance.

## SCORM mapping (reference)

What the Scoring tab actually controls under the hood, for anyone reading
this doc later:

```
scoring.mode = "points"
  → score.raw = (correct / total) * 100   (rounded)
  → score.max = 100
  → score.min = 0
  → lesson_status = "passed" if score.raw ≥ passPercentage else "failed"

scoring.mode = "all-or-nothing"
  → score.raw = 100 if fully correct else 0
  → score.max = 100
  → lesson_status = "passed" if fully correct else "failed"

scoring.mode = "completion"
  → score.raw = 100
  → score.max = 100
  → lesson_status = "completed"
```

The `postScore(raw, max, success)` bridge call in [scorm.ts](../../packages/core/src/scorm.ts)
already scales raw/max to 0–100 and writes `passed/failed`. The new mode
just controls which `(raw, max, success)` triple the activity emits. No
bridge changes.

## Edge cases

- **Empty bands when in Points mode** — fine; no feedback message is
  shown to the learner. The gradebook still records pass/fail.
- **Bands that don't cover 0–100** — fine; learner sees no message in the
  gaps. Warn the author with a one-liner: *"Tip: your bands cover 0–84%
  and 90–100%. Learners scoring 85–89% will see no feedback message."*
- **Bands that overlap** — first matching band wins (existing behaviour).
  Warn the author in the bands editor with red text under the offending
  row.
- **`passPercentage = 0`** in Points mode — every score passes. Surface in
  the preview ("Every learner who finishes is recorded as passed.") so
  the author understands the implication.
- **`passPercentage = 100`** in Points mode — equivalent to all-or-nothing.
  Suggest switching mode via an inline link.
- **Pre-migration draft** — open with old schema; migrator transforms on
  load; first edit re-serializes in new shape. The draft localStorage key
  doesn't need to change.

## What we ship

1. New `Scoring` type + Zod schema in [packages/schemas/src/_shared.ts](../../packages/schemas/src/_shared.ts);
   added to every per-activity config schema as an optional field
   (`scoring: ScoringSchema.optional()` — required only after migration
   runs).
2. Migrator in [packages/schemas/src/migrate.ts](../../packages/schemas/src/migrate.ts)
   (new file): `migrateToScoring(config) → config` idempotent.
3. Migrator wired into:
   - The Studio draft loader (`apps/studio-app/src/App.tsx` — `loadDraft` path)
   - The JSON-import path (`apps/studio-app/src/scormImport.ts`)
   - The AI editor response handler (`apps/studio-app/src/AIEditor.tsx`)
4. New tab in `apps/studio-app/src/App.tsx` between Editor and Raw JSON.
   Hidden for Live activity kinds.
5. New `apps/studio-app/src/ScoringTab/` directory with:
   - `ScoringTab.tsx` (root)
   - `ScoringModePicker.tsx`
   - `PassThresholdSlider.tsx`
   - `RetrySolutionToggles.tsx`
   - `BandsEditor.tsx`
   - `GradebookPreview.tsx`
   - `MODE_AVAILABILITY.ts` (per-activity-kind table)
6. uiSchema cleanup in `apps/studio-app/src/uiSchemas.ts`: remove
   `singlePoint`, `passPercentage`, `overallFeedback`, `enableRetry`,
   `enableSolutionsButton` entries from every affected kind.
7. Update activity runtimes to read `config.scoring` instead of
   `config.behaviour.singlePoint` / `config.passPercentage` /
   `config.overallFeedback`. Mostly one-line changes per activity that
   call into a tiny helper in [packages/core/src/scoring.ts](../../packages/core/src/scoring.ts)
   (`computeScore(mode, correct, total)` → `{ raw, max, success }`).
8. Tests:
   - Migrator round-trips for every shape combination.
   - Each affected activity's runtime test gets a new case: mode
     completion yields raw=100/max=100/success=true regardless of
     correctness.
   - Snapshot the gradebook preview's plain-language output for each mode.

## Open questions (none blocking)

None for v1. Listed in case they come up in implementation:

- Should Question Set's per-question `weight` move into Scoring too? My
  call is no — it's a content-level concern (which question matters more),
  and putting it in Scoring would mean adding a question-aware nested UI
  to the Scoring tab. Keep it in the Editor on the per-question card.
- Should there be a global "Don't post to SCORM" mode for previews /
  demos? Out of scope — that's a packaging concern, not a per-activity
  one.
