# `/kukui` scaffold mode — design

**Status:** design approved 2026-05-15 — implementation plan pending
**File touched:** [.claude/commands/kukui.md](../../../.claude/commands/kukui.md)

## Why this exists

Kukui already has ~30 activity types. Adding a new one is a 8–13-file change across four packages — schema, registry, core types, components, Studio uiSchemas/starters, samples, fixture test, and (optionally) Live variant. Doing it by hand is error-prone: a typo in `BuiltActivityKind` breaks every consumer; a missing `uiSchemas.ts` entry makes Studio silently fall back to raw JSON; a forgotten `fixtures.test.ts` append leaves the negative-case net incomplete.

At the same time, **most learning objectives don't need a new activity type** — the catalog is broad. A scaffold command that doesn't actively resist premature new-type creation will balloon the codebase.

The revised `/kukui` is therefore two things:
1. **An instructional-design partner** — given a learning objective, propose 2–4 designs (mixing existing types and novel patterns), each with fit, cost, and "how it fits in Kukui" framing.
2. **A scaffold generator** — when novel work is genuinely warranted, write the full vertical slice with type-check gates between batches.

The existing content-authoring flow (today's Steps 1–5) is preserved and reachable from both the top-level branch and from the scaffold flow's S4.

## Top-level shape

`/kukui` opens with a single mode question:

```
A) Author content for an EXISTING activity type   → content flow (today's Steps 1–5)
B) Scaffold a NEW activity type                   → scaffold flow (S1–S5)
```

`$ARGUMENTS` can pre-select but doesn't bypass the question:
- Slug present in `SchemaRegistry` → default A
- Slug absent or unknown → default B
- No args → no default; ask

Both flows share two helpers:
- **Read the canon** — `docs/design-system.md`, `docs/ux-design.md`, `docs/research-foundations.md`, plus the relevant schema file (content flow) or `stub.ts` + 1–2 representative schemas (scaffold flow)
- **Save & confirm coda** — same shape: file tree + preview command + follow-ups

The command's `allowed-tools` frontmatter expands from `Read, Write, Bash, Glob` to add `Edit` and `Grep`.

## Scaffold flow (Steps S1–S5)

### S1 — Learning objective intake

One open-ended question: *"What should the learner be able to do after this activity?"* Accept a paragraph; one optional follow-up only when truly needed (target learner level, async vs. live, time budget).

`$ARGUMENTS` containing an objective-shaped string is used directly.

### S2 — Proposal slate

The command reads JSDoc/title from every `packages/schemas/src/*.ts` (excluding `index.ts`, `appearance.ts`, `migrate.ts`, `scoring.ts`, `stub.ts`, `url.ts`, `*.test.ts`) and surfaces 2–4 proposals. Each is labeled `[EXISTING: slug]` or `[NOVEL: proposed-slug]` and includes:

- **Inherits / Why novel** — what comes pre-built vs. what new ground is being broken
- **Fit** — one-line pedagogical rationale tied to the S1 objective
- **How it fits in Kukui** — multi-line block covering:
  - **Modes:** Engine (async, SCORM) / Studio authoring / Live classroom — each marked ✓ / partial / ✗
  - **Leverages:** specific `_shared/` primitives, `ScoringSchema` discriminator, design-system tokens
  - **Adds:** (novel only) what new capability this introduces to the platform; cite `docs/research-foundations.md` section when relevant
  - **Authoring:** can it be authored entirely via Studio's GUI? Or does it need code?
  - **Tracking:** how it reports to SCORM `cmi.interactions`
- **Cost** — minutes-to-author for existing; days-to-build for novel
- **Reusable across modules?** — explicit yes/no on whether the pattern generalizes (novel only)

**The slate biases toward existing.** When any existing type cleanly covers the objective, the command says so plainly and recommends authoring content rather than scaffolding. Novel proposals come with honest cost vs. reusability framing.

**Novel-proposal guard:** before finalizing a `[NOVEL]` option, the command checks the proposed slug against existing slugs for prefix overlap or single-edit distance. Too close → demote to "Fork `existing-slug`" instead.

### S3 — Branch on choice

| User picks | Flow |
|---|---|
| `[EXISTING]` proposal | Bail out of scaffold mode → drop into content-authoring flow (Steps 1–5) on that slug |
| `[NOVEL]` proposal | Continue to S3a (schema axes) → S3b (field walk) |
| "None of these" | One open description prompt → pattern-match against existing 30 again with the new info → if still no fit, scaffold novel |

### S3a — Schema axes (novel mode, proposal-driven)

The command **infers** four axes from the objective and proposal description, presents each with reasoning, and asks for confirmation (or override). No question is asked unless the inference is genuinely ambiguous.

- **Scoring model:** `binary` / `per-item` / `weighted` / `free-response` / `none` (maps to `ScoringSchema` discriminator in `packages/schemas/src/scoring.ts`)
- **Input modality:** `click` / `drag` / `type` / `draw` / `speak` / `multi`
- **Layout:** `single-canvas` / `list-of-items` / `multi-step` / `split-pane`
- **Media dependencies (multi-select):** `image` / `audio` / `video` / `3d-model` / `none`

These selections drive the starter schema skeleton and the component shell.

### S3b — Field walk

Starting from a generated schema draft (boilerplate `version` / `title` / `appearance` / `scoring` auto-filled silently), walk **only the meaningful custom fields** with "tweak or accept?" per field. Each comes with a one-line preview. If the user says "I don't know what shape that should be," show 2–3 example shapes from existing schemas with trade-offs, then ask.

Cross-check referential integrity manually (Zod won't catch these): every `correctZones[]` ID matches a defined drop-zone ID, every `requiredOverlayIds[]` matches an overlay ID, every nested sub-config is itself valid.

### S4 — Sample fixture via content-flow hand-off

Once the schema compiles (after Batch 1 — see below), enter the **existing content-authoring flow** on the new slug to produce `basic.json`. This is the convergence point: scaffold creates type infrastructure, content flow fills it in.

Single MC at the end of S4: also generate `full.json` (uses all optional fields) and `_invalid/missing-required-field.json` (negative-case for `fixtures.test.ts`)? Default: yes — it's cheap insurance.

### S5 — Live variant gate

Pre-answer based on the activity's nature: single-learner / reflection / async-only → suggest "no" with reasoning. Discussion / discrimination / sequencing → suggest "yes." Let user override either way.

## Write batches with type-check gates

Each batch is cumulative — built on the green state of the prior. Failure surfaces the error and waits for direction; never auto-revert.

### Batch 1 — Schema + kind union

**Writes:**
- `packages/schemas/src/{slug}.ts` — full Zod schema, JSDoc cites the S1 objective verbatim
- `packages/schemas/src/index.ts` — three edits: re-export line (top block), import line (second block), entry in `SchemaRegistry` map
- `packages/core/src/types.ts` — slug added to `BuiltActivityKind` union and `BUILT_ACTIVITY_KINDS` readonly array

**Gate:** `pnpm typecheck` (root-level; runs `tsc -b` across all project references — catches cross-package issues we'd miss with per-package checks).
Also run `pnpm test packages/schemas --exclude '**/fixtures.test.ts'` (will fail otherwise until Batch 3 lands `basic.json`).

### Batch 2 — Component + registry + test stub

**Writes:**
- `packages/core/src/components/{slug}/index.ts` — barrel re-exporting the component as default
- `packages/core/src/components/{slug}/{PascalSlug}.tsx` — layout-stable shell per S3a axes, imports inferred type from `@kukui/schemas`, accepts `ActivityProps<TConfig>`. Every interactive element ships with `min-h-11 min-w-11`. Comment header references `docs/design-system.md`.
- `packages/core/src/components/{slug}/{PascalSlug}.test.tsx` — minimal Vitest render-smoke test + TODO list of behaviors to cover
- `packages/core/src/components/{slug}/{PascalSlug}.css` — only if S3a indicates custom visual is unavoidable (3D scene, slider, etc.); most activities skip this
- `packages/core/src/components/registry.ts` — one edit: lazy-import entry in `ACTIVITY_REGISTRY`

**Gate:** `pnpm typecheck`

### Batch 3 — Samples + Studio integration + fixture test

**Writes:**
- `apps/engine-web/public/samples/{slug}/basic.json` — produced by S4's content-flow hand-off
- Optional (if user opted in): `full.json`, `_invalid/missing-required-field.json`
- `apps/studio-app/src/uiSchemas.ts` — explicit entry for the new built kind (the auto-stub loop only covers `PLANNED_ACTIVITY_KINDS`). Generated from Zod shape; surface a follow-up TODO that this needs hand-tuning for nicer field labels.
- `apps/studio-app/src/starters.ts` — starter entry pointing at `basic.json`'s content shape
- `packages/schemas/src/fixtures.test.ts` — append new slug to the `ACTIVITIES` array

**Gate:** `pnpm typecheck && pnpm test packages/schemas` (fixture test now covers the new slug). Studio app's typecheck is included in the root `tsc -b` so no separate command is needed.

### Batch 4 — Live variant (only if S5 said yes)

**Writes:**
- `apps/live-mode/src/activities/{PascalSlug}Live.tsx` — skeleton importing the engine component + Live wrapper; Trystero/Y.js hooks stubbed but not implemented
- `apps/live-mode/src/activities/use{PascalSlug}.ts` — only if shared P2P state shape is needed (decide per S5 reasoning)
- Conventions from `apps/live-mode/src/activities/CLAUDE.md` applied

**Gate:** `pnpm typecheck` (covers `@kukui/live-mode` via project references)

## Confirmation step

End-of-run report prints:
1. **File tree** of everything created/edited (grouped by batch)
2. **Preview command:** `pnpm dev:studio` → Studio's Import button → select `basic.json`
3. **Follow-up TODOs the user owes:**
   - "uiSchema needs hand-tuning at `apps/studio-app/src/uiSchemas.ts:NNN`"
   - "Component is layout-stable but inert — wire up interactions"
   - "Live wrapper has stub hooks — implement CRDT shape" (if Batch 4 ran)
4. Optionally: offer to run `git status` so the user can stage in sensible chunks

## Guards and edge cases

**Slug validation (pre-flight):**
- Lowercase kebab-case, ASCII only
- No leading `_` (reserved for `_shared`, `_stub`, `_live-preview`, `_invalid`)
- Reject if already in `SchemaRegistry` — route to content-authoring on existing slug
- Reject if `PascalSlug` collides with a JSX intrinsic (`Img`, `Input`, `Label`, etc.) — propose an alternative
- Warn (not block) on single-edit distance from any existing slug — ask "are these the same activity?"

**Partial-scaffold detection:**
Before scaffolding, grep for the slug in `SchemaRegistry`, `BUILT_ACTIVITY_KINDS`, and `ACTIVITY_REGISTRY`. If found in some but not all, refuse with a file list and ask the user to either finish manually or pick a new slug. The command does not resume half-finished previous runs — too easy to clobber hand-tuned code.

**Failure handling at gates:**
- Typecheck/test failure → surface first 20 lines of stderr, identify likely cause, offer (a) fix in place, (b) roll back this batch via `git checkout -- <files>`, (c) abort and leave as-is. Default is (c); destructive options require explicit confirmation.
- Never auto-revert.

**Hard rules (CLAUDE.md):**
- Never write "H5P" in any generated file or comment
- Never invent design-token values — only reference tokens defined in `docs/design-system.md`
- WCAG 2.2 AA non-negotiable in generated component skeletons (44×44 hit targets, layout-stable state changes, color paired with text/icon/position)
- Generated JSDoc cites the S1 objective verbatim

## Non-goals

- **No resume from half-finished state.** A failed or interrupted run leaves files on disk; the user finishes manually or removes them.
- **No auto-generation of polished uiSchemas.** The generated entry is a Zod-derived starting point; hand-tuning is a tracked follow-up TODO, not a scaffold deliverable.
- **No real component behavior.** The scaffold produces a green, inert vertical slice. Interactions, state, and visual polish are explicit follow-up work.
- **No xAPI / cmi5 emission.** SCORM 1.2 only, per the stack pin.
- **No AI assist within the command** for content generation (per CLAUDE.md: "AI assist for Studio: skipped indefinitely"). The interview is interactive Q&A, not generative.

## Out of scope (future revisions)

- A separate `/kukui promote` command for moving a slug from `PLANNED_ACTIVITY_KINDS` to a full built kind. Currently `PLANNED_ACTIVITY_KINDS` is empty and the scaffold creates built kinds directly.
- A "remove activity" command — counterpart to scaffold for cleanly retiring a type.
- Integration with Notion sync to pre-populate the S1 objective from a linked spec page.
