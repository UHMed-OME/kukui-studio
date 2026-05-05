# Kukui (web)

Interactive learning activities for **Lamakū** (UH D2L Brightspace at `lamaku.hawaii.edu`), built as JSON-driven web components and packaged as SCORM 1.2 for LMS embed with grade passback.

> Kukui nuts were the traditional fuel for lamakū torches. Lamakū hosts the activities; **Kukui *is* the activities.**

## Status

Empty repo — scaffolding pending. The canonical spec lives in Notion: **[Kukui — Interactive Activity System for Lamakū](https://www.notion.so/357ee4627a7481c68ad9eb5b50628e4a)**.

A Unity 6 / WebGL prototype with the same 7 activities exists at `~/OME Projects/` and is preserved as a working reference. This repo is the React rebuild after a stack pivot on 2026-05-05 (see Notion spec § "Why we pivoted").

## Planned stack

- Vite 6 · React 19 · TypeScript 5.7
- Tailwind CSS 4 (design tokens mirror in-repo `docs/design-system.md`)
- react-three-fiber 9 + @react-three/drei (for 3D activities)
- Zod 4 (replaces JSON Schema runtime validation)
- Vitest 3 + Playwright

## Activity types (initial 7)

Multiple Choice · Fill in the Blanks · Drag and Drop · Course Presentation · Question Set · 3D Hotspot Identification · Virtual Environment Tour

Future roadmap (see Notion spec): True/False, Image Hotspot 2D, Sequence/Order, Categorization, Audio Identification, Lab Panel Interpretation, Differential Diagnosis Tree, Math Input with KaTeX, Interactive Video, OSCE Clinical Encounter — plus Hawaiian-cultural and JABSOM-specific activities.

## Reference layout

```
kukui-web/
  src/
    core/            # palette, score, scorm, config-loader, ActivityHost
    activities/      # one folder per activity type
    pages/           # one entry per activity (per-build outputs)
    main.tsx
  public/
    samples/         # JSON fixtures (mirrors ../OME Projects/samples)
  packaging/         # SCORM wrapper template + pack-scorm.js
  tests/             # Vitest + Playwright
```

## Cross-links

- Notion spec: <https://www.notion.so/357ee4627a7481c68ad9eb5b50628e4a>
- Unity reference repo: `~/OME Projects/`
- Design system canon: `~/OME Projects/docs/design-system.md`
- JSON schemas: `~/OME Projects/docs/schemas/`
- Sample fixtures: `~/OME Projects/samples/`
- /kukui authoring command: `~/OME Projects/.claude/commands/kukui.md` (pending copy to this repo)

## License

TBD (likely UH internal).
