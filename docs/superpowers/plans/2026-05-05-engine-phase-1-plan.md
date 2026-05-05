# Kukui Engine — Phase 1 implementation plan

**Date:** 2026-05-05
**Status:** Decisions locked; M0 scaffolding pending user go-ahead
**Spec:** [Kukui Platform — Activities, Authoring, Live](https://www.notion.so/357ee4627a7481c68ad9eb5b50628e4a) (Notion, canonical)

## Goal

Validate the JSON → Zod → React component → SCORM 1.2 → Lamakū round-trip with a single activity (Multiple Choice), then expand to all seven Phase 1 activities. The architecture this plan stands up is the foundation for Phase 2 (Studio) and Phase 3 (Live) — both are thin wrappers around the same `@kukui/core` package.

## Decisions taken (2026-05-05)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | DnD library | `@dnd-kit` | Lighter than `react-dnd`; ships keyboard + screen-reader UX out of the box. Used by Drag & Drop, Sequence, Categorization, Anatomy Labeling, Matching Pairs. |
| 2 | SCORM commit cadence | Commit on every meaningful interaction | Tab-close durability is worth the request count. D2L latency is fine for chatty commits. Shapes the `cmi.suspend_data` schema. |
| 3 | Score model | Per-activity-configurable, partial-credit default | Matches the schema-driven design. Locking in late means schema migrations. |
| 4 | Design token translation | Tailwind 4 `@theme` with CSS variables (not 1:1 USS port) | The design-system doc is canon, USS was the prior implementation. Tailwind idioms make Studio's preview pane easier later. |
| 5 | MC feedback UX | **Pattern A** — inline-below, space reserved from initial render, opacity-only fade, `prefers-reduced-motion` respected | Layout-stable rule (CLAUDE.md hard rule #3). Sets precedent for the other six activities. |
| 6 | 3D asset hosting | In-zip for MVP | Simpler, no CORS handshake. CDN possible later if zip sizes balloon past D2L upload limit. |

## Open decisions (need user input)

| # | Decision | Blocking | Options |
|---|---|---|---|
| 7 | Lamakū sandbox account access for M4 | M4 | (a) Use existing JABSOM sandbox account (need credentials); (b) Request new sandbox from UH ITS; (c) Mock the SCORM API in browser for M4 and defer real upload to M6. Recommend (a) if access exists. |
| 8 | `/kukui` slash command — copy now or after M5? | Optional | Copy now: useful for hand-authoring sample fixtures during M2–M5. Copy after M5: avoid maintaining two copies during heavy churn. Recommend copy now. |

## Milestones

### M0 — Monorepo scaffold *(~1 day)*

- `pnpm-workspace.yaml` + root `package.json`
- Strict `tsconfig.json` (root) + per-package extends
- Directory structure:
  ```
  packages/
    core/                  # types, scoring, content loader, SCORM wrapper
    schemas/               # Zod schemas, one per activity type
    bridge/                # kukui-bridge.js + .jslib (Phase 1.5)
  apps/
    engine-web/            # SCORM-built async player (Phase 1)
    studio-app/            # authoring GUI (Phase 2 — placeholder)
    live-mode/             # P2P realtime (Phase 3 — placeholder)
  packaging/
    pack-scorm.js          # adapted from ~/OME Projects/Packaging/
    templates/             # imsmanifest.xml + HTML wrapper
  docs/
    design-system.md       # mirrored from Unity ref
    research-foundations.md  (already committed)
    superpowers/plans/...  # this file
  ```
- ESLint flat config + Prettier
- Vitest 3 set up with one smoke test per package
- Playwright 1.5x install (config deferred to M6)
- Tailwind 4 set up in `apps/engine-web` with `@theme` tokens ported from `~/OME Projects/docs/design-system.md`

### M1 — Shared core *(~2 days)*

- `@kukui/core` types:
  ```ts
  type ScoreState = { raw: number; max: number; success: boolean; suspendData?: string };
  type ActivityProps<TConfig> = {
    config: TConfig;
    onSubmit: (s: ScoreState) => void;
    onResume?: () => Partial<TConfig>;
  };
  ```
- `@kukui/schemas`: port the seven Zod-translatable schemas from `~/OME Projects/docs/schemas/` (one `.ts` per activity type, each exporting `<Type>Config` + `<Type>ConfigSchema`)
- `@kukui/core/scoring`: partial credit, thresholds (pass/fail), Question Set aggregation
- `@kukui/core/content`: JSON fetcher + Zod validation; URL contract `?config=<url>` (relative path inside the SCORM zip; absolute URL also accepted for Studio preview)
- `@kukui/core/scorm`: pipwerks wrapper exposing `init() / get(key) / set(key, value) / commit() / terminate()`; helpers for `cmi.core.score.raw`, `cmi.suspend_data` (4 KB cap), `cmi.interactions[]`

### M2 — Vertical slice: Multiple Choice *(~2 days)*

- `MultipleChoice` component:
  - Layout-stable: feedback area always present at constant height (pattern A)
  - Selection / correct / incorrect states change color only, never border width
  - Tap targets ≥ 44 × 44 px
  - Color paired with text + icon for every state cue
  - `prefers-reduced-motion` respected on feedback fade
- `ActivityHost`: loads JSON from `?config=`, validates against schema registry, renders the matching activity component, wires `onSubmit` → scoring → SCORM commit
- Vite entry: `apps/engine-web/multiple-choice.html`
- Sample fixture: copy + adapt one from `~/OME Projects/samples/`
- Vitest:
  - schema validates good fixture, rejects bad fixture
  - scoring math (single-correct, multi-correct, partial credit)
  - ActivityHost happy path (load → render → submit → commit)
  - ActivityHost error paths (404, malformed JSON, schema-invalid JSON)

### M3 — SCORM packaging *(~1 day)*

- `pack-scorm.js`: takes built Vite output + sample JSON + metadata, emits a `.scorm.zip`
- `imsmanifest.xml` template (SCORM 1.2)
- HTML wrapper: discovers SCORM API up the window-frame chain, mounts `ActivityHost`
- npm script: `pnpm build:scorm multiple-choice` → `dist/multiple-choice.scorm.zip`
- Test the zip in [SCORM Cloud](https://cloud.scorm.com/) free tier as a pre-Lamakū smoke test

### M4 — Lamakū round-trip gate *(~0.5 day, blocking)*

- Upload `multiple-choice.scorm.zip` to the Lamakū sandbox course
- Open as a student; verify in browser devtools:
  - SCORM API discovered + `LMSInitialize` called
  - `LMSSetValue("cmi.core.score.raw", N)` on submit
  - `LMSSetValue("cmi.suspend_data", json)` on each interaction
  - `LMSCommit()` flushes
  - `LMSFinish()` on unload
- Verify grade appears in instructor's gradebook view
- Re-launch as same student; verify `cmi.suspend_data` is rehydrated and resumes prior state
- **Gate:** until this passes, M5 doesn't start

### M5 — Remaining 6 activities *(~1 week)*

In order, each ~1 day:
1. **Fill in the Blanks** — controlled inputs, normalization, multiple acceptable answers
2. **Drag and Drop** — `@dnd-kit` with keyboard fallback
3. **Course Presentation** — slide deck primitive; multiple slide types (text, image, embedded MC)
4. **Question Set** — composite; sequences other activity types and aggregates ScoreState
5. **3D Hotspot Identification** — react-three-fiber + drei, glTF model loader, hotspot spheres, raycaster
6. **Virtual Environment Tour** — r3f + first-person/orbit camera, point-of-interest markers

Each activity ships with: schema, component, fixture, Vitest unit tests, Vite entry, SCORM zip.

### M6 — Quality gate *(~3 days)*

- Playwright SCORM round-trip in headless Chrome + WebKit (Safari)
- `axe-core` in Vitest (component-level) and Playwright (full-page)
- Manual VoiceOver pass on all 7 (macOS Safari)
- `prefers-reduced-motion` verified to disable feedback fade everywhere
- Tap-target measurement at 320 px viewport (smallest target — iPhone SE)

### M7 — Phase 1.5: `kukui-bridge` *(~0.5 day)*

- Extract `@kukui/bridge` as a standalone ~100-line MIT library exposing:
  ```js
  window.kukuiBridge.OnActivityComplete(raw, max, success);
  window.kukuiBridge.SaveSuspendData(json);
  window.kukuiBridge.LoadSuspendData();
  window.kukuiBridge.GetUrlParam(key);
  ```
- `kukui-bridge.jslib` for Unity authors (drop into `Assets/Plugins/WebGL/`)
- `docs/third-party-integration.md` with Unity, Godot, Articulate examples
- `pack-scorm.js --engine [react|unity|godot|articulate|raw]` flag for varying build-output layouts
- One sample Unity integration (smallest possible — a button that posts a fixed score) to prove the path

### Total: ~3 weeks for Phase 1 + 1.5

## Quality gates that apply throughout

Per `kukui-web/CLAUDE.md` hard rules:

1. **Design system is canonical** — every hex, spacing, font size, border width must trace to `docs/design-system.md`
2. **Design system is canonical** — every hex, spacing, font size, border width must trace to `docs/design-system.md`. Add to the doc *before* using a new value.
3. **Layout-stable interactions** — state changes never reflow neighbors. Reserve space; change colors only. 2 px constant borders.
4. **Tap targets ≥ 44 × 44 px** (WCAG 2.5.5)
5. **Color is never the sole signal** — pair every cue with text, icon, or position
6. **WCAG 2.2 AA** — non-negotiable (Section 508 / state laws)

## Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Lamakū blocks SCORM API for cross-frame access | Low | Test in SCORM Cloud first (M3); pipwerks handles common frame-chain quirks |
| SCORM 1.2's 4 KB `suspend_data` cap is too small for some activities (Course Presentation, Question Set) | Medium | Compress JSON before write (LZ-string ~50% shrink). Falling back to per-interaction `cmi.interactions[]` if compression isn't enough. |
| `@dnd-kit` doesn't cover the 3D hotspot drag pattern | Low | 3D Hotspot uses raycaster, not DnD — orthogonal. |
| iOS Safari's WebGL2 + glTF performance on entry-level iPad | Medium | Constrain glTF poly count; provide low-poly fallback in the schema. |
| Lamakū sandbox access not available before M4 | Open | Decision #7 above. |

## References

- Notion spec (canonical): https://www.notion.so/357ee4627a7481c68ad9eb5b50628e4a
- Unity reference repo: `~/OME Projects/`
- JSON schemas to port: `~/OME Projects/docs/schemas/`
- Sample fixtures (28 JSONs): `~/OME Projects/samples/`
- Design system: `~/OME Projects/docs/design-system.md`
- Lessons learned (Unity gotchas): `~/OME Projects/docs/lessons-learned/uss-and-ui-toolkit-runtime.md`
- `/kukui` authoring command: `~/OME Projects/.claude/commands/kukui.md`
- SCORM tooling: `~/OME Projects/Packaging/`
- pipwerks SCORM API: https://github.com/pipwerks/scorm-api-wrapper
- Research foundations: [`docs/research-foundations.md`](../../research-foundations.md)
