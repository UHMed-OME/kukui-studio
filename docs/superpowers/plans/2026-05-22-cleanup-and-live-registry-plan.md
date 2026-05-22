# Cleanup + Live Registry Implementation Plan (Plan 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the transitional `LEGACY_*` scaffolding in Studio's aggregators (they're empty objects after Plan 2's bulk migration), replace the hand-maintained `SchemaRegistry` + `ACTIVITY_REGISTRY` literals with glob-derived assembly, refactor `LiveHost.tsx`'s if-chain dispatch into a barrel-driven registry within `apps/live-mode/src/activities/`, deduplicate the Studio-only `box.glb` files, and update the docs. After this plan ships, the repo's per-activity surface is fully cleaned up: each new activity is a single folder addition with zero edits to shared files.

**Architecture:** Aggregators become one-line `Object.fromEntries(...glob)` expressions. `SchemaRegistry` and `ACTIVITY_REGISTRY` join the same pattern. `LiveHost.tsx`'s if-chain becomes `LIVE_ACTIVITY_REGISTRY[kind]` lookup. A cross-reference test enforces that every manifest with `live: true` has a matching Live wrapper registered, and vice-versa.

**Tech Stack:** Same as Plans 1–2 — pnpm workspaces, TS project references, Vite 6 `import.meta.glob`, Vitest 3.

---

## File structure

**Modified:**
- `apps/studio-app/src/uiSchemas.ts` — drop `LEGACY_UI_SCHEMAS` (empty) and `PLANNED_STUBS` collection (still useful but inline it), export becomes a one-line manifest derivation
- `apps/studio-app/src/starters.ts` — drop `LEGACY_STARTERS`, `LEGACY_LABELS` (both empty); manifest derivation only
- `apps/studio-app/src/activityIcons.tsx` — drop `LEGACY_ICONS` (empty); manifest-only `ActivityIcon` + `hasActivityIcon`
- `apps/studio-app/src/App.tsx` — drop `LEGACY_BLOOM` (empty); manifest-only `BLOOM_BY_KIND`; preserve `STUDIO_SUPPRESSED` filter
- `packages/schemas/src/index.ts` — replace hand-written `SchemaRegistry` literal with glob-derived assembly from `@kukui/activities`
- `packages/core/src/components/registry.ts` — replace hand-written `ACTIVITY_REGISTRY` literal with glob-derived assembly
- `apps/live-mode/src/LiveHost.tsx:189-224` — replace if-chain dispatch with `LIVE_ACTIVITY_REGISTRY[kind]` lookup; drop the per-kind eager imports (replaced by barrel)
- `apps/live-mode/src/activities/{Slug}Live.tsx` × 6 — each adds `export const liveActivity = { kind, Component }`
- `apps/studio-app/src/starters.ts` (`STARTERS["hotspot-3d"]` / `STARTERS["virtual-tour"]`) — point `model.src` at the new canonical asset URL (resolved via the existing Vite plugin) instead of the Studio-private copy
- `apps/studio-app/public/samples/{hotspot-3d,virtual-tour}/` — delete (duplicates of `packages/activities/*/samples/box.glb`, served by the engine-side Vite plugin)
- `CLAUDE.md`, `AGENTS.md`, `docs/ux-design.md` — update "Where things live" sections to point at the new layout

**New:**
- `apps/live-mode/src/activities/index.ts` — barrel that uses `import.meta.glob` to assemble `LIVE_ACTIVITY_REGISTRY: Record<ActivityKind, LiveActivityManifest>` from `*Live.tsx` files in the same folder
- `apps/live-mode/src/activities/types.ts` — `LiveActivityManifest<K>` type (mirrors `ActivityManifest` shape but with eagerly-imported Component, no schema)
- `apps/live-mode/src/activities/registry.test.ts` — cross-reference test: every `@kukui/activities` manifest with `live: true` has a matching `LIVE_ACTIVITY_REGISTRY` entry, and vice-versa

**Deleted (after cleanup):**
- `apps/engine-web/public/samples/NOTICE.md` — relocate to `packages/activities/NOTICE.md` (or delete if the content is no longer relevant)
- `apps/studio-app/public/samples/` — entire directory, once `starters.ts` paths are updated

---

## Tier 1 — Studio aggregator simplification (4 tasks)

### Task 1: Collapse `apps/studio-app/src/uiSchemas.ts`

The file currently has three branches merged: `{ ...PLANNED_STUBS, ...LEGACY_UI_SCHEMAS, ...MANIFEST_UI_SCHEMAS }`. After Plan 2, `LEGACY_UI_SCHEMAS` is empty `{}` and `PLANNED_STUBS` is still useful (auto-stubs uiSchemas for `PLANNED_ACTIVITY_KINDS`, currently empty too). Collapse to the simplest functional form.

**Files:**
- Modify: `apps/studio-app/src/uiSchemas.ts`

- [ ] **Step 1:** Read the current file. Identify the `LEGACY_UI_SCHEMAS` const (should be `{}`), the `PLANNED_STUBS` collection (likely a `for` loop building from `PLANNED_ACTIVITY_KINDS`), and the final `UI_SCHEMAS` export.

- [ ] **Step 2:** Remove the `LEGACY_UI_SCHEMAS` declaration entirely.

- [ ] **Step 3:** Keep the `PLANNED_STUBS` collection (it's not empty in concept — it stays useful for the planned-kind extension point). Inline it as `Object.fromEntries(PLANNED_ACTIVITY_KINDS.map(kind => [kind, stubBody]))` if the existing for-loop is the only consumer.

- [ ] **Step 4:** Replace the final `UI_SCHEMAS` export with:
   ```ts
   const MANIFEST_UI_SCHEMAS: Partial<Record<ActivityKind, Record<string, unknown>>> =
     Object.fromEntries(
       Object.values(ACTIVITY_MANIFESTS).map((m) => [m.kind, m.uiSchema as Record<string, unknown>]),
     );

   export const UI_SCHEMAS: Record<ActivityKind, Record<string, unknown>> = {
     ...PLANNED_STUBS,
     ...MANIFEST_UI_SCHEMAS,
   } as Record<ActivityKind, Record<string, unknown>>;
   ```

- [ ] **Step 5:** Delete any helper consts (HIDDEN, TITLE, f(), COMMON, etc.) that were used ONLY by legacy entries. Keep any that are still referenced by `stubBody`. Run typecheck — TS's `noUnusedLocals` will identify dead code... actually no, `noUnusedLocals` is not set per Plan 2 audit. Search for each helper's usages with grep and delete the orphans manually.

- [ ] **Step 6:** Run `pnpm typecheck && pnpm test apps/studio-app`. Expected: PASS.

- [ ] **Step 7:** Commit:
   ```bash
   git add apps/studio-app/src/uiSchemas.ts
   git commit -m "refactor(studio): collapse uiSchemas to manifest-only (drop empty LEGACY scaffolding)"
   ```

---

### Task 2: Collapse `apps/studio-app/src/starters.ts`

**Files:**
- Modify: `apps/studio-app/src/starters.ts`

- [ ] **Step 1:** Read the file. Identify `LEGACY_STARTERS` (`{}`), `LEGACY_LABELS` (`{}`), `PLANNED_STARTERS` (keep — derived from `PLANNED_ACTIVITY_KINDS`), `MANIFEST_STARTERS`, `MANIFEST_LABELS`, and the final `STARTERS` + `ACTIVITY_LABELS` exports.

- [ ] **Step 2:** Remove `LEGACY_STARTERS` and `LEGACY_LABELS` declarations.

- [ ] **Step 3:** Simplify the final exports:
   ```ts
   export const STARTERS: Record<ActivityKind, unknown> = {
     ...PLANNED_STARTERS,
     ...MANIFEST_STARTERS,
   } as Record<ActivityKind, unknown>;

   export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
     ...PLANNED_LABELS,
     ...MANIFEST_LABELS,
   } as Record<ActivityKind, string>;
   ```

- [ ] **Step 4:** Preserve `ensureFreshKeys`, `LIVE_KIND_SET`, and `stubStarter` — these are still in use.

- [ ] **Step 5:** Verify: `pnpm typecheck && pnpm test apps/studio-app`. Expected: PASS.

- [ ] **Step 6:** Commit:
   ```bash
   git add apps/studio-app/src/starters.ts
   git commit -m "refactor(studio): collapse starters + labels to manifest-only"
   ```

---

### Task 3: Collapse `apps/studio-app/src/activityIcons.tsx`

**Files:**
- Modify: `apps/studio-app/src/activityIcons.tsx`

- [ ] **Step 1:** Read the file. `LEGACY_ICONS` is `{}`. The `ActivityIcon` function and `hasActivityIcon` helper currently consult both manifests and `LEGACY_ICONS`.

- [ ] **Step 2:** Remove `LEGACY_ICONS` and any related helper functions (like a deleted-stub `BaseProps` type) that are now unused.

- [ ] **Step 3:** Simplify `ActivityIcon`:
   ```tsx
   export function ActivityIcon({
     kind,
     className,
   }: { kind: ActivityKind; className?: string }) {
     const ManifestIcon = ACTIVITY_MANIFESTS[kind]?.Icon;
     if (ManifestIcon) return <ManifestIcon className={className} />;
     return <span className={className} aria-hidden="true" />;
   }

   export function hasActivityIcon(kind: ActivityKind): boolean {
     return Boolean(ACTIVITY_MANIFESTS[kind]?.Icon);
   }
   ```

- [ ] **Step 4:** Verify: `pnpm typecheck && pnpm test apps/studio-app/src/activityIcons.test.tsx`. Expected: PASS.

- [ ] **Step 5:** Commit:
   ```bash
   git add apps/studio-app/src/activityIcons.tsx
   git commit -m "refactor(studio): simplify ActivityIcon to manifest-only resolution"
   ```

---

### Task 4: Simplify `BLOOM_BY_KIND` in `apps/studio-app/src/App.tsx`

**Files:**
- Modify: `apps/studio-app/src/App.tsx`

- [ ] **Step 1:** Find the `BLOOM_BY_KIND` definition (around lines 79–150). It currently builds from `{ ...LEGACY_BLOOM, ...MANIFEST_BLOOM }` with `STUDIO_SUPPRESSED` filter applied.

- [ ] **Step 2:** Remove `LEGACY_BLOOM` (empty object).

- [ ] **Step 3:** Simplify to:
   ```ts
   const MANIFEST_BLOOM: Partial<Record<ActivityKind, BloomLevel>> =
     Object.fromEntries(
       Object.values(ACTIVITY_MANIFESTS).map((m) => [m.kind, m.bloom]),
     );

   const BLOOM_BY_KIND: Partial<Record<ActivityKind, BloomLevel>> = Object.fromEntries(
     Object.entries(MANIFEST_BLOOM).filter(
       ([kind]) => !STUDIO_SUPPRESSED.has(kind as ActivityKind),
     ),
   ) as Partial<Record<ActivityKind, BloomLevel>>;
   ```

- [ ] **Step 4:** Preserve `STUDIO_SUPPRESSED` exactly as is (still contains `multiple-choice`, `fill-in-the-blanks`, `question-set`).

- [ ] **Step 5:** Verify: `pnpm typecheck && pnpm test apps/studio-app/src/App.search.test.tsx`. Expected: PASS. Studio's catalog renders identically.

- [ ] **Step 6:** Commit:
   ```bash
   git add apps/studio-app/src/App.tsx
   git commit -m "refactor(studio): simplify BLOOM_BY_KIND to manifest+suppressed (drop empty LEGACY)"
   ```

---

## Tier 2 — Schema/component registry simplification (2 tasks)

### Task 5: Replace `SchemaRegistry` literal with glob-derived assembly

`packages/schemas/src/index.ts` currently has 30 hand-written entries in `SchemaRegistry` mapping each kind to its schema. Every entry's import comes from `@kukui/activities/<slug>/schema`. Replace with one-line glob.

**Files:**
- Modify: `packages/schemas/src/index.ts`

- [ ] **Step 1:** Read the file. It has ~30 named re-exports (e.g. `export { MultipleChoiceConfigSchema, ... } from "@kukui/activities/multiple-choice/schema";`), ~30 named imports (used by `SchemaRegistry`), the `SchemaRegistry` map, and `SchemaRegistryKey` type.

- [ ] **Step 2:** Decide what to keep:
   - **Keep** the named re-exports (consumers across the repo import these directly, e.g. `MultipleChoiceConfig` type used by Live wrappers) — DO NOT delete them
   - **Replace** the imports-then-registry pattern with a glob derivation
   - **Keep** `SchemaRegistryKey` type derivation

- [ ] **Step 3:** Replace the import block + `SchemaRegistry` literal with:
   ```ts
   import { ACTIVITY_MANIFESTS } from "@kukui/activities";

   /**
    * Map of activity-kind → Zod schema. Derived from the @kukui/activities
    * manifest registry. Single source of truth.
    */
   export const SchemaRegistry = Object.fromEntries(
     Object.values(ACTIVITY_MANIFESTS).map((m) => [m.kind, m.schema]),
   ) as Record<keyof typeof ACTIVITY_MANIFESTS extends never ? string : (typeof ACTIVITY_MANIFESTS)[keyof typeof ACTIVITY_MANIFESTS]["kind"], (typeof ACTIVITY_MANIFESTS)[keyof typeof ACTIVITY_MANIFESTS]["schema"]>;
   ```
   
   That conditional type is ugly; simpler version:
   ```ts
   import type { z } from "zod";
   import { ACTIVITY_MANIFESTS } from "@kukui/activities";

   export const SchemaRegistry: Record<string, z.ZodTypeAny> = Object.fromEntries(
     Object.values(ACTIVITY_MANIFESTS).map((m) => [m.kind, m.schema]),
   );

   export type SchemaRegistryKey = keyof typeof SchemaRegistry;
   ```
   
   Note: `SchemaRegistryKey` loses its literal-union narrowing here (becomes `string`). To preserve narrowing, instead:
   ```ts
   export const SchemaRegistry = ACTIVITY_MANIFESTS_SCHEMAS;
   export type SchemaRegistryKey = keyof typeof SchemaRegistry;
   ```
   where `ACTIVITY_MANIFESTS_SCHEMAS` is added as an export to `packages/activities/src/index.ts`:
   ```ts
   export const ACTIVITY_MANIFESTS_SCHEMAS = Object.fromEntries(
     Object.values(ACTIVITY_MANIFESTS).map((m) => [m.kind, m.schema] as const),
   ) as { [K in keyof typeof ACTIVITY_MANIFESTS]: (typeof ACTIVITY_MANIFESTS)[K]["schema"] };
   ```
   
   Pick whichever pattern gives the cleanest type signature without consumer break.

- [ ] **Step 4:** Verify: `pnpm typecheck && pnpm test --run`. Expected: PASS — all 30 fixtures still validate, all consumers still resolve their types.

- [ ] **Step 5:** Commit:
   ```bash
   git add packages/schemas/src/index.ts packages/activities/src/index.ts
   git commit -m "refactor(schemas): SchemaRegistry derived from @kukui/activities manifests (no more hand-list)"
   ```

---

### Task 6: Replace `ACTIVITY_REGISTRY` literal with glob-derived assembly

Similar to Task 5 — `packages/core/src/components/registry.ts` has 30 hand-written `lazy(() => import("@kukui/activities/<slug>/Component"))` entries.

**Files:**
- Modify: `packages/core/src/components/registry.ts`

- [ ] **Step 1:** Read the current file structure.

- [ ] **Step 2:** Add a `ACTIVITY_COMPONENTS` export to `packages/activities/src/index.ts` that exposes the lazy component map (derived from manifests):
   ```ts
   export const ACTIVITY_COMPONENTS = Object.fromEntries(
     Object.values(ACTIVITY_MANIFESTS).map((m) => [m.kind, m.Component] as const),
   ) as Record<string, ActivityManifest["Component"]>;
   ```

- [ ] **Step 3:** Replace `packages/core/src/components/registry.ts` with:
   ```ts
   import type { ComponentType, LazyExoticComponent } from "react";
   import type { BuiltActivityKind, ActivityProps } from "../types.js";
   import { lazy } from "react";
   import { ACTIVITY_COMPONENTS } from "@kukui/activities";

   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   export type ActivityComponent = LazyExoticComponent<ComponentType<ActivityProps<any>>>;

   export const ACTIVITY_REGISTRY: Record<BuiltActivityKind, ActivityComponent> =
     ACTIVITY_COMPONENTS as Record<BuiltActivityKind, ActivityComponent>;

   export const StubActivityLazy: ActivityComponent = lazy(
     () => import("./_stub/index.js"),
   );
   ```

- [ ] **Step 4:** Verify: `pnpm typecheck && pnpm test --run`. Expected: PASS.

- [ ] **Step 5:** Commit:
   ```bash
   git add packages/core/src/components/registry.ts packages/activities/src/index.ts
   git commit -m "refactor(core): ACTIVITY_REGISTRY derived from @kukui/activities (no more hand-list)"
   ```

---

## Tier 3 — Live registry refactor (4 tasks)

### Task 7: Add `liveActivity` export to each `*Live.tsx`

Each Live wrapper in `apps/live-mode/src/activities/` gets a small export so the barrel can collect them.

**Files:**
- Modify (each): `apps/live-mode/src/activities/StrawPollLive.tsx`, `ConfidenceMeterLive.tsx`, `WordCloudLive.tsx`, `QABoardLive.tsx`, `QuickQuizLive.tsx`, `IsometricChatroomLive.tsx`

- [ ] **Step 1:** Create `apps/live-mode/src/activities/types.ts`:
   ```ts
   import type { ComponentType } from "react";
   import type { ActivityKind } from "@kukui/core";

   export interface LiveActivityManifest<K extends ActivityKind = ActivityKind> {
     kind: K;
     Component: ComponentType<LiveActivityProps>;
   }

   export interface LiveActivityProps {
     // Reflects the shape currently passed to each *Live component in LiveHost.
     // Read LiveHost.tsx around the liveProps object to confirm.
     config: unknown;
     room: import("@kukui/live").LiveRoomHandle;
     presence: Map<string, import("@kukui/live").Presence>;
     role: "instructor" | "student";
   }
   ```

- [ ] **Step 2:** Per Live wrapper, add at the bottom of the file:
   ```ts
   import type { LiveActivityManifest } from "./types.js";
   export const liveActivity: LiveActivityManifest<"straw-poll"> = {
     kind: "straw-poll",
     Component: StrawPollLive,
   };
   ```
   (Substitute the appropriate kind + component reference per file.)

- [ ] **Step 3:** Run `pnpm typecheck`. Expected: PASS.

- [ ] **Step 4:** Commit (one commit, all six files):
   ```bash
   git add apps/live-mode/src/activities/
   git commit -m "feat(live-mode): export liveActivity manifest from each *Live wrapper"
   ```

---

### Task 8: Create `apps/live-mode/src/activities/index.ts` barrel

**Files:**
- Create: `apps/live-mode/src/activities/index.ts`

- [ ] **Step 1:** Write the barrel:
   ```ts
   import type { ActivityKind } from "@kukui/core";
   import type { LiveActivityManifest } from "./types.js";

   /**
    * Eagerly imports every per-activity Live manifest. Eager (not lazy) because
    * Live dispatch can't tolerate chunk-fetch latency in a real-time session —
    * matches the previous if-chain pattern in LiveHost.tsx that imported each
    * *Live component at the top of the file.
    */
   const modules = import.meta.glob<{ liveActivity: LiveActivityManifest }>(
     "./*Live.tsx",
     { eager: true },
   );

   export const LIVE_ACTIVITY_REGISTRY: Partial<Record<ActivityKind, LiveActivityManifest>> =
     Object.fromEntries(
       Object.values(modules)
         .filter((m): m is { liveActivity: LiveActivityManifest } => "liveActivity" in m)
         .map((m) => [m.liveActivity.kind, m.liveActivity]),
     );

   export function getLiveActivity(kind: ActivityKind): LiveActivityManifest | undefined {
     return LIVE_ACTIVITY_REGISTRY[kind];
   }
   ```

- [ ] **Step 2:** Run `pnpm typecheck`. Expected: PASS.

- [ ] **Step 3:** Commit:
   ```bash
   git add apps/live-mode/src/activities/index.ts apps/live-mode/src/activities/types.ts
   git commit -m "feat(live-mode): activities barrel auto-discovers Live wrappers via import.meta.glob"
   ```

---

### Task 9: Refactor `LiveHost.tsx` dispatch to use the barrel

**Files:**
- Modify: `apps/live-mode/src/LiveHost.tsx`

- [ ] **Step 1:** Remove the per-kind eager imports at lines 21–26:
   ```ts
   import { StrawPollLive } from "./activities/StrawPollLive.js";
   // ...etc
   ```

- [ ] **Step 2:** Add the barrel import:
   ```ts
   import { getLiveActivity } from "./activities/index.js";
   ```

- [ ] **Step 3:** Replace the if-chain dispatch (around lines 189–224). What it looks like:
   ```tsx
   if (kind === "straw-poll") {
     return <StrawPollLive {...liveProps} config={loadState.config as StrawPollConfig} />;
   }
   if (kind === "confidence-meter") {
     return <ConfidenceMeterLive {...liveProps} ... />;
   }
   // ...etc for 6 kinds
   ```
   
   Replace with:
   ```tsx
   const live = getLiveActivity(kind);
   if (live) {
     const LiveComponent = live.Component;
     return <LiveComponent {...liveProps} config={loadState.config} />;
   }
   // Fall-through: kind not registered as a Live activity. Show "no Live variant" message.
   ```
   
   (Preserve the existing fall-through behavior for non-Live kinds — read the surrounding code in LiveHost.tsx to see what it currently does after the if-chain.)

- [ ] **Step 4:** Remove the now-unused config-type imports from `@kukui/schemas` (lines 9–17 — `StrawPollConfig`, `ConfidenceMeterConfig`, etc.). The barrel approach passes `config: unknown` to each Live component, which already handles its own type narrowing.

- [ ] **Step 5:** Run `pnpm typecheck && pnpm test apps/live-mode`. Expected: PASS. The `LiveHost.test.tsx` should still pass — verify it doesn't rely on the if-chain shape.

- [ ] **Step 6:** Commit:
   ```bash
   git add apps/live-mode/src/LiveHost.tsx
   git commit -m "refactor(live-mode): LiveHost dispatch uses barrel registry instead of if-chain"
   ```

---

### Task 10: Add cross-reference test

**Files:**
- Create: `apps/live-mode/src/activities/registry.test.ts`

- [ ] **Step 1:** Write the test:
   ```ts
   import { describe, expect, it } from "vitest";
   import { ACTIVITY_MANIFESTS } from "@kukui/activities";
   import { LIVE_ACTIVITY_REGISTRY } from "./index.js";

   describe("Live activity registry", () => {
     it("every manifest with live=true has a matching Live wrapper", () => {
       const liveKinds = Object.values(ACTIVITY_MANIFESTS)
         .filter((m) => m.live)
         .map((m) => m.kind)
         .sort();
       const registeredKinds = Object.keys(LIVE_ACTIVITY_REGISTRY).sort();
       expect(registeredKinds).toEqual(liveKinds);
     });

     it("every Live wrapper has a manifest with live=true", () => {
       for (const kind of Object.keys(LIVE_ACTIVITY_REGISTRY)) {
         const manifest = ACTIVITY_MANIFESTS[kind];
         expect(manifest, `${kind} has Live wrapper but no manifest`).toBeDefined();
         expect(manifest!.live, `${kind} has Live wrapper but manifest.live is false`).toBe(true);
       }
     });
   });
   ```

- [ ] **Step 2:** Run the test:
   ```bash
   pnpm test apps/live-mode/src/activities/registry.test.ts
   ```
   Expected: PASS — the 6 live=true kinds all have registered wrappers.

- [ ] **Step 3:** Commit:
   ```bash
   git add apps/live-mode/src/activities/registry.test.ts
   git commit -m "test(live-mode): cross-reference manifest.live with LIVE_ACTIVITY_REGISTRY"
   ```

---

## Tier 4 — Asset deduplication + docs (3 tasks)

### Task 11: Deduplicate the Studio-only `box.glb` files

Studio has its own `apps/studio-app/public/samples/{hotspot-3d,virtual-tour}/box.glb` files. These are duplicates of the canonical assets at `packages/activities/{hotspot-3d,virtual-tour}/samples/box.glb`. Studio's `starters.ts` references the relative URL paths `samples/hotspot-3d/box.glb` and `samples/virtual-tour/box.glb` (resolved from Studio's own `public/`).

**Approach:** Move the Vite plugin pattern (engine-web has it; Studio doesn't) — OR change Studio's `starter.ts` references to use a build-time inline import.

**Files:**
- Create: `apps/studio-app/vite-plugin-activity-samples.ts` (mirror of engine-web's)
- Modify: `apps/studio-app/vite.config.ts` (register plugin)
- Delete: `apps/studio-app/public/samples/hotspot-3d/box.glb`, `apps/studio-app/public/samples/virtual-tour/box.glb`, plus empty directories

- [ ] **Step 1:** Copy `apps/engine-web/vite-plugin-activity-samples.ts` to `apps/studio-app/vite-plugin-activity-samples.ts`. Adjust the relative path resolution if needed (the constant `ACTIVITIES_ROOT = resolve(HERE, "..", "..", "packages", "activities")` may need a depth change — verify).

- [ ] **Step 2:** Register the plugin in `apps/studio-app/vite.config.ts` (same pattern as engine-web). Verify with:
   ```bash
   pnpm dev:studio &
   sleep 8
   curl -sf http://localhost:5174/samples/hotspot-3d/box.glb -o /dev/null -w "HTTP %{http_code}\n"
   kill %1; wait %1 2>/dev/null
   ```
   Expected: HTTP 200.

- [ ] **Step 3:** Confirm the starter references work end-to-end:
   ```bash
   pnpm --filter @kukui/studio-app build
   ls apps/studio-app/dist/samples/hotspot-3d/
   ```
   Expected: `box.glb` is emitted.

- [ ] **Step 4:** Delete the duplicated assets:
   ```bash
   git rm apps/studio-app/public/samples/hotspot-3d/box.glb
   git rm apps/studio-app/public/samples/virtual-tour/box.glb
   rmdir apps/studio-app/public/samples/hotspot-3d
   rmdir apps/studio-app/public/samples/virtual-tour
   rmdir apps/studio-app/public/samples
   ```

- [ ] **Step 5:** Commit:
   ```bash
   git add apps/studio-app/vite-plugin-activity-samples.ts apps/studio-app/vite.config.ts
   git commit -m "build(studio): serve activity samples via Vite plugin; deduplicate Studio-only box.glb copies"
   ```

---

### Task 12: Clean up engine-web NOTICE.md + update docs

**Files:**
- Move: `apps/engine-web/public/samples/NOTICE.md` → `packages/activities/NOTICE.md`
- Modify: `CLAUDE.md` (the "Where things live" section), `AGENTS.md` (the activity-authoring section), `docs/ux-design.md` if it references the old paths

- [ ] **Step 1:** Move NOTICE.md:
   ```bash
   git mv apps/engine-web/public/samples/NOTICE.md packages/activities/NOTICE.md
   rmdir apps/engine-web/public/samples
   ```

- [ ] **Step 2:** Update `CLAUDE.md`'s "Where things live" section. Read the current content and replace the activity-related entries with the new layout:
   ```
   - Activity manifests (schema, component, samples, uiSchema, starter, icon, meta): `packages/activities/{slug}/`
   - Activity sample fixtures: `packages/activities/{slug}/samples/` (served at `/samples/{slug}/` URL by both engine-web and studio-app Vite plugins)
   - Live activity variants: `apps/live-mode/src/activities/{Slug}Live.tsx` (auto-discovered by the local barrel registry)
   ```
   
   Remove any stale references to `packages/schemas/src/{slug}.ts`, `packages/core/src/components/{slug}/`, or `apps/engine-web/public/samples/{slug}/`.

- [ ] **Step 3:** Same updates to `AGENTS.md` if it has a similar section.

- [ ] **Step 4:** Same to `docs/ux-design.md` if it references the old layout.

- [ ] **Step 5:** Commit:
   ```bash
   git add CLAUDE.md AGENTS.md docs/ux-design.md packages/activities/NOTICE.md
   git commit -m "docs: update layout references for activity co-location"
   ```

---

### Task 13: End-to-end validation + audit

**Goal:** verify Plan 3 left the tree green and document the simplification gains.

- [ ] **Step 1:** Full typecheck:
   ```bash
   pnpm typecheck
   ```
   Expected: PASS.

- [ ] **Step 2:** Full test suite:
   ```bash
   pnpm test --run 2>&1 | tail -10
   ```
   Expected: PASS. Test count should grow by ~2 (the Live registry cross-reference test added in Task 10).

- [ ] **Step 3:** Full build:
   ```bash
   pnpm build 2>&1 | tail -10
   ```
   Expected: all three apps build.

- [ ] **Step 4:** SCORM packaging unchanged:
   ```bash
   node packaging/pack-scorm.js --all 2>&1 | tail -3
   ls packaging/build/kukui-*.zip | wc -l
   rm -f packaging/build/kukui-*.zip
   ```
   Expected: 25 zips.

- [ ] **Step 5:** Studio + engine dev sanity:
   ```bash
   pnpm dev:studio &
   PID=$!
   sleep 8
   curl -sf http://localhost:5174/samples/hotspot-3d/box.glb -o /dev/null -w "studio glb: HTTP %{http_code}\n"
   kill $PID; wait $PID 2>/dev/null
   ```
   Expected: HTTP 200 (verifies Task 11's Studio Vite plugin works).

- [ ] **Step 6:** Confirm working tree clean:
   ```bash
   git status --short
   ```
   Expected: same pre-existing untracked files only.

- [ ] **Step 7:** Tag:
   ```bash
   git tag -a plan-3-cleanup -m "Plan 3 complete: aggregators collapsed to manifest-only, Live registry barrel-driven, assets deduplicated, docs updated."
   ```

- [ ] **Step 8:** Dispatch a final code-reviewer subagent on commits `<plan-2-completion-sha>..HEAD` to surface any drift from this plan.

---

## What this plan does NOT do (deferred to Plan 4)

- Rewrite the `/kukui` slash command for the new layout — Plan 4's exclusive scope.
- Extract shared primitives (`ActivityProps`, `SafeHtml`, scoring utilities) from `@kukui/core` into a leaf package — known workspace dep cycle debt, intentionally not addressed (would require ~10 file moves across the activities package and is independent of the scaffold command).
- Backfill missing `basic.json` fixtures for the 5 kinds without samples (confidence-meter, word-cloud, qa-board, quick-quiz, isometric-chatroom) — non-blocking content work, not architectural.
- Fix the pre-existing `pnpm lint` breakage (missing `@eslint/js`) — unrelated infrastructure issue.

---

## Execution notes for the orchestrator

- Tier 1 tasks (1–4) are independent of each other. Could be parallelized, but per the skill, serial is safer (each touches a single file in Studio so file-conflict risk is zero, but commit-conflict still exists if two run at the same time).
- Tier 2 tasks (5–6) depend on Tier 1 being done (cleaner test surface).
- Tier 3 tasks (7–10) are independent of Tiers 1–2 (Live is a separate concern).
- Tier 4 tasks (11–12) are independent.
- Task 13 must run last.
- The `getLiveActivity` + barrel pattern in Task 8 is the same pattern as `getManifest` in `@kukui/activities/src/index.ts` — point implementers at that as a model.

---

## Plan complete and saved to `docs/superpowers/plans/2026-05-22-cleanup-and-live-registry-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks. Plan 3 is shorter (13 tasks) and the changes are well-scoped to single files, so reviews can be lighter (inline verification) for trivial tasks.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch with checkpoints.

Which approach?
