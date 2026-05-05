# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Kukui (web)** — interactive learning activities for Lamakū (UH JABSOM's D2L Brightspace at `lamaku.hawaii.edu`). JSON-driven web activities, packaged as SCORM 1.2 for LMS embed with grade passback. The 7 initial activity types: Multiple Choice, Fill in the Blanks, Drag and Drop, Course Presentation, Question Set, 3D Hotspot Identification, Virtual Environment Tour.

This repo is the **React rebuild** after a 2026-05-05 stack pivot from a Unity 6 / WebGL prototype. The Unity reference lives at `~/OME Projects/` and is preserved.

The canonical living spec is in Notion: <https://www.notion.so/357ee4627a7481c68ad9eb5b50628e4a>.

## Status

Empty repo. Scaffolding pending — Vite + React + TypeScript + Tailwind + react-three-fiber + Zod.

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

## Stack pin (planned)

- **Build**: Vite 6
- **Framework**: React 19 + TypeScript 5.7 (strict)
- **Styling**: Tailwind CSS 4 (theme config mirrors design tokens)
- **3D**: react-three-fiber 9 + @react-three/drei
- **Schema validation**: Zod 4 (runtime validation; replaces JSON Schema validators)
- **Unit tests**: Vitest 3
- **E2E**: Playwright 1.5x (real headless Chrome / Safari for SCORM round-trip)
- **Package manager**: pnpm (preferred; npm OK)
- **Node**: ≥ 20

Don't introduce additional state libraries (Redux, MobX, etc.) without explicit reason; React state + URL params + occasional Zustand is the ceiling.

## Commits

Use Conventional Commits where it improves clarity (`feat:`, `fix:`, `docs:`, `chore:`, `test:`). Keep commits small. Don't squash work-in-progress to a single mega-commit.
