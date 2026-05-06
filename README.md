# Kukui (web)

A JSON-driven family of three products for **Lamakū** (UH JABSOM's D2L Brightspace at `lamaku.hawaii.edu`):

- **Kukui Engine** — async, single-learner SCORM-packaged activities (Phase 1)
- **Kukui Studio** — authoring GUI hosted on GitHub Pages, browser-local drafts, no backend (Phase 2)
- **Kukui Live** — real-time classroom multiplayer over P2P WebRTC, per-student SCORM persistence, no backend (Phase 3)

> Kukui nuts were the traditional fuel for lamakū torches. Lamakū hosts the activities; **Kukui *is* the activities.**

## Status

**Phase 1 scaffold + all 7 activities + SCORM packaging in place** (May 2026). Run `pnpm install && pnpm test && pnpm build` to verify locally; `node packaging/pack-scorm.js --all` to produce the seven SCORM 1.2 zips ready for D2L upload.

The canonical spec lives in Notion: **[Kukui Platform — Activities, Authoring, Live](https://www.notion.so/357ee4627a7481c68ad9eb5b50628e4a)** (with sub-pages for each product).

A Unity 6 / WebGL prototype with the same 7 activities exists at `~/OME Projects/` and is preserved as a working reference. This repo is the React rebuild after a stack pivot on 2026-05-05 (see Notion spec § "Why we pivoted").

## Quick start

```bash
pnpm install                            # install workspace deps
pnpm dev                                # Vite dev server (engine-web)
pnpm test                               # Vitest, ~70 tests
pnpm typecheck                          # tsc -b across all packages
pnpm build                              # build engine-web for production
node packaging/pack-scorm.js --all      # 7 SCORM zips → packaging/build/
```

Each SCORM zip is ~380 KB and ready to drop into a D2L Brightspace course as a SCO module with grade passback.

## Planned stack

- pnpm workspaces monorepo · Node ≥ 20
- Vite 6 · React 19 · TypeScript 5.7 (strict)
- Tailwind CSS 4 (design tokens mirror in-repo `docs/design-system.md`)
- react-three-fiber 9 + @react-three/drei (for 3D activities; WebGL2)
- Zod 4 (replaces JSON Schema runtime validation)
- Vitest 3 + Playwright 1.5x
- SCORM 1.2 via pipwerks for LMS grade passback
- Trystero (P2P signaling over public BitTorrent trackers) + Y.js (CRDT shared state) for Live; configurable TURN endpoint as fallback
- Studio hosted on GitHub Pages

## Activity types (initial 7)

Multiple Choice · Fill in the Blanks · Drag and Drop · Course Presentation · Question Set · 3D Hotspot Identification · Virtual Environment Tour

The full taxonomy (~30 types across selection, text, spatial, sorting, media, structured-flow, reflection, med-ed-specialized, and Live-only) lives in the [Notion spec § Activity types](https://www.notion.so/357ee4627a7481c68ad9eb5b50628e4a). Highlights beyond the MVP: Multiple Select, Short Answer, Highlight Text, Image Annotation, Branching Scenario (parent of DDx Tree + OSCE), Flashcards, plus six Live-only formats including TBL Round.

## Repo layout

```
kukui-web/                                  # pnpm workspaces monorepo
  packages/
    core/                                   # @kukui/core — types, scoring, content
      src/
        activity-host.tsx                   # router that loads JSON, validates, renders
        components/<activity>/              # one React component per activity type
        scoring.ts content.ts scorm.ts      # SCORM driver + scoring + JSON loader
        safe-html.tsx                       # DOMPurify-sanitized author HTML
    schemas/                                # @kukui/schemas — Zod schemas (1 per activity)
    bridge/                                 # @kukui/bridge — third-party engine bridge
      src/index.ts                          # window.kukuiBridge attach
      src/kukui-bridge.jslib                # Unity Emscripten plugin
  apps/
    engine-web/                             # Phase 1: SCORM-built async player (Vite)
      <activity>.html                       # one HTML entry per activity
      public/samples/<activity>/            # JSON fixtures
      public/pipwerks.SCORM.min.js          # SCORM API wrapper
    studio-app/                             # Phase 2 placeholder
    live-mode/                              # Phase 3 placeholder
  packaging/
    pack-scorm.js                           # builds kukui-<activity>.scorm.zip
    templates/imsmanifest.xml.tmpl          # SCORM 1.2 manifest
  docs/
    design-system.md                        # tokens, patterns (mirrored from Unity ref)
    research-foundations.md                 # ed-tech literature scan
    third-party-integration.md              # Unity / Godot / Articulate guide
    superpowers/plans/                      # implementation plans
```

## Cross-links

- Notion spec: <https://www.notion.so/357ee4627a7481c68ad9eb5b50628e4a>
- Unity reference repo: `~/OME Projects/`
- Design system canon: `~/OME Projects/docs/design-system.md`
- JSON schemas: `~/OME Projects/docs/schemas/`
- Sample fixtures: `~/OME Projects/samples/`
- /kukui authoring command: `~/OME Projects/.claude/commands/kukui.md` (pending copy to this repo)

## License

MIT — see [LICENSE](LICENSE).
