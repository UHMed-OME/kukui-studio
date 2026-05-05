# Kukui (web)

A JSON-driven family of three products for **Lamakū** (UH JABSOM's D2L Brightspace at `lamaku.hawaii.edu`):

- **Kukui Engine** — async, single-learner SCORM-packaged activities (Phase 1)
- **Kukui Studio** — authoring GUI hosted on GitHub Pages, browser-local drafts, no backend (Phase 2)
- **Kukui Live** — real-time classroom multiplayer over P2P WebRTC, per-student SCORM persistence, no backend (Phase 3)

> Kukui nuts were the traditional fuel for lamakū torches. Lamakū hosts the activities; **Kukui *is* the activities.**

## Status

Empty repo — scaffolding pending. The canonical spec lives in Notion: **[Kukui Platform — Activities, Authoring, Live](https://www.notion.so/357ee4627a7481c68ad9eb5b50628e4a)** (with sub-pages for each product).

A Unity 6 / WebGL prototype with the same 7 activities exists at `~/OME Projects/` and is preserved as a working reference. This repo is the React rebuild after a stack pivot on 2026-05-05 (see Notion spec § "Why we pivoted").

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

Future roadmap (see Notion spec): True/False, Image Hotspot 2D, Sequence/Order, Categorization, Audio Identification, Lab Panel Interpretation, Differential Diagnosis Tree, Math Input with KaTeX, Interactive Video, OSCE Clinical Encounter — plus JABSOM-specific activities (TBL round, OSCE, etc.).

## Reference layout

```
kukui-web/                     # pnpm workspaces monorepo
  packages/
    core/                      # palette, score, scorm wrapper, config-loader, ActivityHost
    activities/                # one folder per activity type (shared across Engine/Live)
    schemas/                   # Zod schemas (one per activity type)
    bridge/                    # kukui-bridge.js for third-party Unity/Godot/Articulate authors
  apps/
    engine/                    # Phase 1: SCORM-packaged async activities
    studio/                    # Phase 2: authoring GUI (deploys to GitHub Pages)
    live/                      # Phase 3: real-time classroom (P2P + per-student SCORM)
  public/
    samples/                   # JSON fixtures (mirrors ../OME Projects/samples)
  packaging/                   # SCORM wrapper template + pack-scorm.js
  tests/                       # Vitest + Playwright
  docs/
    design-system.md           # canonical design tokens (mirrored from Unity reference)
    research-foundations.md    # ed-tech literature scan
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
