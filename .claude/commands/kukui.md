---
description: Author content for an existing Kukui activity OR scaffold a brand-new activity type. Routes via a first-question prompt.
argument-hint: "[activity-slug | learning-objective]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# /kukui — Activity authoring and scaffolding

Two modes, one entry point. Step 0 routes the conversation; everything after Step 0 is mode-specific.

- **Content flow** — write a new JSON fixture for an activity type that already exists under `packages/activities/{slug}/`.
- **Scaffold flow** — create a brand-new activity type from a learning objective, ending in one folder under `packages/activities/{slug}/`.

You are helping the user. Never narrate which mode the command is "in" — just route, then act.

---

## Step 0 — Mode

Ask the user a single multiple-choice question:

> Which would you like to do?
> A) Author content for an EXISTING activity type
> B) Scaffold a NEW activity type

Pre-select a default from `$ARGUMENTS` before asking:

- If `$ARGUMENTS` is a kebab-case slug that exists under `packages/activities/` → default **A** (Content flow).
- If `$ARGUMENTS` is a verb-phrase learning objective — contains modal verbs like *should / will / can*, or pedagogical verbs like *identify / distinguish / order / explain / differentiate / sequence / interpret / diagnose* — default **B** (Scaffold flow).
- If `$ARGUMENTS` is a slug-shaped string that does NOT exist under `packages/activities/` → default **B** with a confirmation: *"`{slug}` isn't an existing activity type — looks like a new one. Want to scaffold it?"*
- If `$ARGUMENTS` is empty → no default; ask plainly.

The user can always override the default. Once routed, jump directly to **Step 1** (Content flow) or **S1** (Scaffold flow). Do not ask again.

---

## Content flow (existing activity)

### Step 1: Pick the activity

If `$ARGUMENTS` carries a known slug, use it. Otherwise list the contents of `packages/activities/` (excluding any directory whose name starts with `_`, and excluding `src/`, `dist/`, `node_modules/`) and ask the user which slug. Slugs are kebab-case (e.g. `multiple-choice`, `hotspot-3d`).

### Step 2: Read the canon

Before asking the user anything content-shaped, read (do not summarize back):

1. `packages/activities/{slug}/schema.ts` — the Zod schema (required vs optional fields, discriminators, defaults).
2. `docs/design-system.md` — visual/UX rules so generated copy respects tone and length norms.
3. `packages/activities/{slug}/samples/basic.json` if it exists — structural reference.
4. `packages/activities/{slug}/starter.ts` — the minimal valid shape, useful when the schema is large.

Project memory rules (apply throughout):

- Never write "H5P" in the file or in comments. Field names that happen to mirror H5P conventions are fine — just do not reference the inheritance.
- Don't invent design-token values (colors, sizes, spacing). Runtime owns those; the JSON references appearance tokens, never raw hex.

### Step 3: Walk the fields, one at a time

**One question per turn.** Prefer multiple choice over open-ended whenever the schema constrains the answer (enum, boolean, small finite set). For each required field in the schema, ask. For optional fields with sensible defaults, mention the default and let the user opt in or opt out.

Show, don't lecture: when a field has tricky syntax (cloze blanks, hotspot coordinates, drop-zone IDs), give a one-line example rather than a paragraph of explanation.

**Strongly encourage per-item `feedback` fields.** Per the design system, that's the highest-leverage teaching moment — generic "Correct!" / "Incorrect" is a missed opportunity. Ask explicitly for both correct-answer reinforcement and incorrect-answer redirection.

Cross-check referential integrity by hand — Zod won't catch these:

- Every `correctZones[]` ID must match a drop-zone ID.
- Every `requiredOverlayIds[]` must match an overlay ID.
- Every nested question-set config must itself be valid against the nested schema.
- Branching `next` IDs must reference defined nodes.

If a value is unclear (a 3D hotspot coordinate, a drop-zone bounding box, a media URL), ask — do not guess.

### Step 4: Save

Default path: `packages/activities/{slug}/samples/{filename}.json` — kebab-case filename, 2-space indent. The engine-web and studio-app Vite plugins serve fixtures at `/samples/{slug}/{filename}.json` automatically; no other paths to mirror.

### Step 5: Confirm

Tell the user where the file landed and how to preview it:

```
pnpm dev:studio
```

Then in the running Studio, click **Import** and select the JSON you just wrote. If the user wants to ship it as the activity's canonical example, suggest naming it `basic.json` (which the fixtures auto-discovery test will validate against the schema on next run).

---

## Scaffold flow (new activity type)

You are designing a brand-new activity type from a learning objective. The design pass (S1–S5) happens entirely in conversation. The write phase (the "Scaffold write" section below) is a single folder; no shared files to edit.

### S1 — Learning objective intake

Ask one open-ended question, framed around the learner not the content:

> What should the learner be able to do after completing this activity?

Give two or three concrete example objectives so the user calibrates:

- *"distinguish benign from malignant breast histology on H&E slides"*
- *"order the steps of a focused neurologic exam"*
- *"identify the anatomical landmarks of the brachial plexus"*

If `$ARGUMENTS` already parses as an objective (verb-phrase, no slug-shape), accept it directly and confirm: *"Using this objective: '{objective}'. Sound right?"* before continuing.

### S2 — Proposal slate

Read JSDoc and the `description` export from every existing activity:

```bash
ls packages/activities/
```

Then for each candidate read `packages/activities/{slug}/schema.ts` (for JSDoc and shape) and `packages/activities/{slug}/meta.ts` (for `label`, `description`, `bloom`).

Surface **2–4 proposals**, mixing tags:

- `[EXISTING: slug]` — an existing activity type that could carry this objective.
- `[NOVEL: proposed-slug]` — a brand-new type worth building.

Each proposal includes:

- **Inherits** (existing) or **Why novel** (novel) — one line.
- **Fit** — one-line pedagogical rationale tied to the S1 objective.
- **How it fits in Kukui:**
  - **Modes** — Engine async (✓/✗), Studio authoring (✓/✗), Live (✓/partial/✗).
  - **Leverages** — names existing shared building blocks it would reuse (e.g. `_shared/HotspotPin`, the `ScoringSchema` discriminator, `AppearanceSchema`, `MediaSchema`).
  - **Authoring** — can Studio's GUI cover this fully, or does the author need to drop into JSON for some fields?
  - **Tracking** — what SCORM `cmi.interactions` shape this maps to (choice, fill-in, performance, sequencing, etc.).
- **Cost** — minutes-to-author (existing) OR days-to-build (novel).
- **Reusable across modules?** — novel proposals only. Be honest: a one-off activity that only fits this objective is worth less than one that generalizes.

**Bias toward existing.** If any existing type cleanly covers the objective, say so plainly and recommend authoring content for it instead of scaffolding novel. Novel proposals come with honest cost vs reusability framing — the user should feel the trade-off.

**Novel guard.** Before finalizing a `[NOVEL]` option, check the proposed slug against existing slugs (`ls packages/activities/`) for:

- Prefix overlap (e.g. proposing `hotspot-anatomy` when `hotspot-2d` and `hotspot-3d` exist — these probably should be a variant of one of them, not novel).
- Single-edit distance (proposing `flashcard` when `flashcards` exists — almost certainly a typo or a fork candidate).

Too close → demote the proposal to *"Fork {existing-slug}"* with a one-line note on what the fork would add.

### S3 — Branch on choice

- `[EXISTING: slug]` → **bail out of the scaffold flow entirely.** Drop into the Content flow at Step 1 on that slug. Do not write any new files.
- `[NOVEL: proposed-slug]` → continue to **S3a** then **S3b**.
- *"None of these"* → ask one open description prompt (*"Describe what you have in mind in a sentence or two"*), pattern-match against the proposal slate again. If still no fit, scaffold novel using the description.

### S3a — Schema axes confirmation (proposal-driven)

Infer four axes from the S1 objective + the chosen proposal's description, then present each with one-sentence reasoning and ask *confirm or override?* Do not ask if inference is unambiguous (e.g. an objective phrased "click on the X" obviously maps to `input: click`).

**Axes:**

- **Scoring model** — `binary` / `per-item` / `weighted` / `free-response` / `none`. Maps to the `ScoringSchema` discriminator.
- **Input modality** — `click` / `drag` / `type` / `draw` / `speak` / `multi`.
- **Layout** — `single-canvas` / `list-of-items` / `multi-step` / `split-pane`.
- **Media dependencies (multi-select)** — `image` / `audio` / `video` / `3d-model` / `none`.

These four answers shape the schema draft used in S3b. Record them.

### S3b — Field walk

Generate a schema draft. Boilerplate fields auto-fill silently:

- `version: z.literal(1)` (always 1 at scaffold time)
- `title: z.string()` (always required)
- `appearance: AppearanceSchema.optional()` (always optional, imports from `@kukui/schemas/shared`)
- `scoring: ScoringSchema` shaped by S3a's scoring model

Walk only the **meaningful custom fields** with the user. One question per field, framed as *"tweak or accept?"* — show the proposed shape, ask if it's right.

If the user says *"I don't know what shape that should be"* → show 2–3 example shapes from existing schemas (read them with the Read tool, don't invent), with one-line trade-off notes. Let the user pick.

Cross-check referential integrity by hand for every field that references another (e.g. `correctZones[]` IDs must match drop-zone IDs in the same config; `requiredSteps[]` must match step IDs).

### S4 — Sample fixture via content-flow hand-off

Once the schema compiles (mentally — no actual compile yet), drop into the **Content flow at Step 3** on the newly designed slug to author `basic.json`. You already know the schema (you just designed it) so Step 2's reads collapse to just `docs/design-system.md`.

At the end of S4, ask whether to also generate:

- `samples/full.json` — uses every optional field, useful as a feature showcase.
- `samples/_invalid/missing-required-field.json` — negative case the fixtures test will assert *rejects* against the schema.

**Default: yes to both.** The user can opt out.

### S5 — Live variant gate

Pre-answer based on the activity's nature:

- **Suggest "no"** if the activity is single-learner reflection, async-only, or has no shared state worth synchronizing (e.g. a flashcard deck, a reading + reflection, a self-paced quiz).
- **Suggest "yes"** if the activity is inherently discussion-shaped, discrimination-of-the-room (everyone votes on the same image), or sequencing where seeing peer choices is part of the pedagogy.

Phrase the question as: *"Based on what we've built, this {does / doesn't} look like a fit for a Live classroom variant because {reason}. Want me to scaffold one anyway?"* User can override either way.

---

## Scaffold write

After the S1–S5 design pass, write **one folder** under `packages/activities/{slug}/`. No shared-file edits required except a small addition to `packages/activities/package.json` exports.

### Files to write (all required unless noted)

```
packages/activities/{slug}/
├── manifest.ts             # wires kind, schema, lazy Component, uiSchema, starter, label/description/bloom/live, optional Icon
├── schema.ts               # Zod schema. Imports ScoringSchema / AppearanceSchema from @kukui/schemas/shared. JSDoc cites S1 objective verbatim.
├── Component.tsx           # Layout-stable shell using design system tokens. Default-export renamed to `Component`. Imports ActivityProps from @kukui/core/types if needed.
├── Component.test.tsx      # Minimal Vitest render-smoke test (mounts with starter config; asserts no throw).
├── Component.css           # OPTIONAL. Only if Tailwind tokens aren't enough. Most activities skip this.
├── samples/
│   ├── basic.json          # The fixture produced in S4. Required.
│   ├── full.json           # OPTIONAL (if user opted in at end of S4).
│   └── _invalid/
│       └── missing-required-field.json   # OPTIONAL (if user opted in at end of S4).
├── ui-schema.ts            # RJSF uiSchema for Studio. Starts as a generated stub derived from the Zod shape. Hand-tuning is a follow-up TODO.
├── starter.ts              # Minimal valid config matching the schema.
├── starter.test.ts         # Asserts `starter` parses against the schema (one-line Vitest test).
├── icon.tsx                # OPTIONAL placeholder SVG. If you skip it, omit `Icon` from the manifest.
└── meta.ts                 # `label`, `description` (cites S1 objective verbatim), `bloom: BloomLevel`, `live: boolean` (from S5).
```

### Package.json exports edit

Edit `packages/activities/package.json` and add two entries to the `exports` block (alphabetically among siblings):

```json
"./{slug}/Component": "./{slug}/Component.tsx",
"./{slug}/schema": "./{slug}/schema.ts",
```

### Optional Live variant (only if S5 = yes)

Write `apps/live-mode/src/activities/{PascalSlug}Live.tsx` with:

```tsx
export const liveActivity = { kind: "{slug}", Component: {PascalSlug}Live };
```

The local barrel `apps/live-mode/src/activities/index.ts` picks it up via glob.

### What auto-discovery handles for free

You do NOT edit any of these. Glob picks the new manifest up on the next typecheck:

- `SchemaRegistry` (in `@kukui/schemas`)
- `ACTIVITY_REGISTRY` (in `@kukui/core`)
- `UI_SCHEMAS`, `STARTERS`, `ACTIVITY_LABELS`, `BLOOM_BY_KIND`, `ActivityIcon` (in `apps/studio-app/src/`)
- `fixtures.test.ts` (in `@kukui/schemas`) — auto-asserts `basic.json` parses, `full.json` parses, `_invalid/*.json` rejects
- Engine-web's per-activity HTML page glob
- `packaging/pack-scorm.js` directory scan
- Live's barrel and cross-reference test (if the Live wrapper was written)

---

## Slug guards (pre-flight, both modes)

Before doing anything in either mode, validate the slug:

- **Lowercase kebab-case, ASCII only** (`/^[a-z][a-z0-9-]*$/`). Reject otherwise.
- **No leading underscore.** Underscores are reserved for shared infrastructure (`_shared/`, `_stub/`, etc.).
- **Scaffold mode:** reject if `packages/activities/{slug}/` already exists. If the user wanted that slug, they're in Content mode, not Scaffold.
- **Content mode:** reject if the slug is NOT in `packages/activities/`. Suggest the closest existing slug if there's an obvious near-match.
- **Warn (don't block)** if the slug is single-edit distance (one character insert/delete/substitute) from any existing slug. Probably a typo or a fork candidate worth a second thought.
- **Reject** if `PascalSlug` (the slug Pascal-cased) collides with a JSX intrinsic — `Img`, `Input`, `Label`, `Form`, `Select`, `Option`, `Table`, etc. The Component identifier needs to be safe to use in JSX.

---

## Verify (scaffold mode only)

After writing the folder + the `packages/activities/package.json` exports edit (and the optional Live wrapper), run:

```bash
pnpm typecheck && pnpm test --run
```

Both must be green before reporting scaffold complete.

- If **typecheck fails**, the most likely cause is a forgotten import rewrite in `Component.tsx` (e.g. importing from `@kukui/schemas/{slug}` instead of the new local `./schema.js`). Read the error and fix.
- The fixtures auto-discovery test will exercise the new `samples/basic.json` against the new `schema.ts` automatically. No manual test wiring needed.
- If `samples/_invalid/*.json` was written, the test will assert those reject. If a "negative case" accidentally parses (because the schema is more permissive than expected), either tighten the schema or pick a different invalid shape.

---

## End-of-run report

After verify passes, print:

1. **Files created** — as a tree, with the activity folder root and each file relative to it.
2. **Preview command:**
   ```
   pnpm dev:studio
   ```
   Then in Studio, click **Import** and select `packages/activities/{slug}/samples/basic.json`.
3. **Follow-up TODOs** — print only the ones that genuinely apply:
   - `ui-schema.ts is a generated starting point — hand-tune labels / help text / widget choices in packages/activities/{slug}/ui-schema.ts`
   - `icon.tsx is a placeholder — draw the real icon` (only if you wrote a placeholder)
   - `Component.tsx is layout-stable but inert — wire up interactions, scoring, and feedback display`
   - `Live wrapper is stubbed — implement CRDT shape via @kukui/live + Y.js in apps/live-mode/src/activities/{PascalSlug}Live.tsx` (only if S5 = yes)

For Content mode, the end-of-run report is just Step 5's confirmation.

---

## Hard rules (CLAUDE.md)

These apply to every file you write, in both modes:

- **Never write "H5P"** in any generated file, comment, or commit message.
- **Never invent design-token values** (hex colors, spacing values, font sizes, border widths). Only reference tokens defined in `docs/design-system.md`. If you need a new token, the user adds it to the doc *first* — do not bake raw values into JSON or CSS.
- **WCAG 2.2 AA in component skeletons:**
  - 44 × 44 px hit targets via `min-h-11 min-w-11` (or the design-system Tailwind equivalent).
  - Layout-stable state changes — constant border widths, reserved space for state indicators, change colors only.
  - Color is never the sole signal — pair every color cue with text, icon, or position.
- **Generated JSDoc on `schema.ts` cites the S1 learning objective verbatim** — quote it on the schema's top-level docblock so future readers know the activity's *why*.
- **Don't write outside the activity folder.** Scaffold mode may only touch `packages/activities/{slug}/`, the small `packages/activities/package.json` exports edit, and the optional Live wrapper file. Content mode may only touch `packages/activities/{slug}/samples/`. No other writes — no doc updates, no registry edits, no test-config tweaks.

---

## Style rules (content mode)

- One question at a time. Prefer multiple-choice over open-ended whenever the schema's value set is finite.
- Show, don't lecture — a one-line example beats a paragraph.
- Strongly encourage per-item / per-answer `feedback` fields. Per the design system, that's the highest-leverage teaching moment.
- Don't invent. If a value is unclear (a 3D hotspot coordinate, a drop-zone bounding box, a media URL), ask the user.
- Don't write outside `packages/activities/{slug}/samples/`. This mode authors content only.
