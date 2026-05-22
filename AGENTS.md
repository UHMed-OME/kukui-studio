# AGENTS.md

Guidance for Codex and other coding agents working in this repository.

## Current Project

This repo is **UHMed-OME/kukui-studio**, the active React/TypeScript rebuild of Kukui.

Kukui is a browser-native toolkit for authoring, previewing, packaging, and running JSON-driven SCORM 1.2 learning activities for Lamakū / D2L Brightspace. The live Studio is hosted on GitHub Pages.

Primary local path:

- `/Users/Jesse/kukui-studio`

Related copy:

- `/Users/Jesse/kukui-web` points at the same GitHub remote, but `/Users/Jesse/kukui-studio` is the working copy to prefer unless the user says otherwise.

## Important Context

- The old Unity prototype lives at `/Users/Jesse/OME Projects`.
- Treat that Unity project as historical reference only.
- Do not resume Unity work unless the user explicitly asks for it.
- If you see a root `CLAUDE.md` in `/Users/Jesse/OME Projects`, it describes the old Unity prototype, not the current web product.
- This repo's `CLAUDE.md` is partly stale where it says the repo is empty; trust `README.md`, the code, and recent commits for current state.

## GitHub

- Remote: `https://github.com/UHMed-OME/kukui-studio.git`
- Public repo: `UHMed-OME/kukui-studio`
- Homepage: `https://uhmed-ome.github.io/kukui-studio/`
- Use `/Users/Jesse/bin/gh` if `gh` is not on PATH.

## Stack

- pnpm workspace monorepo
- React 19 + TypeScript strict
- Vite
- Tailwind/CSS tokens
- Zod schemas
- Vitest
- SCORM 1.2 packaging via `packaging/pack-scorm.js`

## Main Areas

- `apps/studio-app/`: authoring GUI, live preview, JSON/form editor, AI assist, SCORM download UI
- `apps/engine-web/`: per-activity runtime entries that ship inside SCORM zips
- `apps/live-mode/`: alpha realtime classroom mode; activity variants under `src/activities/{Slug}Live.tsx`
- `packages/activities/`: per-activity bundles at `packages/activities/{slug}/` (schema, Component, samples, ui-schema, starter, meta, manifest). `src/index.ts` derives the activity-kind → manifest/schema/component maps from each bundle's `manifest.ts` via `import.meta.glob` — no hand-maintained central registry.
- `packages/core/`: host runtime, scoring, SCORM driver surface, shared component utilities (`_shared`, `_stub`, `_live-preview`). Activity components themselves now live in `packages/activities/{slug}/Component.tsx`.
- `packages/schemas/`: cross-activity schema scaffolding (`shared.ts`, `appearance.ts`, `migrate.ts`, `scoring.ts`, `SchemaRegistry`). Per-activity Zod schemas + fixtures now live in `packages/activities/{slug}/`.
- `packages/bridge/`: LMS/SCORM bridge package
- `packaging/`: SCORM zip builder and manifest template

## Workflow

- Before changing code, check `git status --short --branch`.
- There may be local commits ahead of `origin/main`; preserve them.
- Prefer `pnpm test`, `pnpm typecheck`, and focused package/app commands for verification.
- For Studio UI work, run `pnpm dev:studio` and inspect the app visually when practical.
- Follow `docs/design-system.md`; do not invent new colors, spacing, font sizes, or border widths casually.
- Keep interactions layout-stable: state changes should not reflow neighbors.
- Tap targets must be at least 44 x 44 px.
- Color must not be the only signal.

## Current Alignment Notes

As of 2026-05-11:

- Studio is not a placeholder; it is actively built.
- The README lists 24 activity types, with quiz primitives hidden from the Studio catalog.
- Recent work has focused on Studio polish: sidebar search, activity icons, tooltips, AI tab naming, Download button affordance, and GitHub Pages deploys.
- There are currently no GitHub issues or PRs listed for the repo.
