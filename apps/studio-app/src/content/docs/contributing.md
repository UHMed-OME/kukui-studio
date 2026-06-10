---
title: Contributing
description: Architecture overview and how to add a new activity type.
order: 8
updated: 2026-06-10
---

# Contributing

Kukui is MIT-licensed and we welcome contributions: bug fixes, new activity types, translations, documentation. This page is the architectural orientation. For the day-to-day workflow (forking, testing, PRing), see the [project README](https://github.com/UHMed-OME/kukui-studio).

## Repository layout

```
kukui-studio/
├── apps/
│   ├── studio-app/          authoring tool (Vite + React)
│   ├── engine-web/          per-activity runtime entries
│   └── live-mode/           Live mode (alpha)
├── packages/
│   ├── activities/          one bundle per activity kind ({slug}/schema.ts,
│   │                        Component.tsx, ui-schema.ts, starter.ts, meta.ts,
│   │                        samples/, manifest.ts)
│   ├── core/                ActivityHost runtime + scoring + SCORM/web drivers
│   ├── schemas/             cross-activity schema scaffolding + SchemaRegistry
│   ├── bridge/              SCORM 1.2 wrapper
│   ├── live/                Live transport (Trystero + Y.js)
│   └── embed/               <kukui-activity> custom element for web packages
├── packaging/
│   ├── pack-scorm.js        builds SCORM zips and web packages per kind
│   └── templates/imsmanifest.xml.tmpl
└── docs/
```

Three apps, six shared packages. Everything that defines one activity lives in a single bundle folder, `packages/activities/<slug>/`: its Zod schema, React component, Studio form metadata, starter config, and sample fixtures. Each bundle exports an `ActivityManifest` from its `manifest.ts`, and `packages/activities/src/index.ts` discovers all manifests via `import.meta.glob`: Studio's catalog, the schema registry, and the engine's activity router all derive from them automatically. The component consumes a Zod-validated config and emits a `ScoreState` on submit.

## Adding a new activity type

One bundle folder plus one HTML entry. Plan on a half-day for a simple activity, longer for ones with canvas editors or 3D rendering. The easiest path is to copy an existing bundle (`packages/activities/multiple-choice/` is the simplest) and adapt it. If you develop with Claude Code, the repo's `/kukui` slash command scaffolds a new bundle for you.

### 1. Create the bundle folder

Everything lives in `packages/activities/<slug>/`:

| File | Purpose |
|---|---|
| `schema.ts` | The Zod config schema (add a JSDoc header explaining what the activity is) |
| `Component.tsx` | The React component |
| `meta.ts` | Label, description, Bloom level, `live` flag |
| `starter.ts` | Minimal valid config: the form's initial value when an author picks the activity |
| `ui-schema.ts` | RJSF form hints (can be minimal if defaults are fine) |
| `samples/basic.json` | Sample fixture, served at `/samples/<slug>/` in dev and used as the packaging default |
| `manifest.ts` | Assembles the above into an `ActivityManifest` export |

A schema looks like:

```ts
import { z } from "zod";

export const MyActivityConfig = z.object({
  version: z.literal("1.0"),
  title: z.string().min(1),
  prompt: z.string().optional(),
  items: z.array(z.object({ id: z.string(), text: z.string() })).min(1),
  behaviour: z.object({ enableRetry: z.boolean().default(true) }).default({}),
});

export type MyActivityConfig = z.infer<typeof MyActivityConfig>;
```

The component receives a `config: MyActivityConfig` and an `onSubmit({ raw, max, success, suspendData })` prop. Keep accessibility tier-one: keyboard fallback for drag interactions, ARIA labels, `prefers-reduced-motion` respected.

### 2. There is no step 2 (registration is automatic)

`packages/activities/src/index.ts` discovers every bundle's `manifest.ts` via `import.meta.glob`. Studio's sidebar, the schema registry, the activity-host router, and packaging all derive from the manifests; there is no central registry file to hand-edit.

### 3. Add an engine-web entry

`apps/engine-web/<slug>.html` is the per-activity runtime entry that ships inside each package. Copy any existing one (e.g. `flashcards.html`) and change the `data-activity` / `data-config` attributes.

### 4. Build and test

```bash
pnpm typecheck
pnpm test                           # cross-reference tests check manifest completeness
pnpm dev:studio                     # author the activity locally
node packaging/pack-scorm.js --all  # SCORM zips (packaging auto-discovers slugs)
node packaging/pack-scorm.js --all --target web   # non-LMS web packages
```

## Style and conventions

- **Layout-stable interactions.** State changes must not reflow neighbors. Reserve space; change colors only.
- **Touch targets ≥ 44 × 44 px** (WCAG 2.2 AA, Apple HIG).
- **WCAG 2.2 AA contrast** (4.5 : 1 for body text).
- **No new color hex values.** Use tokens from `apps/studio-app/src/styles.css` (`@theme {}`) and the activity's local CSS variables.
- **No raw HTML injection on user-supplied strings.** Use the Tiptap-driven rich text path for any author or learner HTML.

## Tests

Each activity should have a test co-located in its bundle at `packages/activities/<slug>/Component.test.tsx` covering at least:

- Renders title + prompt
- The "keyboard fallback" path works (for drag-and-drop-style activities)
- Submission with a winning and losing state produces the right score

We use Vitest + React Testing Library. See `packages/activities/flashcards/Component.test.tsx` for a complete reference.

## Documentation

When you add an activity, please also:

1. Add an entry to `apps/studio-app/src/content/docs/activity-guide.md` (the [Activity catalog](/docs/activity-guide) page on this site)
2. Update the activity catalog count if it changes
3. Open a PR with screenshots

## What we'd love help with

The current open backlog, roughly in priority order:

- More activity types (especially clinical-reasoning-flavored ones)
- Internationalization (all strings are currently inline in components)
- Better author-side analytics ("how long did learners spend?")
- Larger-room support for Live mode (hub fallback past ~300 students)

See the [Issues tab](https://github.com/UHMed-OME/kukui-studio/issues) for specific items.
