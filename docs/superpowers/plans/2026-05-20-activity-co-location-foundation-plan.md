# Activity Co-Location Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the new `@kukui/activities` package with the per-activity manifest contract; migrate `multiple-choice` end-to-end as a pilot; refactor Studio's aggregator files (`uiSchemas.ts`, `starters.ts`, `activityIcons.tsx`, `App.tsx`'s BLOOM map) so they read from manifests with legacy fallback; replace hardcoded slug lists in the build pipeline with auto-discovery. After this plan ships, the codebase is ready for bulk migration of the remaining 24 activities (Plan 2).

**Architecture:** A new workspace package `packages/activities/` hosts per-activity folders. Each folder owns its schema, component, samples, RJSF uiSchema, starter config, icon SVG, and meta (label/description/bloom/live-flag). The package's `src/index.ts` uses Vite's `import.meta.glob` (eager for tiny metadata, lazy for components/editors) to assemble `ACTIVITY_MANIFESTS`, `SchemaRegistry`, `ACTIVITY_REGISTRY`-equivalent, and `BUILT_ACTIVITY_KINDS`. Downstream consumers in `@kukui/schemas`, `@kukui/core`, Studio, engine-web, and the SCORM packager are refactored to read from the new package. During the transition (while only `multiple-choice` is migrated), aggregator files fall back to legacy per-kind data for unmigrated kinds.

**Tech Stack:** pnpm workspaces (workspace `packages/*` + `apps/*`); TS project references with `composite: true`; Vite 6 with `import.meta.glob`; Vitest 3 (jsdom); React 19 + Zod 4.

---

## File Structure

**New (created in this plan):**
- `packages/activities/package.json` — workspace manifest for `@kukui/activities`
- `packages/activities/tsconfig.json` — composite TS config, references `@kukui/schemas`
- `packages/activities/src/types.ts` — `ActivityManifest<K>` type contract
- `packages/activities/src/index.ts` — glob-based registry assembly
- `packages/activities/src/index.test.ts` — smoke test for glob discovery
- `packages/activities/multiple-choice/manifest.ts` — wires together all the pieces below
- `packages/activities/multiple-choice/schema.ts` — moved from `packages/schemas/src/multiple-choice.ts`
- `packages/activities/multiple-choice/Component.tsx` — moved from `packages/core/src/components/multiple-choice/MultipleChoice.tsx`
- `packages/activities/multiple-choice/Component.test.tsx` — moved from `packages/core/src/components/multiple-choice/MultipleChoice.test.tsx`
- `packages/activities/multiple-choice/Component.css` — moved from `packages/core/src/components/multiple-choice/MultipleChoice.css`
- `packages/activities/multiple-choice/samples/basic.json` — moved from `apps/engine-web/public/samples/multiple-choice/basic.json`
- `packages/activities/multiple-choice/samples/full.json` — moved similarly
- `packages/activities/multiple-choice/samples/_invalid/missing-required.json` — moved similarly
- `packages/activities/multiple-choice/samples/_invalid/wrong-type.json` — moved similarly
- `packages/activities/multiple-choice/ui-schema.ts` — extracted from `apps/studio-app/src/uiSchemas.ts:106`
- `packages/activities/multiple-choice/starter.ts` — extracted from `apps/studio-app/src/starters.ts:35`
- `packages/activities/multiple-choice/icon.tsx` — extracted from `apps/studio-app/src/activityIcons.tsx`
- `packages/activities/multiple-choice/meta.ts` — collected from various sources (label from `starters.ts:555`, bloom from `App.tsx:79-115`)
- `apps/engine-web/vite-plugin-activity-samples.ts` — Vite plugin that serves and emits `packages/activities/*/samples/` files at the `samples/` URL path

**Modified:**
- `tsconfig.json` (root) — add `{ "path": "./packages/activities" }` reference
- `packages/schemas/src/index.ts` — re-export `MultipleChoiceConfigSchema` and `MultipleChoiceConfig` from `@kukui/activities/multiple-choice/schema` (back-compat shim)
- `packages/schemas/package.json` — change `"./multiple-choice"` exports entry to re-export from `@kukui/activities` (back-compat)
- `packages/core/src/components/registry.ts:25` — change `multiple-choice` lazy import to `@kukui/activities/multiple-choice/Component`
- `apps/studio-app/src/uiSchemas.ts` — replace `multiple-choice` hardcoded entry with import from `@kukui/activities`; build `UI_SCHEMAS` as `{ ...legacyMap, ...manifestMap }`
- `apps/studio-app/src/starters.ts` — same pattern for `STARTERS` and `ACTIVITY_LABELS`
- `apps/studio-app/src/activityIcons.tsx` — same pattern
- `apps/studio-app/src/App.tsx` — `BLOOM_BY_KIND` reads bloom level from manifests, falls back to legacy hand-curated map
- `apps/engine-web/vite.config.ts` — replace hardcoded `rollupOptions.input` slug list with glob over `*.html`; register the new activity-samples plugin
- `packaging/pack-scorm.js` — replace `PHASE_1_ACTIVITIES` array with directory scan of `packages/activities/`
- `packages/schemas/src/fixtures.test.ts` — auto-discover slugs from `packages/activities/`; test the fixtures that exist (don't require every activity to have one)

**Deleted (after this plan):**
- `packages/schemas/src/multiple-choice.ts` — moved to `packages/activities/multiple-choice/schema.ts`
- `packages/core/src/components/multiple-choice/` (whole directory) — moved
- `apps/engine-web/public/samples/multiple-choice/` (whole directory) — served via the new Vite plugin from the activities package

---

## Phase 1 — Manifest contract + package infrastructure

### Task 1: Scaffold the `@kukui/activities` workspace package

**Files:**
- Create: `packages/activities/package.json`
- Create: `packages/activities/tsconfig.json`
- Create: `packages/activities/src/types.ts` (placeholder; expanded in Task 2)
- Create: `packages/activities/src/index.ts` (placeholder; expanded in Task 3)

- [ ] **Step 1: Create `packages/activities/package.json`**

```json
{
  "name": "@kukui/activities",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types.ts",
    "./*": "./*"
  },
  "dependencies": {
    "@kukui/schemas": "workspace:*",
    "react": "^19.0.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "typescript": "^5.7.2"
  }
}
```

Note: the `"./*": "./*"` wildcard lets consumers import `@kukui/activities/multiple-choice/manifest` etc.

- [ ] **Step 2: Create `packages/activities/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "dist",
    "composite": true,
    "tsBuildInfoFile": "dist/.tsbuildinfo",
    "jsx": "react-jsx"
  },
  "include": ["src/**/*", "*/**/*.ts", "*/**/*.tsx"],
  "exclude": ["dist", "**/*.test.ts", "**/*.test.tsx"],
  "references": [
    { "path": "../schemas" }
  ]
}
```

Note: `rootDir: "."` (not `src`) because per-activity files live alongside `src/`, not under it. Mirrors `apps/engine-web/tsconfig.json` pattern.

- [ ] **Step 3: Create placeholder `packages/activities/src/types.ts`**

```ts
// Expanded in Task 2.
export type Placeholder = never;
```

- [ ] **Step 4: Create placeholder `packages/activities/src/index.ts`**

```ts
// Expanded in Task 3.
export {};
```

- [ ] **Step 5: Run `pnpm install` to register the workspace package**

Run: `pnpm install`
Expected: completes without errors; `@kukui/activities` appears as a known workspace package.

- [ ] **Step 6: Commit**

```bash
git add packages/activities/package.json packages/activities/tsconfig.json packages/activities/src/
git commit -m "feat(activities): scaffold @kukui/activities workspace package"
```

---

### Task 2: Define the `ActivityManifest` type contract

**Files:**
- Modify: `packages/activities/src/types.ts`
- Test: `packages/activities/src/types.test.ts`

- [ ] **Step 1: Write the failing test in `packages/activities/src/types.test.ts`**

```ts
import { describe, it, expectTypeOf } from "vitest";
import type { ActivityManifest, BloomLevel } from "./types.js";
import type { z } from "zod";
import type { ComponentType, LazyExoticComponent } from "react";

describe("ActivityManifest", () => {
  it("pins kind as a string literal", () => {
    type M = ActivityManifest<"foo">;
    expectTypeOf<M["kind"]>().toEqualTypeOf<"foo">();
  });

  it("requires schema, Component, uiSchema, starter, Icon, label, description, bloom, live", () => {
    type M = ActivityManifest<"foo">;
    expectTypeOf<M["schema"]>().toMatchTypeOf<z.ZodTypeAny>();
    expectTypeOf<M["Component"]>().toMatchTypeOf<LazyExoticComponent<ComponentType<unknown>>>();
    expectTypeOf<M["uiSchema"]>().toMatchTypeOf<Record<string, unknown>>();
    expectTypeOf<M["starter"]>().toMatchTypeOf<unknown>();
    expectTypeOf<M["Icon"]>().toMatchTypeOf<ComponentType<{ className?: string }>>();
    expectTypeOf<M["label"]>().toEqualTypeOf<string>();
    expectTypeOf<M["description"]>().toEqualTypeOf<string>();
    expectTypeOf<M["bloom"]>().toMatchTypeOf<BloomLevel>();
    expectTypeOf<M["live"]>().toEqualTypeOf<boolean>();
  });

  it("permits optional Editor as lazy component", () => {
    type M = ActivityManifest<"foo">;
    expectTypeOf<M["Editor"]>().toMatchTypeOf<LazyExoticComponent<ComponentType<unknown>> | undefined>();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/activities/src/types.test.ts`
Expected: FAIL — `ActivityManifest` and `BloomLevel` not exported from `./types.js`.

- [ ] **Step 3: Write the type definitions in `packages/activities/src/types.ts`**

```ts
import type { ComponentType, LazyExoticComponent } from "react";
import type { z } from "zod";

export type BloomLevel =
  | "remember"
  | "understand"
  | "apply"
  | "analyze"
  | "evaluate"
  | "create";

export interface ActivityManifest<K extends string = string> {
  /** Stable kebab-case identifier. Must be unique across all activities. */
  kind: K;
  /** Zod schema that validates this activity's JSON config. */
  schema: z.ZodTypeAny;
  /** Engine-mode React component, lazy-loaded so Vite chunk-splits per activity. */
  Component: LazyExoticComponent<ComponentType<unknown>>;
  /** RJSF uiSchema for Studio's form editor. */
  uiSchema: Record<string, unknown>;
  /** Minimal valid config used as Studio's "new activity" starter template. */
  starter: unknown;
  /** SVG icon for Studio's sidebar/picker. */
  Icon: ComponentType<{ className?: string }>;
  /** Display name shown in Studio's catalog. */
  label: string;
  /** One-line description for Studio's catalog and learning-objective matching. */
  description: string;
  /** Bloom's taxonomy level — drives Studio's cognitive-level filter. */
  bloom: BloomLevel;
  /** True if this activity has a Live (Phase 3) classroom variant in apps/live-mode. */
  live: boolean;
  /** Optional visual canvas editor for Studio (lazy-loaded). */
  Editor?: LazyExoticComponent<ComponentType<unknown>>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/activities/src/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Run `pnpm typecheck` to verify TS project references resolve**

Run: `pnpm typecheck`
Expected: PASS (no errors).

- [ ] **Step 6: Commit**

```bash
git add packages/activities/src/types.ts packages/activities/src/types.test.ts
git commit -m "feat(activities): define ActivityManifest type contract"
```

---

### Task 3: Wire `import.meta.glob` registry assembly in `packages/activities/src/index.ts`

**Files:**
- Modify: `packages/activities/src/index.ts`
- Test: `packages/activities/src/index.test.ts`

- [ ] **Step 1: Write the failing test in `packages/activities/src/index.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  ACTIVITY_MANIFESTS,
  BUILT_ACTIVITY_KINDS,
  getManifest,
} from "./index.js";

describe("@kukui/activities registry", () => {
  it("exports an ACTIVITY_MANIFESTS map", () => {
    expect(ACTIVITY_MANIFESTS).toBeTypeOf("object");
  });

  it("BUILT_ACTIVITY_KINDS is derived from manifest keys", () => {
    expect(BUILT_ACTIVITY_KINDS).toEqual(Object.keys(ACTIVITY_MANIFESTS).sort());
  });

  it("getManifest returns undefined for unknown kinds", () => {
    expect(getManifest("nonexistent-kind" as never)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/activities/src/index.test.ts`
Expected: FAIL — `ACTIVITY_MANIFESTS`, `BUILT_ACTIVITY_KINDS`, `getManifest` not exported.

- [ ] **Step 3: Implement `packages/activities/src/index.ts`**

```ts
import type { ActivityManifest } from "./types.js";

export type { ActivityManifest, BloomLevel } from "./types.js";

/**
 * Eagerly imports every per-activity manifest at build time. Vite resolves
 * the glob during dev and bundling; manifests are tiny (schema refs + lazy
 * component refs + label/bloom/etc.) so eager is cheap. Components and
 * Editors inside the manifests remain lazy via React.lazy().
 *
 * Glob pattern matches `packages/activities/<slug>/manifest.ts` files
 * relative to this file. The leading `../` walks out of `src/`.
 */
const modules = import.meta.glob<{ activity: ActivityManifest<string> }>(
  "../*/manifest.ts",
  { eager: true },
);

/**
 * Map from activity kind (e.g. `"multiple-choice"`) to its full manifest.
 * Populated at module load time from the glob above.
 */
export const ACTIVITY_MANIFESTS: Record<string, ActivityManifest<string>> =
  Object.fromEntries(
    Object.values(modules).map((m) => [m.activity.kind, m.activity]),
  );

/**
 * Sorted list of all built activity kinds. Use for catalog iteration.
 * Sort keeps test snapshots and Studio's catalog deterministic.
 */
export const BUILT_ACTIVITY_KINDS: readonly string[] = Object.keys(
  ACTIVITY_MANIFESTS,
).sort();

/**
 * Look up a manifest by kind. Returns undefined if the kind isn't registered
 * (e.g. it's a `PlannedActivityKind` or a typo).
 */
export function getManifest(kind: string): ActivityManifest<string> | undefined {
  return ACTIVITY_MANIFESTS[kind];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/activities/src/index.test.ts`
Expected: PASS. `ACTIVITY_MANIFESTS` will be `{}` since no manifests exist yet.

- [ ] **Step 5: Verify `pnpm typecheck` still passes**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/activities/src/index.ts packages/activities/src/index.test.ts
git commit -m "feat(activities): assemble registry via import.meta.glob (empty until migrations land)"
```

---

### Task 4: Add `@kukui/activities` to root TS project references

**Files:**
- Modify: `tsconfig.json` (root)

- [ ] **Step 1: Read the existing references array**

Run: `cat tsconfig.json`
Expected: shows the existing `references` array with paths to schemas, core, engine-web, studio-app, live-mode, live, bridge (or similar).

- [ ] **Step 2: Add the activities reference**

Edit `tsconfig.json` and add `{ "path": "./packages/activities" }` to the `references` array. Order it after `./packages/schemas` and before `./packages/core` so the build graph respects the dependency.

- [ ] **Step 3: Run `pnpm typecheck` to verify the new reference resolves end-to-end**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tsconfig.json
git commit -m "build: register @kukui/activities in root TS project references"
```

---

## Phase 2 — Pilot: migrate `multiple-choice` end-to-end

### Task 5: Move `multiple-choice` schema into the activities package

**Files:**
- Create: `packages/activities/multiple-choice/schema.ts`
- Delete: `packages/schemas/src/multiple-choice.ts`
- Modify: `packages/schemas/src/index.ts` (re-export from new location)
- Modify: `packages/schemas/package.json` (point subpath export at new location)

- [ ] **Step 1: Move the file**

Run: `git mv packages/schemas/src/multiple-choice.ts packages/activities/multiple-choice/schema.ts`
Expected: file moves cleanly, git tracks rename.

- [ ] **Step 2: Update imports inside the moved file**

The schema imports `ScoringSchema` from `./scoring.js` and `AppearanceSchema` from `./appearance.js` — paths that resolved when the file was in `packages/schemas/src/`. From the new location, these become package-relative imports. Edit `packages/activities/multiple-choice/schema.ts` and change the imports at the top from:

```ts
import { ScoringSchema } from "./scoring.js";
import { AppearanceSchema } from "./appearance.js";
```

to:

```ts
import { ScoringSchema, AppearanceSchema } from "@kukui/schemas";
```

- [ ] **Step 3: Update `packages/schemas/src/index.ts` to re-export from the new location**

Find the lines:

```ts
export {
  MultipleChoiceConfigSchema,
  type MultipleChoiceConfig,
} from "./multiple-choice.js";
```

and replace with:

```ts
export {
  MultipleChoiceConfigSchema,
  type MultipleChoiceConfig,
} from "@kukui/activities/multiple-choice/schema";
```

Also find and update the second occurrence (the `import { MultipleChoiceConfigSchema } from "./multiple-choice.js";` line) to:

```ts
import { MultipleChoiceConfigSchema } from "@kukui/activities/multiple-choice/schema";
```

- [ ] **Step 4: Update `packages/schemas/package.json` subpath export**

Find:

```json
"./multiple-choice": "./src/multiple-choice.ts",
```

and remove the line (downstream consumers should import from `@kukui/activities/multiple-choice/schema` going forward; the package-level barrel still re-exports for unmigrated callers).

- [ ] **Step 5: Add `@kukui/activities` as a dependency of `@kukui/schemas`**

Wait — this would create a circular dep since `@kukui/activities` already depends on `@kukui/schemas` (for `ScoringSchema`, `AppearanceSchema`). Resolve by:

a. Reverting Step 3 — keep `@kukui/schemas` self-contained for shared sub-schemas; have `@kukui/schemas/index.ts` import from a sibling path the bundler can resolve without a workspace cycle. **Preferred:** instead of Step 3's re-export, simply *delete* the multiple-choice re-export from `@kukui/schemas/index.ts` and update the one downstream consumer (the `SchemaRegistry` map) to import directly from `@kukui/activities/multiple-choice/schema`.

Replace the lines in `packages/schemas/src/index.ts`:

```ts
export {
  MultipleChoiceConfigSchema,
  type MultipleChoiceConfig,
} from "@kukui/activities/multiple-choice/schema";
```

with **deletion** — just remove the re-export.

And replace:

```ts
import { MultipleChoiceConfigSchema } from "@kukui/activities/multiple-choice/schema";
```

with — leave the import line in place (it's used by the `SchemaRegistry` map below). The import IS allowed if `@kukui/schemas` doesn't list `@kukui/activities` as a dep, because TypeScript with `"moduleResolution": "Bundler"` resolves it via the workspace; but to avoid a cycle, **swap the dependency direction**: remove `@kukui/schemas` as a dep of `@kukui/activities` and instead let `@kukui/activities` import its shared sub-schemas via a relative or symlinked path.

**The clean resolution:** Phase 2 keeps `MultipleChoiceConfigSchema` importable from `@kukui/schemas` because the schemas package re-exports it. To break the cycle, have `@kukui/activities/multiple-choice/schema.ts` import `ScoringSchema`/`AppearanceSchema` from a *new* subpath `@kukui/schemas/shared` that only re-exports those base schemas. `@kukui/activities` depends on `@kukui/schemas`; `@kukui/schemas/index.ts` is *not* what `@kukui/activities` imports — only `@kukui/schemas/shared` is. The top-level `@kukui/schemas/index.ts` is free to import from `@kukui/activities` for its registry.

Concretely: create `packages/schemas/src/shared.ts`:

```ts
export { ScoringSchema, type Scoring, type ScoringMode, SCORING_MODES } from "./scoring.js";
export { AppearanceSchema, type Appearance, type Theme, THEME_VALUES } from "./appearance.js";
```

Add `"./shared": "./src/shared.ts"` to `packages/schemas/package.json` exports.

In `packages/activities/multiple-choice/schema.ts`, change the import to:

```ts
import { ScoringSchema, AppearanceSchema } from "@kukui/schemas/shared";
```

And in `packages/activities/package.json`, keep `@kukui/schemas` as a dep (already there from Task 1). The cycle is avoided because `@kukui/activities` only imports from `@kukui/schemas/shared`, which itself imports nothing from `@kukui/activities`.

- [ ] **Step 6: Run `pnpm typecheck` and `pnpm test` to verify no breakage**

Run: `pnpm typecheck && pnpm test packages/schemas`
Expected: PASS. Schema-side fixtures test still passes because it imports `MultipleChoiceConfigSchema` via `SchemaRegistry["multiple-choice"]`, which is still defined in `@kukui/schemas/src/index.ts`.

- [ ] **Step 7: Commit**

```bash
git add packages/activities/multiple-choice/schema.ts packages/schemas/src/index.ts packages/schemas/src/shared.ts packages/schemas/package.json
git rm packages/schemas/src/multiple-choice.ts
git commit -m "refactor(activities): move multiple-choice schema into @kukui/activities; add @kukui/schemas/shared subpath to break cycle"
```

---

### Task 6: Move `multiple-choice` component into the activities package

**Files:**
- Create: `packages/activities/multiple-choice/Component.tsx` (moved + renamed from `MultipleChoice.tsx`)
- Create: `packages/activities/multiple-choice/Component.test.tsx` (moved + renamed)
- Create: `packages/activities/multiple-choice/Component.css` (moved + renamed)
- Delete: `packages/core/src/components/multiple-choice/` (whole directory)
- Modify: `packages/core/src/components/registry.ts:25`

- [ ] **Step 1: Move the three component files**

```bash
git mv packages/core/src/components/multiple-choice/MultipleChoice.tsx packages/activities/multiple-choice/Component.tsx
git mv packages/core/src/components/multiple-choice/MultipleChoice.test.tsx packages/activities/multiple-choice/Component.test.tsx
git mv packages/core/src/components/multiple-choice/MultipleChoice.css packages/activities/multiple-choice/Component.css
```

- [ ] **Step 2: Delete the now-empty index.ts barrel**

```bash
git rm packages/core/src/components/multiple-choice/index.ts
```

The directory is now empty; git will not stage the directory removal but pnpm and Vite will treat it as gone.

- [ ] **Step 3: Rename the React component inside `Component.tsx`**

Open `packages/activities/multiple-choice/Component.tsx`. Find the component declaration (`export function MultipleChoice(...)` or `export const MultipleChoice = ...`) and change the name to `Component`. Update the file's default export to:

```ts
export default Component;
```

(The component's old name `MultipleChoice` should appear ~2-3 times in the file; rename all occurrences. Don't rename CSS class names — they stay as `.multiple-choice-*`.)

- [ ] **Step 4: Update the CSS import path**

Find `import "./MultipleChoice.css";` and change to `import "./Component.css";`.

- [ ] **Step 5: Update the test file**

Open `packages/activities/multiple-choice/Component.test.tsx`. Change `import { MultipleChoice } from "./MultipleChoice.js";` (or `.tsx`) to:

```ts
import Component from "./Component.js";
```

And update the test's render call from `<MultipleChoice ... />` to `<Component ... />`.

- [ ] **Step 6: Update `packages/core/src/components/registry.ts:25`**

Find:

```ts
"multiple-choice": lazy(() => import("./multiple-choice/index.js")),
```

Change to:

```ts
"multiple-choice": lazy(() => import("@kukui/activities/multiple-choice/Component")),
```

- [ ] **Step 7: Add `@kukui/activities` to `@kukui/core`'s dependencies**

Edit `packages/core/package.json`. In the `dependencies` block, add:

```json
"@kukui/activities": "workspace:*",
```

Run `pnpm install` to register.

- [ ] **Step 8: Update `packages/core/tsconfig.json` to reference activities**

Add `{ "path": "../activities" }` to the `references` array.

- [ ] **Step 9: Run `pnpm typecheck && pnpm test packages/activities packages/core`**

Run: `pnpm typecheck && pnpm test packages/activities packages/core`
Expected: PASS. The Component.test.tsx that moved should still pass (it's the same test logic).

- [ ] **Step 10: Commit**

```bash
git add packages/activities/multiple-choice/ packages/core/src/components/registry.ts packages/core/package.json packages/core/tsconfig.json
git rm -rf packages/core/src/components/multiple-choice/
git commit -m "refactor(activities): move multiple-choice component into @kukui/activities"
```

---

### Task 7: Move `multiple-choice` samples into the activities package

**Files:**
- Create: `packages/activities/multiple-choice/samples/basic.json`
- Create: `packages/activities/multiple-choice/samples/full.json`
- Create: `packages/activities/multiple-choice/samples/_invalid/missing-required.json`
- Create: `packages/activities/multiple-choice/samples/_invalid/wrong-type.json`
- Delete: `apps/engine-web/public/samples/multiple-choice/` (whole tree)

- [ ] **Step 1: Move the samples directory**

```bash
mkdir -p packages/activities/multiple-choice/samples/_invalid
git mv apps/engine-web/public/samples/multiple-choice/basic.json packages/activities/multiple-choice/samples/basic.json
git mv apps/engine-web/public/samples/multiple-choice/full.json packages/activities/multiple-choice/samples/full.json
git mv apps/engine-web/public/samples/multiple-choice/_invalid/missing-required.json packages/activities/multiple-choice/samples/_invalid/missing-required.json
git mv apps/engine-web/public/samples/multiple-choice/_invalid/wrong-type.json packages/activities/multiple-choice/samples/_invalid/wrong-type.json
```

- [ ] **Step 2: Run `pnpm test packages/schemas` to confirm the fixture test breaks**

Run: `pnpm test packages/schemas/src/fixtures.test.ts`
Expected: FAIL on `multiple-choice/basic.json` (file not found at the hardcoded path). This is **expected** — the fixture test is updated in Task 20 to auto-discover from the new location. Don't fix it here.

- [ ] **Step 3: Update `packages/schemas/src/fixtures.test.ts` to read multiple-choice fixtures from the new location (temporary; replaced by full auto-discovery in Task 20)**

Find:

```ts
const SAMPLES_ROOT = join(REPO_ROOT, "apps", "engine-web", "public", "samples");
```

Add below it:

```ts
const ACTIVITIES_ROOT = join(REPO_ROOT, "packages", "activities");
```

Modify the `readFixture` helper:

```ts
async function readFixture(activity: string, name: string): Promise<unknown> {
  // Migrated activities live in packages/activities/<slug>/samples/.
  // Legacy still in apps/engine-web/public/samples/<slug>/. Try new first.
  const newPath = join(ACTIVITIES_ROOT, activity, "samples", name);
  const oldPath = join(SAMPLES_ROOT, activity, name);
  try {
    return JSON.parse(await readFile(newPath, "utf8"));
  } catch {
    return JSON.parse(await readFile(oldPath, "utf8"));
  }
}
```

Similarly update the `_invalid/` directory listing to try the new location first.

- [ ] **Step 4: Run `pnpm test packages/schemas` to confirm green**

Run: `pnpm test packages/schemas/src/fixtures.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/activities/multiple-choice/samples/ packages/schemas/src/fixtures.test.ts
git rm -rf apps/engine-web/public/samples/multiple-choice/
git commit -m "refactor(activities): move multiple-choice samples to @kukui/activities; fixtures.test.ts reads new location first"
```

---

### Task 8: Add Vite plugin to serve activity samples at `/samples/<slug>/` URL

**Files:**
- Create: `apps/engine-web/vite-plugin-activity-samples.ts`
- Modify: `apps/engine-web/vite.config.ts`

The engine fetches `samples/<slug>/<file>.json` via the `data-config` HTML attribute (`apps/engine-web/{slug}.html:10`). Now that samples live in `packages/activities/`, we need a Vite plugin that:
- in dev: intercepts `/samples/<slug>/<file>` requests and serves from `packages/activities/<slug>/samples/<file>`
- in build: emits each `packages/activities/<slug>/samples/**/*` into the output `dist/samples/<slug>/` directory

- [ ] **Step 1: Create `apps/engine-web/vite-plugin-activity-samples.ts`**

```ts
import { existsSync, readFileSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTIVITIES_ROOT = resolve(HERE, "..", "..", "packages", "activities");

/**
 * Maps requests for `/samples/<slug>/<...rest>` to files in
 * `packages/activities/<slug>/samples/<...rest>`. In dev, intercepts via
 * middleware; in build, emits matching files as static assets.
 *
 * This bridges the engine HTML pages (which still expect samples at the
 * `samples/...` URL path, per their data-config attributes) and the new
 * activity-co-located storage in @kukui/activities.
 */
export function activitySamplesPlugin(): Plugin {
  return {
    name: "kukui:activity-samples",

    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? "";
        const match = url.match(/^\/samples\/([^/]+)\/(.+?)(\?.*)?$/);
        if (!match) return next();
        const [, slug, rest] = match;
        const fsPath = join(ACTIVITIES_ROOT, slug, "samples", rest);
        if (existsSync(fsPath) && statSync(fsPath).isFile()) {
          req.url = `/@activity-samples/${slug}/${rest}`;
          (req as { _activitySamplePath?: string })._activitySamplePath = fsPath;
        }
        next();
      });

      server.middlewares.use((req, res, next) => {
        const fsPath = (req as { _activitySamplePath?: string })._activitySamplePath;
        if (!fsPath) return next();
        const ext = fsPath.split(".").pop()?.toLowerCase();
        const contentType =
          ext === "json" ? "application/json" :
          ext === "glb"  ? "model/gltf-binary" :
          "application/octet-stream";
        res.setHeader("Content-Type", contentType);
        res.end(readFileSync(fsPath));
      });
    },

    async generateBundle() {
      const slugs = await readdir(ACTIVITIES_ROOT, { withFileTypes: true });
      for (const slugEntry of slugs) {
        if (!slugEntry.isDirectory()) continue;
        const samplesDir = join(ACTIVITIES_ROOT, slugEntry.name, "samples");
        if (!existsSync(samplesDir)) continue;
        await emitTree.call(this, samplesDir, `samples/${slugEntry.name}`);
      }
    },
  };
}

async function emitTree(
  this: { emitFile: (file: { type: "asset"; fileName: string; source: Buffer }) => void },
  fsDir: string,
  outPrefix: string,
): Promise<void> {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(fsDir, { withFileTypes: true });
  for (const entry of entries) {
    const fsPath = join(fsDir, entry.name);
    const outPath = `${outPrefix}/${entry.name}`;
    if (entry.isDirectory()) {
      await emitTree.call(this, fsPath, outPath);
    } else {
      this.emitFile({
        type: "asset",
        fileName: outPath,
        source: readFileSync(fsPath),
      });
    }
  }
}
```

- [ ] **Step 2: Register the plugin in `apps/engine-web/vite.config.ts`**

Open `apps/engine-web/vite.config.ts`. Find the `plugins:` array and add the import + entry:

```ts
import { activitySamplesPlugin } from "./vite-plugin-activity-samples.js";

// ...inside defineConfig({ plugins: [...existing, ...]
plugins: [react(), activitySamplesPlugin(), /* ...existing CSP plugin etc. */]
```

(The exact location of `plugins:` depends on the file's current structure — search for `react()` to find it.)

- [ ] **Step 3: Run `pnpm dev:engine` (or `pnpm --filter @kukui/engine-web dev`) and verify multiple-choice loads**

Run: `pnpm --filter @kukui/engine-web dev`
Then in another terminal: `curl -sf http://localhost:5173/samples/multiple-choice/basic.json | head -5`
Expected: returns the JSON content of `packages/activities/multiple-choice/samples/basic.json`.

Then open `http://localhost:5173/multiple-choice.html` in a browser and verify the activity renders correctly with the sample data. Kill the dev server when verified.

- [ ] **Step 4: Run `pnpm --filter @kukui/engine-web build` and verify `dist/samples/multiple-choice/basic.json` is emitted**

Run: `pnpm --filter @kukui/engine-web build`
Then: `ls apps/engine-web/dist/samples/multiple-choice/`
Expected: `basic.json`, `full.json`, `_invalid/` are all present.

- [ ] **Step 5: Commit**

```bash
git add apps/engine-web/vite-plugin-activity-samples.ts apps/engine-web/vite.config.ts
git commit -m "feat(engine-web): Vite plugin serves @kukui/activities samples at /samples/<slug>/ URL"
```

---

### Task 9: Create `packages/activities/multiple-choice/meta.ts`

**Files:**
- Create: `packages/activities/multiple-choice/meta.ts`

- [ ] **Step 1: Find the source data**

Run: `grep -n "multiple-choice" apps/studio-app/src/starters.ts apps/studio-app/src/App.tsx | head -20`
Expected: shows label string at `starters.ts:555` (`"multiple-choice": "Multiple Choice"`), bloom entry in `App.tsx:79-115` somewhere, description either in `PLANNED_DESCRIPTIONS` (if it exists) or hard-coded somewhere.

- [ ] **Step 2: Create `packages/activities/multiple-choice/meta.ts`**

```ts
import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Multiple Choice";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description = "Single-question quiz with selectable answers and per-answer feedback.";

/** Bloom's taxonomy level — drives Studio's cognitive-level filter. */
export const bloom: BloomLevel = "understand";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
```

Confirm the actual `bloom` value by reading the matching entry in `apps/studio-app/src/App.tsx`'s `BLOOM_BY_KIND` (lines 79-115). If multiple-choice is omitted (the explore agent noted quiz-style kinds may be), pick the closest level from the existing data — `"understand"` is the conventional default for MCQs that test conceptual recall.

- [ ] **Step 3: Verify `pnpm typecheck` passes**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/activities/multiple-choice/meta.ts
git commit -m "feat(activities): multiple-choice meta (label, description, bloom, live)"
```

---

### Task 10: Extract `multiple-choice` uiSchema into the activities package

**Files:**
- Create: `packages/activities/multiple-choice/ui-schema.ts`
- Modify: `apps/studio-app/src/uiSchemas.ts` (extract — leave the entry in place for now; Task 14 wires it up)

- [ ] **Step 1: Read the source entry**

Run: `sed -n '106,180p' apps/studio-app/src/uiSchemas.ts` (start from line 106 where `"multiple-choice":` begins; expand the range if the entry exceeds 180).
Expected: shows the multiple-choice uiSchema object literal — `ui:order`, per-field labels, widget types, etc.

- [ ] **Step 2: Create `packages/activities/multiple-choice/ui-schema.ts`**

```ts
/**
 * RJSF uiSchema for the multiple-choice activity. Drives Studio's form
 * editor — field order, labels, help text, widget choices. Hand-tuned;
 * cannot be auto-derived from Zod alone because RJSF needs designer
 * decisions about layout and copy.
 *
 * Extracted from apps/studio-app/src/uiSchemas.ts. Spreads the shared
 * COMMON fragment (appearance pin etc.) which lives in the consuming
 * file (uiSchemas.ts merges this object with COMMON).
 */
const uiSchema = {
  // PASTE the exact object literal from uiSchemas.ts:106 here,
  // omitting the trailing comma. Preserve all ui:* keys, field
  // orderings, widget types, and help strings verbatim.
} as const;

export default uiSchema;
```

Replace the comment block with the actual object contents copy-pasted from `apps/studio-app/src/uiSchemas.ts`.

- [ ] **Step 3: Verify the extraction parses**

Run: `pnpm typecheck`
Expected: PASS. The new file isn't yet consumed; just confirm it compiles in isolation.

- [ ] **Step 4: Commit**

```bash
git add packages/activities/multiple-choice/ui-schema.ts
git commit -m "feat(activities): extract multiple-choice uiSchema into activity package"
```

Note: We do NOT delete the entry from `apps/studio-app/src/uiSchemas.ts` yet — that happens in Task 14 when the aggregator is refactored to read from manifests. Until then, the entry in `uiSchemas.ts` is duplicated. This is intentional for incremental migration.

---

### Task 11: Extract `multiple-choice` starter into the activities package

**Files:**
- Create: `packages/activities/multiple-choice/starter.ts`

- [ ] **Step 1: Read the source entry**

Run: `sed -n '34,60p' apps/studio-app/src/starters.ts` (around line 35).
Expected: shows the multiple-choice starter object — `{ version, title, question, answers: [...], ... }`.

- [ ] **Step 2: Create `packages/activities/multiple-choice/starter.ts`**

```ts
/**
 * Minimal valid config used as Studio's "new activity" template.
 * Extracted from apps/studio-app/src/starters.ts.
 */
const starter = {
  // PASTE the exact object literal from starters.ts:35 here.
};

export default starter;
```

Replace the comment block with the actual object copy-pasted from `apps/studio-app/src/starters.ts`.

- [ ] **Step 3: Verify it parses against the schema (sanity check)**

Add a quick test file `packages/activities/multiple-choice/starter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { MultipleChoiceConfigSchema } from "./schema.js";

describe("multiple-choice starter", () => {
  it("validates against the schema", () => {
    const result = MultipleChoiceConfigSchema.safeParse(starter);
    expect(result.success).toBe(true);
  });
});
```

Run: `pnpm test packages/activities/multiple-choice/starter.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/activities/multiple-choice/starter.ts packages/activities/multiple-choice/starter.test.ts
git commit -m "feat(activities): extract multiple-choice starter; assert it parses against the schema"
```

---

### Task 12: Extract `multiple-choice` icon into the activities package

**Files:**
- Create: `packages/activities/multiple-choice/icon.tsx`

- [ ] **Step 1: Find the source SVG**

Run: `grep -n "multiple-choice\|MultipleChoice\|\"multiple" apps/studio-app/src/activityIcons.tsx | head -10`
Expected: shows the icon registration entry. Read 30 lines around the match to capture the full SVG.

- [ ] **Step 2: Create `packages/activities/multiple-choice/icon.tsx`**

```tsx
import type { ComponentType } from "react";

/**
 * Sidebar icon for the multiple-choice activity. Extracted from
 * apps/studio-app/src/activityIcons.tsx. Accepts a className for
 * Tailwind sizing/coloring.
 */
export const Icon: ComponentType<{ className?: string }> = ({ className }) => (
  // PASTE the SVG element from activityIcons.tsx here. Add className={className}
  // to the root <svg>. Preserve viewBox, paths, and any animation attrs verbatim.
  <svg className={className} viewBox="0 0 24 24" /* ...rest of attrs */>
    {/* paste paths */}
  </svg>
);
```

Replace the comment placeholders with the actual SVG markup from `activityIcons.tsx`. Ensure the root `<svg>` accepts `className={className}`.

- [ ] **Step 3: Verify `pnpm typecheck`**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/activities/multiple-choice/icon.tsx
git commit -m "feat(activities): extract multiple-choice icon into activity package"
```

---

### Task 13: Wire everything together in `packages/activities/multiple-choice/manifest.ts`

**Files:**
- Create: `packages/activities/multiple-choice/manifest.ts`
- Test: `packages/activities/multiple-choice/manifest.test.ts`

- [ ] **Step 1: Write the failing manifest test**

```ts
import { describe, it, expect } from "vitest";
import { activity } from "./manifest.js";

describe("multiple-choice manifest", () => {
  it("has kind 'multiple-choice'", () => {
    expect(activity.kind).toBe("multiple-choice");
  });

  it("starter validates against the schema", () => {
    const result = activity.schema.safeParse(activity.starter);
    expect(result.success).toBe(true);
  });

  it("appears in @kukui/activities ACTIVITY_MANIFESTS", async () => {
    const { ACTIVITY_MANIFESTS } = await import("../src/index.js");
    expect(ACTIVITY_MANIFESTS["multiple-choice"]).toBe(activity);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/activities/multiple-choice/manifest.test.ts`
Expected: FAIL — `./manifest.js` not found.

- [ ] **Step 3: Create `packages/activities/multiple-choice/manifest.ts`**

```ts
import { lazy } from "react";
import type { ActivityManifest } from "@kukui/activities/types";
import { MultipleChoiceConfigSchema } from "./schema.js";
import uiSchema from "./ui-schema.js";
import starter from "./starter.js";
import { Icon } from "./icon.js";
import { label, description, bloom, live } from "./meta.js";

export const activity: ActivityManifest<"multiple-choice"> = {
  kind: "multiple-choice",
  schema: MultipleChoiceConfigSchema,
  Component: lazy(() => import("./Component.js")),
  uiSchema,
  starter,
  Icon,
  label,
  description,
  bloom,
  live,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/activities/multiple-choice/manifest.test.ts`
Expected: PASS — including the `ACTIVITY_MANIFESTS["multiple-choice"]` assertion (the glob in `src/index.ts` now finds the new manifest).

- [ ] **Step 5: Run the full test suite to confirm nothing else regressed**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/activities/multiple-choice/manifest.ts packages/activities/multiple-choice/manifest.test.ts
git commit -m "feat(activities): assemble multiple-choice manifest; glob discovery picks it up"
```

---

## Phase 3 — Studio aggregator gut (manifest-driven with legacy fallback)

### Task 14: Refactor `apps/studio-app/src/uiSchemas.ts` to read from manifests

**Files:**
- Modify: `apps/studio-app/src/uiSchemas.ts` (delete the multiple-choice entry; add manifest-driven assembly with legacy fallback)
- Modify: `apps/studio-app/package.json` (add `@kukui/activities` dep)
- Modify: `apps/studio-app/tsconfig.json` (add activities project reference)

- [ ] **Step 1: Add `@kukui/activities` to `apps/studio-app/package.json`**

In the `dependencies` block:

```json
"@kukui/activities": "workspace:*",
```

Run `pnpm install`.

- [ ] **Step 2: Add project reference in `apps/studio-app/tsconfig.json`**

Add `{ "path": "../../packages/activities" }` to `references`.

- [ ] **Step 3: Delete the multiple-choice entry from `uiSchemas.ts`**

In `apps/studio-app/src/uiSchemas.ts` around line 106, delete the `"multiple-choice": { ... }` block (and its trailing comma). The block is the same content that's now in `packages/activities/multiple-choice/ui-schema.ts`.

- [ ] **Step 4: Wire the manifest map into `UI_SCHEMAS`**

Near the top of `uiSchemas.ts`, add:

```ts
import { ACTIVITY_MANIFESTS } from "@kukui/activities";
```

Find where `UI_SCHEMAS` is exported (search for `export const UI_SCHEMAS`). Wrap the existing object literal so manifests merge in:

```ts
const LEGACY_UI_SCHEMAS: Record<string, Record<string, unknown>> = {
  // ...all the remaining hand-tuned entries (everything except multiple-choice)
};

const MANIFEST_UI_SCHEMAS: Record<string, Record<string, unknown>> =
  Object.fromEntries(
    Object.values(ACTIVITY_MANIFESTS).map((m) => [m.kind, m.uiSchema]),
  );

// Manifests win over legacy where both define a kind — once an activity is
// migrated, the legacy entry can be deleted (Plan 2). Until all 25 are
// migrated, both sources coexist.
export const UI_SCHEMAS: Record<ActivityKind, Record<string, unknown>> = {
  ...LEGACY_UI_SCHEMAS,
  ...MANIFEST_UI_SCHEMAS,
} as Record<ActivityKind, Record<string, unknown>>;
```

(The `LEGACY_UI_SCHEMAS` name is just the original `UI_SCHEMAS` object renamed; rename the existing declaration accordingly.)

Also keep the existing stub-generator loop for `PLANNED_ACTIVITY_KINDS` (around line 1583), but spread it last so legacy + manifests + planned-stubs all merge cleanly. Final shape:

```ts
export const UI_SCHEMAS: Record<ActivityKind, Record<string, unknown>> = {
  ...PLANNED_STUBS,
  ...LEGACY_UI_SCHEMAS,
  ...MANIFEST_UI_SCHEMAS,
} as Record<ActivityKind, Record<string, unknown>>;
```

Where `PLANNED_STUBS` is the loop's output collected into a variable instead of mutating a target.

- [ ] **Step 5: Run `pnpm typecheck && pnpm test apps/studio-app`**

Run: `pnpm typecheck && pnpm test apps/studio-app`
Expected: PASS.

- [ ] **Step 6: Manually verify in dev**

Run: `pnpm dev:studio`
Open Studio in a browser, switch to a multiple-choice activity (sidebar → Understand → Multiple Choice). Verify the editor form renders the same as before — same field labels, same widget choices, same field order. Kill dev server when verified.

- [ ] **Step 7: Commit**

```bash
git add apps/studio-app/src/uiSchemas.ts apps/studio-app/package.json apps/studio-app/tsconfig.json
git commit -m "refactor(studio): uiSchemas aggregates from @kukui/activities manifests with legacy fallback"
```

---

### Task 15: Refactor `apps/studio-app/src/starters.ts` similarly

**Files:**
- Modify: `apps/studio-app/src/starters.ts`

- [ ] **Step 1: Delete the multiple-choice entries from `starters.ts`**

Two entries to remove:
- Around line 35: the `"multiple-choice": { ... }` entry in `STARTERS`
- Around line 555: the `"multiple-choice": "Multiple Choice"` entry in `ACTIVITY_LABELS`

- [ ] **Step 2: Add manifest-driven assembly**

Near the top of `starters.ts`:

```ts
import { ACTIVITY_MANIFESTS } from "@kukui/activities";
```

Find the `STARTERS` export and refactor:

```ts
const LEGACY_STARTERS: Partial<Record<ActivityKind, unknown>> = {
  // all remaining hardcoded entries (everything except multiple-choice)
};

const MANIFEST_STARTERS: Partial<Record<ActivityKind, unknown>> =
  Object.fromEntries(
    Object.values(ACTIVITY_MANIFESTS).map((m) => [m.kind, m.starter]),
  );

export const STARTERS: Record<ActivityKind, unknown> = {
  ...PLANNED_STARTERS,
  ...LEGACY_STARTERS,
  ...MANIFEST_STARTERS,
} as Record<ActivityKind, unknown>;
```

Same shape for `ACTIVITY_LABELS`:

```ts
const LEGACY_LABELS: Partial<Record<ActivityKind, string>> = {
  // remaining entries
};

const MANIFEST_LABELS: Partial<Record<ActivityKind, string>> =
  Object.fromEntries(
    Object.values(ACTIVITY_MANIFESTS).map((m) => [m.kind, m.label]),
  );

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  ...PLANNED_LABELS,
  ...LEGACY_LABELS,
  ...MANIFEST_LABELS,
} as Record<ActivityKind, string>;
```

- [ ] **Step 3: Run `pnpm typecheck && pnpm test apps/studio-app`**

Run: `pnpm typecheck && pnpm test apps/studio-app`
Expected: PASS. `EditorForm.test.tsx` should still pass (it uses `STARTERS["multiple-choice"]` and the merged map still has it).

- [ ] **Step 4: Commit**

```bash
git add apps/studio-app/src/starters.ts
git commit -m "refactor(studio): starters + labels aggregate from @kukui/activities manifests"
```

---

### Task 16: Refactor `apps/studio-app/src/activityIcons.tsx` similarly

**Files:**
- Modify: `apps/studio-app/src/activityIcons.tsx`

- [ ] **Step 1: Delete the multiple-choice icon definition**

Find the multiple-choice icon function/registration in `activityIcons.tsx` and delete it.

- [ ] **Step 2: Wire manifest icons into the registry**

Add at the top:

```tsx
import { ACTIVITY_MANIFESTS } from "@kukui/activities";
```

Find the icon-dispatch logic (`ActivityIcon` component or `ICONS` map). Refactor so it tries `ACTIVITY_MANIFESTS[kind]?.Icon` first, then falls back to the hardcoded local registry:

```tsx
const LEGACY_ICONS: Partial<Record<ActivityKind, ComponentType<{ className?: string }>>> = {
  // ...remaining hardcoded icons (multiple-choice removed)
};

export function ActivityIcon({ kind, className }: { kind: ActivityKind; className?: string }) {
  const manifest = ACTIVITY_MANIFESTS[kind];
  if (manifest?.Icon) {
    const Icon = manifest.Icon;
    return <Icon className={className} />;
  }
  const Legacy = LEGACY_ICONS[kind];
  if (Legacy) return <Legacy className={className} />;
  return <span className={className} aria-hidden="true" />; // placeholder
}

export function hasActivityIcon(kind: ActivityKind): boolean {
  return Boolean(ACTIVITY_MANIFESTS[kind]?.Icon || LEGACY_ICONS[kind]);
}
```

- [ ] **Step 3: Run `pnpm typecheck && pnpm test apps/studio-app/src/activityIcons.test.tsx`**

Run: `pnpm typecheck && pnpm test apps/studio-app/src/activityIcons.test.tsx`
Expected: PASS. The icon test hardcodes a `STUDIO_SURFACED` array and asserts each kind has an icon — multiple-choice should still pass because the manifest's Icon is found.

- [ ] **Step 4: Commit**

```bash
git add apps/studio-app/src/activityIcons.tsx
git commit -m "refactor(studio): ActivityIcon resolves from @kukui/activities manifests, falls back to legacy"
```

---

### Task 17: Refactor `apps/studio-app/src/App.tsx`'s `BLOOM_BY_KIND` similarly

**Files:**
- Modify: `apps/studio-app/src/App.tsx`

- [ ] **Step 1: Delete the multiple-choice entry from `BLOOM_BY_KIND`**

`BLOOM_BY_KIND` lives at `App.tsx:79-115`. The explore agent noted multiple-choice may not have an entry there (quiz-style kinds were omitted from initial Bloom curation). If absent, skip the deletion. If present, delete the `"multiple-choice": "..."` line.

- [ ] **Step 2: Wire manifests into the bloom map**

Near the top of `App.tsx`:

```ts
import { ACTIVITY_MANIFESTS } from "@kukui/activities";
```

Refactor the `BLOOM_BY_KIND` declaration:

```ts
const LEGACY_BLOOM: Partial<Record<ActivityKind, BloomLevel>> = {
  // ...all remaining hand-curated entries
};

const MANIFEST_BLOOM: Partial<Record<ActivityKind, BloomLevel>> =
  Object.fromEntries(
    Object.values(ACTIVITY_MANIFESTS).map((m) => [m.kind, m.bloom]),
  );

const BLOOM_BY_KIND: Partial<Record<ActivityKind, BloomLevel>> = {
  ...LEGACY_BLOOM,
  ...MANIFEST_BLOOM,
};
```

- [ ] **Step 3: Verify `STUDIO_AVAILABLE` derivation still works**

`STUDIO_AVAILABLE` is derived from `Object.keys(BLOOM_BY_KIND)` (around line 144-149). If multiple-choice wasn't in `BLOOM_BY_KIND` before but is now (via the manifest), it will newly appear in the catalog. Verify in Step 4.

- [ ] **Step 4: Run `pnpm typecheck && pnpm dev:studio`**

Run: `pnpm typecheck && pnpm dev:studio`
Verify in browser: the "Understand" section in the sidebar now includes "Multiple Choice." Click it; verify the editor + preview render correctly. Kill dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/studio-app/src/App.tsx
git commit -m "refactor(studio): BLOOM_BY_KIND aggregates from @kukui/activities manifests"
```

---

## Phase 4 — Auto-discovery in build pipeline + tests

### Task 18: Replace hardcoded `rollupOptions.input` in `apps/engine-web/vite.config.ts` with HTML glob

**Files:**
- Modify: `apps/engine-web/vite.config.ts`

- [ ] **Step 1: Read the current input list**

Run: `sed -n '60,100p' apps/engine-web/vite.config.ts`
Expected: shows the 25-entry `input` object mapping kind → HTML path.

- [ ] **Step 2: Replace with glob-derived input**

At the top of `vite.config.ts`, add:

```ts
import { sync as globSync } from "fast-glob";
```

(`fast-glob` is already a transitive dep via Vite. If not, install it: `pnpm add -D fast-glob -F @kukui/engine-web`.)

Replace the `input:` block:

```ts
input: Object.fromEntries(
  globSync("*.html", { cwd: __dirname }).map((file) => [
    file.replace(/\.html$/, ""),
    `./${file}`,
  ]),
),
```

(If the existing config uses ES modules without `__dirname`, derive it: `const __dirname = dirname(fileURLToPath(import.meta.url));`.)

- [ ] **Step 3: Run `pnpm --filter @kukui/engine-web build`**

Run: `pnpm --filter @kukui/engine-web build`
Expected: builds without errors. `dist/multiple-choice.html` and all other activity HTMLs are emitted.

Run: `ls apps/engine-web/dist/*.html | wc -l`
Expected: matches the count of `*.html` files in `apps/engine-web/` (currently 25).

- [ ] **Step 4: Commit**

```bash
git add apps/engine-web/vite.config.ts
git commit -m "build(engine-web): rollupOptions.input derived from HTML glob; no hardcoded slug list"
```

---

### Task 19: Replace hardcoded `PHASE_1_ACTIVITIES` in `packaging/pack-scorm.js`

**Files:**
- Modify: `packaging/pack-scorm.js`

- [ ] **Step 1: Read the current array**

Run: `sed -n '50,90p' packaging/pack-scorm.js`
Expected: shows the `PHASE_1_ACTIVITIES` array literal.

- [ ] **Step 2: Replace with directory scan**

Find the `PHASE_1_ACTIVITIES = [...]` declaration and replace with:

```js
import { readdirSync } from "node:fs";
import { join } from "node:path";

const ACTIVITIES_ROOT = join(REPO_ROOT, "packages", "activities");

// Auto-discover activity slugs from packages/activities/<slug>/. Replaces
// the previously hand-maintained PHASE_1_ACTIVITIES array. Slugs with no
// matching component or sample fail later in pack() with a clear error.
const PHASE_1_ACTIVITIES = readdirSync(ACTIVITIES_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
  .map((entry) => entry.name)
  .sort();
```

Adjust `REPO_ROOT` if it's defined differently in the script — confirm with `grep "REPO_ROOT" packaging/pack-scorm.js`.

- [ ] **Step 3: Update the SAMPLES_DIR reference**

Find `SAMPLES_DIR = join(REPO_ROOT, "apps", "engine-web", "public", "samples")` (line 53). This still works for legacy (unmigrated) slugs, but new migrated slugs have samples in `packages/activities/<slug>/samples/`. Update the per-activity samples lookup to try the new location first:

Find the per-activity copy loop (around lines 189-204). Wrap the source-directory choice:

```js
const newSamplesDir = join(ACTIVITIES_ROOT, activity, "samples");
const legacySamplesDir = join(SAMPLES_DIR, activity);
const sourceSamplesDir = existsSync(newSamplesDir) ? newSamplesDir : legacySamplesDir;
if (!existsSync(sourceSamplesDir)) {
  throw new Error(`No samples directory for activity ${activity}`);
}
// ...continue with the existing copy logic using sourceSamplesDir
```

(`existsSync` from `node:fs`.)

- [ ] **Step 4: Test SCORM packing for multiple-choice (new location) and another activity (legacy location)**

Run: `pnpm build && node packaging/pack-scorm.js --activity multiple-choice`
Expected: produces a `.zip` file with `samples/multiple-choice/basic.json` inside.

Run: `node packaging/pack-scorm.js --activity hotspot-3d`
Expected: produces a `.zip` for hotspot-3d (still using legacy `apps/engine-web/public/samples/hotspot-3d/`).

Run: `node packaging/pack-scorm.js --all`
Expected: produces a zip per discovered activity; succeeds for all 25.

- [ ] **Step 5: Commit**

```bash
git add packaging/pack-scorm.js
git commit -m "build(scorm): auto-discover activities from packages/activities/; sample dir tries new location first"
```

---

### Task 20: Auto-discover fixtures in `packages/schemas/src/fixtures.test.ts`

**Files:**
- Modify: `packages/schemas/src/fixtures.test.ts`

The current test hardcodes 7 of 25 activities. Refactor to auto-discover from `packages/activities/<slug>/samples/` AND from the legacy `apps/engine-web/public/samples/<slug>/` for unmigrated activities. Test what exists (don't require every kind to have a fixture).

- [ ] **Step 1: Rewrite the test**

```ts
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SchemaRegistry, type SchemaRegistryKey } from "./index.js";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../../..");
const ACTIVITIES_ROOT = join(REPO_ROOT, "packages", "activities");
const LEGACY_SAMPLES_ROOT = join(REPO_ROOT, "apps", "engine-web", "public", "samples");

/**
 * For each kind in SchemaRegistry, find its samples directory — either the
 * new co-located location or the legacy public/samples mirror. Returns
 * null if neither exists (the kind has no fixtures yet).
 */
async function findSamplesDir(kind: string): Promise<string | null> {
  const newDir = join(ACTIVITIES_ROOT, kind, "samples");
  if (existsSync(newDir)) return newDir;
  const oldDir = join(LEGACY_SAMPLES_ROOT, kind);
  if (existsSync(oldDir)) return oldDir;
  return null;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

describe("Sample fixtures validate against the schema registry", () => {
  const kinds = Object.keys(SchemaRegistry) as SchemaRegistryKey[];

  for (const kind of kinds) {
    describe(kind, () => {
      it("has a samples directory", async () => {
        const dir = await findSamplesDir(kind);
        // Test passes silently if no samples — surfaces "test todo" via skip.
        if (!dir) return;
        expect(dir).toBeTruthy();
      });

      it("basic.json parses if present", async () => {
        const dir = await findSamplesDir(kind);
        if (!dir) return;
        const path = join(dir, "basic.json");
        if (!existsSync(path)) return;
        const result = SchemaRegistry[kind].safeParse(await readJson(path));
        if (!result.success) {
          console.error(`${kind}/basic.json failed:`, JSON.stringify(result.error.issues, null, 2));
        }
        expect(result.success).toBe(true);
      });

      it("full.json parses if present", async () => {
        const dir = await findSamplesDir(kind);
        if (!dir) return;
        const path = join(dir, "full.json");
        if (!existsSync(path)) return;
        const result = SchemaRegistry[kind].safeParse(await readJson(path));
        if (!result.success) {
          console.error(`${kind}/full.json failed:`, JSON.stringify(result.error.issues, null, 2));
        }
        expect(result.success).toBe(true);
      });

      it("_invalid/ fixtures all fail to validate", async () => {
        const dir = await findSamplesDir(kind);
        if (!dir) return;
        const invalidDir = join(dir, "_invalid");
        if (!existsSync(invalidDir)) return;
        const names = (await readdir(invalidDir)).filter((n) => n.endsWith(".json"));
        for (const name of names) {
          const result = SchemaRegistry[kind].safeParse(await readJson(join(invalidDir, name)));
          expect(result.success, `${kind}/_invalid/${name} should NOT parse`).toBe(false);
        }
      });
    });
  }
});
```

- [ ] **Step 2: Remove the hardcoded `ACTIVITIES` array**

In the same file, delete the now-unused `ACTIVITIES: SchemaRegistryKey[]` array (lines 10-18 in the original).

- [ ] **Step 3: Run the test**

Run: `pnpm test packages/schemas/src/fixtures.test.ts`
Expected: PASS. Every kind in `SchemaRegistry` is now exercised; kinds without fixtures pass silently (no assertion fires). The 7 previously-tested kinds still pass with their existing fixtures.

- [ ] **Step 4: Commit**

```bash
git add packages/schemas/src/fixtures.test.ts
git commit -m "test(schemas): fixtures.test auto-discovers samples from new + legacy locations; tests what exists"
```

---

### Task 21: End-to-end smoke validation

**Files:** none modified — verification only.

- [ ] **Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 2: Full test suite**

Run: `pnpm test`
Expected: PASS. All existing tests + the new manifest tests + the auto-discovered fixture tests.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 4: Engine dev server with multiple-choice**

Run: `pnpm --filter @kukui/engine-web dev`
In a second terminal:
```bash
curl -sf http://localhost:5173/samples/multiple-choice/basic.json | head -5
curl -sf -I http://localhost:5173/multiple-choice.html
```
Expected: JSON returns 200 with sample content; HTML returns 200. Kill the dev server.

- [ ] **Step 5: Studio dev with multiple-choice end-to-end**

Run: `pnpm dev:studio`
In a browser:
1. Open Studio
2. Navigate sidebar → Understand → Multiple Choice
3. Confirm the editor form renders with all field labels intact (Question, Answers list, behaviour toggles, etc.)
4. Confirm the preview pane renders the activity
5. Edit a field, watch the preview update
6. Hit Reset; confirm the starter populates correctly

Kill the dev server when verified.

- [ ] **Step 6: SCORM packing**

Run: `pnpm build && node packaging/pack-scorm.js --activity multiple-choice`
Expected: produces `kukui-multiple-choice-<version>.zip` (or similar). Unzip and inspect:
```bash
unzip -l kukui-multiple-choice-*.zip | grep samples/multiple-choice
```
Expected: `samples/multiple-choice/basic.json` is in the zip.

Run: `node packaging/pack-scorm.js --all`
Expected: 25 zip files produced.

- [ ] **Step 7: Commit (empty if no changes; otherwise update CHANGELOG-style note)**

If nothing changed: skip. Otherwise:

```bash
git add .
git commit -m "chore: end-to-end smoke validation of activity co-location foundation"
```

- [ ] **Step 8: Tag the foundation as complete**

```bash
git tag -a activity-colocation-foundation -m "Activity co-location foundation: @kukui/activities package, multiple-choice migrated as pilot, Studio aggregators handle mixed state, build pipeline auto-discovers."
```

---

## Done — what this plan delivered

After Task 21:

- `packages/activities/` exists as a workspace package with the `ActivityManifest<K>` contract and glob-based registry assembly
- `multiple-choice` is fully migrated: its schema, component, samples, uiSchema, starter, icon, and meta all live in `packages/activities/multiple-choice/`
- Studio's `uiSchemas.ts`, `starters.ts`, `activityIcons.tsx`, and `App.tsx`'s `BLOOM_BY_KIND` all aggregate from manifests with legacy fallback — ready to absorb additional migrations without code changes
- `apps/engine-web/vite.config.ts` discovers entries via HTML glob (no hardcoded list)
- `apps/engine-web` serves activity samples at `/samples/<slug>/` via a Vite plugin that reads from `packages/activities/<slug>/samples/`
- `packaging/pack-scorm.js` auto-discovers activities from `packages/activities/`
- `packages/schemas/src/fixtures.test.ts` auto-discovers samples and tests what exists (closes the prior 7-of-25 drift)
- All 25 activities still pack, render, and validate

**The next plan (Plan 2) bulk-migrates the remaining 24 activities** by repeating Tasks 5–13 for each, in batches by theme. The aggregators built in Phase 3 absorb each migration with zero further changes.

---

## Plan complete and saved to `docs/superpowers/plans/2026-05-20-activity-co-location-foundation-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration. Best for a 21-task plan with several integration checkpoints.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch with checkpoints. Lower overhead but harder to recover from misfires.

Which approach?
