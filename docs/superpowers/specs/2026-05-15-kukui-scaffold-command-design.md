# Activity co-location refactor + simplified `/kukui` scaffold — design

**Status:** design approved 2026-05-20 — implementation plan pending
**Supersedes:** earlier draft of this file that scoped only the scaffold command without the architectural refactor.

## Why this exists

Today, adding a new activity type to Kukui touches **~16 files across four packages and two apps** — and that's before counting the per-activity HTML entry and (optional) Live variant. The actual surface, mapped from the codebase as of 2026-05-20:

| Layer | Files touched | Hand-authored content (not auto-derivable) |
|---|---|---|
| Schemas | `schemas/src/index.ts` (3 edits) | the schema itself |
| Core types | `core/src/types.ts` (2 edits), `core/src/components/registry.ts` (1 edit) | — |
| Engine | `apps/engine-web/vite.config.ts:68-95` (hardcoded list), `apps/engine-web/{slug}.html` (per-slug HTML) | — |
| Studio | `apps/studio-app/src/{App.tsx, Preview.tsx, uiSchemas.ts, starters.ts, activityIcons.tsx, EditCanvas/index.tsx}` | Bloom level, uiSchema (per-field labels), starter config, icon SVG, optional visual editor |
| Tests | `packages/schemas/src/fixtures.test.ts:10-18` | (already drifted: hardcodes 7 of 25 activities) |
| Packaging | `packaging/pack-scorm.js:56-82` (hardcoded list) | — |
| Live | `apps/live-mode/src/LiveHost.tsx:189-224` (if-chain dispatch), `apps/live-mode/src/activities/{Slug}Live.tsx`, `use{Slug}.ts` | the Live component, the hook |

Most of the friction comes from **synchronized enumeration**: arrays, switch maps, and lazy-import objects that must each be edited when a new kind is added. A scaffold command that hides this complexity behind a CLI helps individuals, but doesn't fix the underlying architecture — and the `fixtures.test.ts` drift (only 7 of 25 activities covered today) is direct evidence that hand-maintained registries lose to entropy.

## The core idea

**Co-locate everything per activity into `packages/activities/{slug}/`, and replace enumeration with auto-discovery.** A new activity becomes one folder with a small set of files, and downstream consumers (engine, Studio, packaging, fixtures test, Live registry) auto-discover via Vite's `import.meta.glob` or filesystem reads.

### Per-activity folder shape

```
packages/activities/{slug}/
├── manifest.ts             # exports `activity` — the contract (see below)
├── schema.ts               # Zod schema; manifest re-exports
├── Component.tsx           # engine-mode React component
├── Component.test.tsx      # smoke test + per-activity behavior tests
├── Component.css           # optional, only if Tailwind tokens insufficient
├── samples/
│   ├── basic.json          # required; tested for parse-success
│   ├── full.json           # optional; tested for parse-success
│   └── _invalid/           # optional; tested for parse-failure
│       └── *.json
├── ui-schema.ts            # RJSF uiSchema for Studio (often substantial; hand-authored)
├── starter.ts              # minimal valid config for Studio's "new activity" template
├── icon.tsx                # SVG icon for Studio's sidebar/picker
├── editor.tsx              # optional: visual canvas editor for Studio (lazy)
└── meta.ts                 # bloom level, description, label, live flag
```

### The manifest contract

`manifest.ts` exports a single `activity` object that downstream consumers read:

```ts
import { lazy } from "react";
import type { ActivityManifest } from "@kukui/activities/types";
import { schema } from "./schema.js";
import uiSchema from "./ui-schema.js";
import starter from "./starter.js";
import { Icon } from "./icon.js";
import { label, description, bloom, live } from "./meta.js";

export const activity: ActivityManifest<"multiple-choice"> = {
  kind: "multiple-choice",
  schema,
  Component: lazy(() => import("./Component.js")),
  uiSchema,
  starter,
  Icon,
  label, description, bloom, live,
  Editor: lazy(() => import("./editor.js")), // optional
};
```

The `ActivityManifest` type pins `kind` as a string literal, so when manifests are collected into a glob-imported map, the union `BuiltActivityKind` is derivable:

```ts
const modules = import.meta.glob<{ activity: ActivityManifest }>("./*/manifest.ts", { eager: true });
export const ACTIVITY_MANIFESTS = Object.fromEntries(
  Object.values(modules).map((m) => [m.activity.kind, m.activity]),
);
export type BuiltActivityKind = (typeof ACTIVITY_MANIFESTS)[keyof typeof ACTIVITY_MANIFESTS]["kind"];
```

Lazy components stay lazy (Vite chunk-splits per import), so engine bundle size is unchanged.

### What lives where (after refactor)

| Concern | Owns the data | Reads the data |
|---|---|---|
| Schema | `packages/activities/{slug}/schema.ts` | `@kukui/activities` glob; `@kukui/schemas` re-exports for back-compat |
| Component | `packages/activities/{slug}/Component.tsx` (lazy) | `@kukui/activities` glob; `@kukui/core` re-exports `ACTIVITY_REGISTRY` |
| Sample fixtures | `packages/activities/{slug}/samples/*.json` | `fixtures.test.ts` (glob); engine-web loader (glob → emitted as static assets at build) |
| uiSchema | `packages/activities/{slug}/ui-schema.ts` | Studio's `uiSchemas.ts` becomes a barrel that exports `Object.fromEntries(...glob)` |
| Starter | `packages/activities/{slug}/starter.ts` | same pattern for `starters.ts` |
| Icon | `packages/activities/{slug}/icon.tsx` | same pattern for `activityIcons.tsx` |
| Bloom / label / description / live-flag | `packages/activities/{slug}/meta.ts` | derived map in `@kukui/activities` |
| Visual editor (optional) | `packages/activities/{slug}/editor.tsx` (lazy) | Studio's `EditCanvas/index.tsx` builds `EDITORS` map from manifests with `Editor` set |

### What stays in apps/live-mode

Per the explore-agent recommendation, **Live variants do not move**. The eager-dispatch latency and app-level room/CRDT coupling make co-location costly without a clear win. Instead, Live gets the same registry treatment **within its current folder**:

```
apps/live-mode/src/activities/
├── index.ts                  # barrel: collects { kind, Component, useHook? } from this dir
├── StrawPollLive.tsx
├── useStrawPoll.ts
├── ... (per-activity files unchanged)
```

`LiveHost.tsx`'s if-chain dispatch becomes a `Record<ActivityKind, LiveActivityManifest>` lookup. Each Live file gains an `export const liveActivity = { kind, Component, useHook? }` and the barrel collects via glob. The `meta.ts` `live: true` flag in the engine-side manifest signals Studio that a Live mode exists; cross-reference is enforced by a small test that every `live: true` kind has a matching entry in Live's barrel.

## Phased plan

The refactor is large enough that big-bang risks weeks of churn. Eight phases, each independently shippable, with the green-build invariant held between them.

### Phase 1 — Manifest contract + infrastructure (no migration)

**Goal:** create the new package, define the contract, prove the glob discovery works.

- Add `packages/activities/` to `pnpm-workspace.yaml`, `tsconfig.json` references
- Create `packages/activities/src/types.ts` (the `ActivityManifest<K>` type)
- Create `packages/activities/src/index.ts` with the empty glob (returns `{}` until a manifest is added)
- Add `packages/activities/tsconfig.json` (composite, references `@kukui/schemas`)
- Add minimal vitest setup
- No activities migrated. `pnpm typecheck && pnpm test` stays green.

### Phase 2 — Pilot: migrate `multiple-choice` end-to-end

**Goal:** verify the contract under real load before bulk migration.

- Create `packages/activities/multiple-choice/{manifest.ts, schema.ts, Component.tsx, Component.test.tsx, samples/basic.json, samples/full.json, ui-schema.ts, starter.ts, icon.tsx, meta.ts}` by moving + adapting from current locations
- Update `packages/schemas/src/index.ts` to import multiple-choice's schema from `@kukui/activities/multiple-choice` (re-export for back-compat with existing imports)
- Update `packages/core/src/components/registry.ts` to import the lazy component from `@kukui/activities/multiple-choice`
- Update `apps/studio-app/src/uiSchemas.ts` to read `multiple-choice` entry from `@kukui/activities`
- Same for `starters.ts`, `activityIcons.tsx`, App.tsx's BLOOM_BY_KIND
- Verify: `pnpm typecheck`, `pnpm test`, `pnpm dev` (engine + Studio), `node packaging/pack-scorm.js --activity multiple-choice`

### Phase 3 — Studio aggregator gut

**Goal:** Studio's per-kind files become thin barrels that aggregate manifests, not data files.

- `apps/studio-app/src/uiSchemas.ts` → builds `UI_SCHEMAS` from `ACTIVITY_MANIFESTS`; still ~30 lines for `COMMON` fragment plus a fold over manifests. Falls back to the `PLANNED_ACTIVITY_KINDS` stub generator for unmigrated kinds (which all kinds except `multiple-choice` are, at this phase).
- Same shape for `starters.ts`, `activityIcons.tsx`
- App.tsx: `BLOOM_BY_KIND` derived from `Object.fromEntries(manifests.map(m => [m.kind, m.bloom]))`, with a hand-curated override map for kinds whose Bloom assignment needs designer judgment
- `Preview.tsx` and EditCanvas: read `Editor` from manifests where present
- After this phase, **only multiple-choice is fully manifest-driven; everything else still uses the old enumeration**. The aggregators handle both during the transition.

### Phase 4 — Engine + packaging + fixtures-test auto-discovery

**Goal:** replace hardcoded slug lists in build pipelines.

- `apps/engine-web/vite.config.ts:68-95`: replace `rollupOptions.input` with a glob over `apps/engine-web/*.html` (which is what the list mirrors anyway). Activities continue to live as one HTML file each per Vite's static-multi-page pattern.
- `packaging/pack-scorm.js:56-82`: replace `PHASE_1_ACTIVITIES` with `readdirSync('packages/activities/').filter(isDir)`
- `packages/schemas/src/fixtures.test.ts:10-18`: replace `ACTIVITIES` array with auto-discovery — `readdir('packages/activities/')`. **Closes the existing drift** where only 7 of 25 activities are sample-tested today.
- `apps/engine-web/src/main.tsx:17` and per-slug HTML `data-config="samples/{slug}/basic.json"`: samples need to be served as static assets, so add an `engine-web` Vite plugin that copies (or symlinks) `packages/activities/*/samples/` into `apps/engine-web/public/samples/` at dev/build time. Alternative: change loader to use `import.meta.glob` over packages/activities and remove the public/ samples directory entirely — preferred, but slightly more invasive.

### Phase 5 — Bulk migration of remaining 24 activities

**Goal:** mechanical move of each remaining activity into `packages/activities/{slug}/`.

- One activity per commit, or batched into thematic groups (e.g. "the 6 live-flagged ones," "the 8 vision-based ones") for readable PRs
- For each: copy schema/component/test/samples into the new folder; create manifest.ts; hand-port uiSchema/starter/icon entries from the old central files into per-activity files; delete now-orphan central entries
- The aggregators from Phase 3 absorb each migration without code changes — they already loop over whatever's in `ACTIVITY_MANIFESTS`
- After Phase 5, central enumeration files are empty (or contain only the `COMMON` uiSchema fragment, etc.). They can be inlined into the aggregators or deleted entirely.

### Phase 6 — Live-mode registry refactor

**Goal:** replace `LiveHost.tsx`'s if-chain dispatch (`LiveHost.tsx:189-224`) with a barrel + map lookup, mirroring the engine pattern within Live's own folder.

- Add `export const liveActivity = { kind, Component, useHook? }` to each `*Live.tsx`
- Create `apps/live-mode/src/activities/index.ts` that globs `*Live.tsx` and builds `LIVE_ACTIVITY_REGISTRY: Record<ActivityKind, LiveActivityManifest>`
- Rewrite LiveHost dispatch to `const Live = LIVE_ACTIVITY_REGISTRY[kind]; return <Live.Component .../>` — still eager-imported (no lazy chunks) per Live's latency constraint
- Add a cross-reference test in `packages/activities` that every manifest with `live: true` has a matching entry in `LIVE_ACTIVITY_REGISTRY`. The test reads the Live barrel at test time and asserts the intersection.

### Phase 7 — Cleanup & docs

**Goal:** remove transitional shims; update documentation; lock in the new pattern.

- Remove `packages/schemas/src/index.ts`'s explicit per-kind imports if they're now just re-exports from `@kukui/activities`; keep the barrel if downstream consumers still need it for back-compat
- Remove `apps/engine-web/public/samples/` once Phase 4's alternative landed
- Update `CLAUDE.md` "Where things live" section to point at the new layout
- Update `AGENTS.md`, the activity authoring section in `docs/ux-design.md`
- Update `.claude/commands/kukui.md` to reflect the new layout (next phase ships the rewrite)

### Phase 8 — Rewrite `/kukui` scaffold command

**Goal:** the scaffold command from the original spec, but now trivial.

The two-mode shape from the original draft survives — Step 0 still branches between "author content for existing activity" and "scaffold new activity." The S1–S5 interview design also survives unchanged. What changes is the **write phase**:

Instead of four batches with type-check gates across 8–13 files, the command writes **one folder, 9–11 files in it**, no edits to shared files:

```
packages/activities/{slug}/
├── manifest.ts
├── schema.ts
├── Component.tsx
├── Component.test.tsx
├── samples/basic.json
├── ui-schema.ts            # generated starter; user TODO to polish
├── starter.ts              # derived from schema defaults
├── icon.tsx                # placeholder rectangle; user TODO to draw
└── meta.ts                 # populated from S1 (label, description, bloom guess)
```

Single typecheck-and-test gate at the end. Optional Live variant adds two files to `apps/live-mode/src/activities/`. The objective-driven discovery flow (S1 objective intake + S2 proposal slate with "How it fits in Kukui" + S3 schema-axis confirmation) is unchanged.

The end-of-run TODO list shrinks dramatically: hand-tune `ui-schema.ts`, draw real `icon.tsx`, wire component interactions. No registry edits to remember.

## Hard rules preserved

All hard rules from CLAUDE.md and the original spec carry forward unchanged:
- No "H5P" in any generated file or comment
- No invented design-token values
- WCAG 2.2 AA in component skeletons (44×44 hit targets, layout-stable state, color paired with text/icon/position)
- Generated JSDoc cites the learning objective verbatim

## Non-goals

- **No migration of Live variants into packages/activities/**. Live stays in `apps/live-mode/src/activities/` with a barrel registry of its own.
- **No retroactive coverage backfill** during the refactor itself. The Phase 4 fixture-test auto-discovery will surface kinds without `basic.json` (currently 18 of 25 activities lack a tested fixture); adding those fixtures is follow-up work, not blocking.
- **No AI-generated uiSchema polish.** The scaffold's generated `ui-schema.ts` is a starting point. Hand-tuning is the contract.
- **No retiring the `PLANNED_ACTIVITY_KINDS` extension point.** It still serves as the "in catalog but not built" tier; only the Studio aggregators stop being the source of truth for built-kind enumeration.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| `import.meta.glob` with eager mode breaks tree-shaking → engine bundles bloat | Use lazy glob for Component/Editor (default in Vite); eager only for tiny manifest objects (schema refs, label, bloom). Verified pattern in existing `apps/studio-app/src/pages/content.ts`. |
| TS project references break with circular deps between `packages/activities` and `packages/core` | `@kukui/activities` depends on `@kukui/schemas` only. `@kukui/core`'s ACTIVITY_REGISTRY re-exports from `@kukui/activities`, never the reverse. One-way arrow. |
| Phase 5 bulk migration introduces subtle regressions per kind | Phase 2's pilot proves the contract end-to-end. Phase 3's aggregators tolerate mixed (manifest + legacy) state for the duration of Phase 5. Each kind's migration is one commit, easy to revert. |
| `BuiltActivityKind` union becomes `string` in some contexts | Force `kind` to be `const`-asserted in each manifest. Use `as const satisfies ActivityManifest` pattern. Add a typecheck test that the union has the expected member count. |
| Engine HTML pages reference samples via relative URLs (`samples/{slug}/basic.json`) — moving samples breaks this | Phase 4 either (a) keeps a Vite plugin that copies packages/activities/*/samples into engine-web public/ at build time, or (b) switches the loader to glob-based JSON imports. Path (a) is safer; (b) is cleaner. Decide at Phase 4. |
| The 18 of 25 untested-fixture activities surface as test failures the moment fixtures.test.ts auto-discovers | Either backfill the missing `basic.json` files before merging Phase 4 (mechanical work), or scope the auto-discovery to "test every fixture that exists, don't require every activity to have one" — the latter is the right move during transition. |
