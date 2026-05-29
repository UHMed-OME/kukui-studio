---
title: Contributing
description: Architecture overview and how to add a new activity type.
order: 7
updated: 2026-05-12
---

# Contributing

Kukui is MIT-licensed and we welcome contributions — bug fixes, new activity types, translations, documentation. This page is the architectural orientation. For the day-to-day workflow (forking, testing, PRing), see the [project README](https://github.com/UHMed-OME/kukui-studio).

## Repository layout

```
kukui-studio/
├── apps/
│   ├── studio-app/          authoring tool (Vite + React)
│   ├── engine-web/          per-activity SCORM entries
│   └── live-mode/           Live mode (alpha)
├── packages/
│   ├── core/                activity components + scoring + ActivityHost
│   ├── schemas/             one Zod schema per activity kind
│   ├── bridge/              SCORM 1.2 wrapper
│   └── live/                Live transport (Trystero + Y.js)
├── packaging/
│   ├── pack-scorm.js        builds each kukui-<kind>.scorm.zip
│   └── templates/imsmanifest.xml.tmpl
└── docs/
```

Three apps, four shared packages. Activities are React components in `packages/core/src/components/<kind>/`; they consume Zod-validated config from `packages/schemas/<kind>.ts` and emit a `ScoreState` on submit.

## Adding a new activity type

Roughly seven files to touch. Plan on a half-day for a simple activity, longer for ones with canvas editors or 3D rendering.

### 1. Define the schema

Create `packages/schemas/src/<kind>.ts`. Use Zod, add a JSDoc header explaining what the activity is.

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

Register it in `packages/schemas/src/index.ts`.

### 2. Build the React component

Create `packages/core/src/components/<kind>/MyActivity.tsx`. The component receives a `config: MyActivityConfig` and an `onSubmit({ raw, max, success, suspendData })` prop.

Keep accessibility tier-one: keyboard fallback for drag interactions, ARIA labels, `prefers-reduced-motion` respected.

### 3. Hook it into the activity host

`packages/core/src/activity-host.tsx` is the runtime router. Add your kind to the discriminated union there.

### 4. Add a starter to Studio

`apps/studio-app/src/starters.ts` carries a minimal valid config per kind — the form's initial value when an author picks the activity.

### 5. Add a uiSchema (optional)

`apps/studio-app/src/uiSchemas.ts` controls how RJSF renders each field. Skip if defaults are fine.

### 6. Add an engine-web entry

`apps/engine-web/<kind>.html` is the per-activity SCORM bundle entry. Copy any existing one (e.g. `flashcards.html`) and change the kind reference.

### 7. Wire packaging

`packaging/pack-scorm.js` has a `PHASE_1_ACTIVITIES` list — add your kind. Running `node packaging/pack-scorm.js --all` after that produces `packaging/build/kukui-<kind>.scorm.zip`.

### 8. Build and test

```bash
pnpm typecheck
pnpm test
pnpm dev:studio                   # author the activity locally
node packaging/pack-scorm.js --all  # build the SCORM zip
```

## Style and conventions

- **Layout-stable interactions.** State changes must not reflow neighbors. Reserve space; change colors only.
- **Touch targets ≥ 44 × 44 px** (WCAG 2.2 AA, Apple HIG).
- **WCAG 2.2 AA contrast** (4.5 : 1 for body text).
- **No new color hex values.** Use tokens from `apps/studio-app/src/styles.css` (`@theme {}`) and the activity's local CSS variables.
- **No raw HTML injection on user-supplied strings.** Use the Tiptap-driven rich text path for any author or learner HTML.

## Tests

Each activity should have a test in `packages/core/src/components/<kind>/<Kind>.test.tsx` covering at least:

- Renders title + prompt
- The "keyboard fallback" path works (for drag-and-drop-style activities)
- Submission with a winning and losing state produces the right score

We use Vitest + React Testing Library. See `Flashcards.test.tsx` for a complete reference.

## Documentation

When you add an activity, please also:

1. Add an entry to `docs/docs/activity-guide.md` (this site)
2. Update the activity catalog count if it changes
3. Open a PR with screenshots

## What we'd love help with

The current open backlog, roughly in priority order:

- More activity types (especially clinical-reasoning-flavored ones)
- Internationalization (all strings are currently inline in components)
- Better author-side analytics ("how long did learners spend?")
- Larger-room support for Live mode (hub fallback past ~300 students)

See the [Issues tab](https://github.com/UHMed-OME/kukui-studio/issues) for specific items.
