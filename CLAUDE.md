# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Kukui** is a JSON-driven family of three products for Lamakū (UH JABSOM's D2L Brightspace at `lamaku.hawaii.edu`):

- **Kukui Engine** — async, single-learner SCORM-packaged activities (Phase 1)
- **Kukui Studio** — authoring GUI hosted on GitHub Pages, browser-local drafts, no backend (Phase 2)
- **Kukui Live** — real-time classroom with P2P over WebRTC; per-student SCORM persistence; no backend (Phase 3)

7 initial activity types: Multiple Choice, Fill in the Blanks, Drag and Drop, Course Presentation, Question Set, 3D Hotspot Identification, Virtual Environment Tour.

This repo is the **React rebuild** after a 2026-05-05 stack pivot from a Unity 6 / WebGL prototype. The Unity reference lives at `~/OME Projects/` and is preserved.

The canonical living spec is in Notion: <https://www.notion.so/357ee4627a7481c68ad9eb5b50628e4a> (with sub-pages for each product).

## Status

Empty repo. Scaffolding pending — Vite + React + TypeScript + Tailwind + react-three-fiber + Zod, in a pnpm-workspaces monorepo.

## License

MIT. See `LICENSE`.

## Hard rules — apply to every artifact written in this repo

1. **Follow the Kukui design system** (canonical at `~/OME Projects/docs/design-system.md`). Don't invent hex values, spacing, font sizes, or border widths that aren't in the documented tokens; add tokens to the doc *before* using new values.
2. **Follow the Kukui design system** (canonical at `~/OME Projects/docs/design-system.md`, mirroring planned to `docs/design-system.md` in this repo once copied). Don't invent hex values, spacing, font sizes, or border widths that aren't in the documented tokens. Add tokens to the doc *before* using new values. WCAG 2.2 AA is non-negotiable for educational content.
3. **Layout-stable interactions.** State changes (selected / correct / incorrect) must not reflow neighbors. Reserve space; change colors only. Border widths constant across states.
4. **Tap targets ≥ 44 × 44 px** (WCAG 2.5.5).
5. **Color is never the sole signal** — pair every color cue with text, icon, or position.

## Reference (in the Unity repo)

- Spec: `~/OME Projects/docs/superpowers/specs/2026-05-04-interactive-learning-activities-design.md`
- Design system: `~/OME Projects/docs/design-system.md`
- Lessons learned (Unity gotchas, kept for posterity): `~/OME Projects/docs/lessons-learned/uss-and-ui-toolkit-runtime.md`
- JSON schemas: `~/OME Projects/docs/schemas/`
- Sample fixtures: `~/OME Projects/samples/`
- /kukui authoring command: `~/OME Projects/.claude/commands/kukui.md`

These will get copied or symlinked into this repo as scaffolding lands.

## Stack pin (locked in 2026-05-05)

- **Monorepo**: pnpm workspaces. Add Turborepo only if build-graph complexity warrants later.
- **Build**: Vite 6
- **Framework**: React 19 + TypeScript 5.7 (strict)
- **Styling**: Tailwind CSS 4 (theme config mirrors design tokens)
- **3D**: react-three-fiber 9 + @react-three/drei (WebGL2; WebGPU deferred until iOS 17 share collapses)
- **Schema validation**: Zod 4 (runtime validation; replaces JSON Schema validators)
- **Unit tests**: Vitest 3
- **E2E**: Playwright 1.5x (real headless Chrome / Safari for SCORM round-trip)
- **Live realtime (Phase 3)**: Trystero (P2P signaling over public BitTorrent trackers) + Y.js (CRDT shared state). Configurable TURN endpoint from day one; deployment of TURN VPS empirical.
- **Studio hosting (Phase 2)**: GitHub Pages
- **LMS integration**: SCORM 1.2 via pipwerks SCORM API; xAPI / cmi5 deferred to Phase 6+ pending LRS commitment
- **AI assist for Studio**: skipped indefinitely
- **Package manager**: pnpm
- **Node**: ≥ 20

Don't introduce additional state libraries (Redux, MobX, etc.) without explicit reason; React state + URL params + occasional Zustand is the ceiling.

## Commits

Use Conventional Commits where it improves clarity (`feat:`, `fix:`, `docs:`, `chore:`, `test:`). Keep commits small. Don't squash work-in-progress to a single mega-commit.
