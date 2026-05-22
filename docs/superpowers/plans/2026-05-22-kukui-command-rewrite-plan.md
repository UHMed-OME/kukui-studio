# `/kukui` Command Rewrite Implementation Plan (Plan 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `.claude/commands/kukui.md` to implement the two-mode design from `docs/superpowers/specs/2026-05-15-kukui-scaffold-command-design.md`. Today's command only does content authoring against the OLD layout (`packages/schemas/src/{slug}.ts`, `apps/engine-web/public/samples/`). After Plans 1–3, those locations no longer exist — content lives in `packages/activities/{slug}/`. Plan 4 updates the command for the new layout AND adds the scaffold flow that lets users create entirely new activity types via a one-folder write.

**Architecture:** The command file is a markdown spec that Claude follows. The rewrite preserves the existing content-authoring flow (Steps 1–5) but routes the user to it via a new Step 0 mode prompt. A parallel scaffold flow (S1–S5) implements the spec's objective-driven discovery and produces a single-folder scaffold in `packages/activities/{slug}/`. All shared-file edits the original spec required (registries, type unions, fixture-test arrays, etc.) are now unnecessary because of the auto-discovery infrastructure built in Plans 1–3.

**Tech Stack:** Markdown command file. No code changes outside `.claude/commands/kukui.md` and small updates to `CLAUDE.md`'s `/kukui` reference.

---

## File structure

**Modified:**
- `.claude/commands/kukui.md` — rewritten to implement the two-mode design from the spec
- `CLAUDE.md` line 45 — update the `/kukui` description to reflect both modes

**New:**
- None. The command's allowed-tools list expands (`Read, Write, Bash, Glob` → adds `Edit`, `Grep`), and a few sections grow, but no separate files.

---

## Task 1: Audit current command + spec against new architecture

**Goal:** confirm the spec's design still maps cleanly to the post-Plan-3 reality. Identify deltas.

**Files:** none modified — read-only.

- [ ] **Step 1:** Read the existing command:
  ```bash
  cat .claude/commands/kukui.md
  ```
  Note: it points at `packages/schemas/src/{slug}.ts` (gone), `apps/engine-web/public/samples/{slug}/` (gone), `apps/studio-app/public/samples/{slug}/` (gone). All three paths are stale post-Plan-3.

- [ ] **Step 2:** Read the spec:
  ```bash
  cat docs/superpowers/specs/2026-05-15-kukui-scaffold-command-design.md
  ```

- [ ] **Step 3:** Identify spec sections that need adaptation:
  - **Spec's "Phase 1 — Manifest contract + infra":** already done (Plan 1).
  - **Spec's "Phase 2 — Pilot multiple-choice":** already done (Plan 1).
  - **Spec's "Phase 3 — Studio aggregator gut":** already done (Plans 2-3 — aggregators are now manifest-only).
  - **Spec's "Phase 4 — Engine + packaging + fixtures-test auto-discovery":** already done (Plan 1 + auto-discovered fixtures.test in Plan 1 Task 20).
  - **Spec's "Phase 5 — Bulk migration":** already done (Plan 2).
  - **Spec's "Phase 6 — Live-mode registry refactor":** already done (Plan 3).
  - **Spec's "Phase 7 — Cleanup & docs":** already done (Plan 3).
  - **Spec's "Phase 8 — Rewrite /kukui scaffold command":** this plan implements it. The Section S1–S5 design + write-batch logic is what the rewritten command must contain.

- [ ] **Step 4:** Note the practical simplifications from Plans 1-3 that shrink Phase 8's batch logic:
  - No more Batch 1/2/3/4 of write+typecheck — a single folder write IS the scaffold, glob discovery picks it up automatically.
  - No more `Studio integration` step — `uiSchemas.ts`, `starters.ts`, `activityIcons.tsx`, `App.tsx`'s `BLOOM_BY_KIND` all derive from manifests automatically.
  - No more `SchemaRegistry` + `ACTIVITY_REGISTRY` edits — both glob-derived.
  - No more `engine-web/vite.config.ts` rollupOptions edits — HTML glob.
  - No more `pack-scorm.js` slug-list edits — directory scan.
  - No more `fixtures.test.ts ACTIVITIES` array edits — auto-discovers.
  - **The scaffold writes one folder and stops.** That's it.

- [ ] **Step 5:** Report back the audit findings: confirm Plans 1–3 covered all spec phases except Phase 8, list the stale paths in the current command, confirm the simplification path. No commit.

---

## Task 2: Rewrite `.claude/commands/kukui.md`

**Files:**
- Modify: `.claude/commands/kukui.md`

**Steps:**

- [ ] **Step 1:** Update the frontmatter — keep `description` to a single sentence covering both modes, extend `argument-hint` to handle either flow, expand `allowed-tools`:
  ```yaml
  ---
  description: Author content for an existing Kukui activity OR scaffold a brand-new activity type. Routes via a first-question prompt.
  argument-hint: "[activity-slug | learning-objective]"
  allowed-tools: Read, Write, Edit, Bash, Glob, Grep
  ---
  ```

- [ ] **Step 2:** Rewrite the body. Structure:
  ```
  # /kukui — Activity authoring and scaffolding

  Two modes, one entry point. Step 0 routes; the rest is mode-specific.

  ## Step 0 — Mode

  Single multiple-choice question:
    A) Author content for an EXISTING activity type → Content flow (Steps 1–5)
    B) Scaffold a NEW activity type                → Scaffold flow (S1–S5)

  $ARGUMENTS pre-selects:
    - Slug present in packages/activities/ → default A
    - Looks like a learning objective (verb-phrase containing "should/will/can/identify/distinguish/order/explain/etc.") → default B
    - Slug absent or unknown → default B
    - Empty args → no default; ask

  ## Content flow (existing activity)

  (preserves today's flow — Steps 1–5 — but with paths updated for the new layout)

  ### Step 1: Pick the activity
  If $ARGUMENTS has a slug, use it. Otherwise list packages/activities/*/ (excluding any starting with _) and ask which.

  ### Step 2: Read the canon
  Before any questions, read:
    1. packages/activities/{slug}/schema.ts — the Zod schema
    2. docs/design-system.md — visual/UX rules
    3. packages/activities/{slug}/samples/basic.json if it exists — structural reference
    4. packages/activities/{slug}/starter.ts — minimal valid shape

  Project memory rules:
    - Never write "H5P" anywhere
    - Don't invent design-token values

  ### Step 3: Walk the fields, one at a time
  (same content-authoring guidance as today)

  ### Step 4: Save
  Default path: packages/activities/{slug}/samples/{filename}.json (kebab-case filename).
  Engine-web's vite-plugin-activity-samples serves it at /samples/{slug}/{filename}.json automatically.
  Pretty-print with 2-space indent.

  ### Step 5: Confirm
  Tell the user where the file landed; preview via pnpm dev:studio + Import button.

  ## Scaffold flow (new activity type)

  (implements the spec's S1–S5 design from docs/superpowers/specs/2026-05-15-kukui-scaffold-command-design.md)

  ### S1 — Learning objective intake
  ### S2 — Proposal slate (mix existing + novel; bias toward existing; "How it fits in Kukui")
  ### S3 — Branch on choice
  ### S3a — Schema axes confirmation (proposal-driven)
  ### S3b — Field walk
  ### S4 — Sample fixture via content-flow hand-off
  ### S5 — Live variant gate (inferred)

  ## Scaffold write

  After the design pass, write ONE FOLDER. No shared-file edits required.
    packages/activities/{slug}/manifest.ts
    packages/activities/{slug}/schema.ts
    packages/activities/{slug}/Component.tsx
    packages/activities/{slug}/Component.test.tsx
    packages/activities/{slug}/Component.css   (only if needed)
    packages/activities/{slug}/samples/basic.json
    packages/activities/{slug}/ui-schema.ts
    packages/activities/{slug}/starter.ts
    packages/activities/{slug}/starter.test.ts
    packages/activities/{slug}/icon.tsx        (optional)
    packages/activities/{slug}/meta.ts

  Plus packages/activities/package.json: add two subpath exports:
    "./<slug>/Component": "./<slug>/Component.tsx",
    "./<slug>/schema":    "./<slug>/schema.ts",

  Glob discovery picks it up: SchemaRegistry, ACTIVITY_REGISTRY, UI_SCHEMAS,
  STARTERS, ACTIVITY_LABELS, BLOOM_BY_KIND, ActivityIcon, fixtures.test.ts
  all see the new activity automatically.

  Optional Live variant: also write apps/live-mode/src/activities/{PascalSlug}Live.tsx
  with an export const liveActivity = { kind, Component }; the local barrel
  picks it up.

  ## Slug guards (pre-flight, both modes)

    - Lowercase kebab-case, ASCII only
    - No leading underscore
    - For scaffold mode: reject if packages/activities/{slug}/ already exists
    - Warn (don't block) if single-edit distance from an existing slug
    - Reject if PascalSlug collides with JSX intrinsic (Img, Input, Label)

  ## Verify

  After scaffold write:
    pnpm typecheck && pnpm test --run

  Both must be green before reporting the scaffold complete.

  ## End-of-run report

  Print:
    1. Files created (tree)
    2. Preview command (pnpm dev:studio → Import button → samples/{slug}/basic.json)
    3. Follow-up TODOs (only the genuine ones the scaffold left placeholder):
       - "ui-schema.ts is a generated starting point — hand-tune labels/help text"
       - "icon.tsx is a placeholder rectangle — draw the real icon" (if applicable)
       - "Component.tsx is layout-stable but inert — wire up interactions"
       - "Live wrapper is stubbed — implement CRDT shape" (if Live opted in)

  ## Hard rules (CLAUDE.md)

    - No "H5P" anywhere
    - No invented design-token values
    - WCAG 2.2 AA in component skeleton (44x44 hit targets, layout-stable state, color paired)
    - JSDoc on the new schema cites the learning objective verbatim
  ```

  Adapt the spec's specific S1–S5 wording to the command's voice (it's giving instructions to Claude, not describing them). Reuse content from the spec's S1–S5 sections verbatim where natural — the spec's wording is already command-shaped.

- [ ] **Step 3:** Commit:
  ```bash
  git add .claude/commands/kukui.md
  git commit -m "feat(kukui): rewrite slash command for two-mode authoring + scaffolding

Step 0 mode prompt routes to content authoring (existing flow, paths
updated for packages/activities/) or scaffold (S1-S5 design discovery
+ single-folder write). Scaffold leans on Plan 1-3's auto-discovery —
no shared-file edits required, glob picks up the new manifest on next
typecheck."
  ```

---

## Task 3: Update CLAUDE.md `/kukui` reference

**Files:**
- Modify: `CLAUDE.md` line 45

- [ ] **Step 1:** Read CLAUDE.md line 45 area. Current:
  ```
  - `/kukui` slash command (JSON fixture authoring): `.claude/commands/kukui.md`
  ```

- [ ] **Step 2:** Update to:
  ```
  - `/kukui` slash command (content authoring + new-activity scaffolding): `.claude/commands/kukui.md`
  ```

- [ ] **Step 3:** Commit:
  ```bash
  git add CLAUDE.md
  git commit -m "docs: update /kukui description for two-mode behavior"
  ```

---

## Task 4: Smoke-test the command flow

**Files:** none modified — verification only.

Slash commands aren't unit-tested. The verification is a thought-experiment: walk through what the agent would do for two test inputs and confirm the command provides clear, complete instructions for each.

- [ ] **Step 1:** Mental dry-run: simulated input "I want to teach students to distinguish benign vs malignant breast histology on H&E slides."
  - Step 0: $ARGUMENTS contains "distinguish" + "should" pattern → defaults to scaffold mode. User confirms or override to existing.
  - S1: objective parsed.
  - S2: agent should propose `[EXISTING: hotspot-2d]`, `[EXISTING: image-comparison-slider]`, optional `[NOVEL: ...]`. Bias toward existing.
  - User picks `[EXISTING: hotspot-2d]` → drops into content flow on hotspot-2d.
  - Content flow: Step 1 already has slug, Step 2 reads schema + samples + design-system, Step 3 walks fields, Step 4 saves to `packages/activities/hotspot-2d/samples/{name}.json`, Step 5 confirms.

  Confirm the rewritten command has clear instructions for every step of this flow.

- [ ] **Step 2:** Mental dry-run: simulated input "histology-flashcards-with-confidence".
  - Step 0: $ARGUMENTS is a slug not in `packages/activities/` → defaults to scaffold mode.
  - S1: agent asks "what should the learner be able to do?" since no objective was provided.
  - S2: surfaces proposals (likely flashcards-like).
  - User picks novel `[NOVEL: histology-flashcards-with-confidence]`.
  - S3a: agent infers scoring/modality/layout/media. User confirms.
  - S3b: agent walks the meaningful custom fields.
  - S4: agent drops into content flow on the new slug to author `basic.json`.
  - S5: Live gate ("does this need a real-time variant?").
  - Write: single folder under `packages/activities/histology-flashcards-with-confidence/`.
  - Verify: `pnpm typecheck && pnpm test --run`.
  - Report: file tree + TODOs.

  Confirm the rewritten command has clear instructions for every step.

- [ ] **Step 3:** Report any gaps found (instructions missing, unclear branching, ambiguous handoffs) so they can be patched.

- [ ] **Step 4:** No commit unless gaps were found and patched.

---

## Task 5: Final validation

- [ ] **Step 1:** Run `pnpm typecheck && pnpm test --run`. Expected: still 600 passing (no code changes outside docs).

- [ ] **Step 2:** Confirm working tree clean of stray changes:
  ```bash
  git status --short
  ```
  Expected: only the same 3 pre-existing untracked items (`.claude/commands/` — wait that's where the command lives; clarify: only items NOT in the touched files).
  
  Actually `.claude/commands/` was listed as untracked in earlier audits because it had OTHER files in it (not just `kukui.md`). Confirm by `ls .claude/commands/` — the rewritten `kukui.md` is the one we committed, but if there are sibling files (e.g. other slash commands the user authored), they remain untracked.

- [ ] **Step 3:** Tag:
  ```bash
  git tag -a kukui-command-rewrite -m "Plan 4 complete: /kukui supports both content authoring (existing slug) and scaffold (new activity type via objective-driven discovery)."
  ```

- [ ] **Step 4:** Final audit dispatch — a code reviewer reads the rewritten `.claude/commands/kukui.md` against the spec at `docs/superpowers/specs/2026-05-15-kukui-scaffold-command-design.md` and confirms every spec section is covered. Report any spec-coverage gaps.

---

## What this plan does NOT do

- Backfill the 5 missing `basic.json` fixtures (confidence-meter, word-cloud, qa-board, quick-quiz, isometric-chatroom) — separate content work.
- Extract shared primitives into `@kukui/primitives` to break the workspace cycles — separate architectural refactor.
- Fix `pnpm lint` (missing `@eslint/js`) — pre-existing infrastructure debt.
- Update the README's "24 activities" figure to "30" — separate docs touch-up.

---

## Plan complete and saved to `docs/superpowers/plans/2026-05-22-kukui-command-rewrite-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task. Mostly one file (`.claude/commands/kukui.md`) so Task 2 is the bulk of the work; the rest is small.

**2. Inline Execution** — execute directly in this session. Given the command is a single markdown file rewrite, this is reasonable too.

Which approach?
