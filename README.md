# Kukui

> JSON-driven interactive learning activities for the LMS. SCORM-packaged, browser-hosted, no backend.

Kukui is an open-source toolkit for building, packaging, and shipping interactive learning activities to a Learning Management System. It started as a project for [University of Hawaiʻi John A. Burns School of Medicine](https://jabsom.hawaii.edu/)'s Brightspace instance ("Lamakū") and is released under the MIT license for any institution that wants to author their own.

The project name comes from the **kukui** nut — the candlenut Hawaiians traditionally burned in *lamakū* torches. Lamakū hosts the activities; Kukui *is* the activities.

## What's in the box

Three apps, one shared core:

| App | What it does |
|---|---|
| **Kukui Studio** | Browser-based authoring tool. Pick an activity type, fill in the form (or drop in JSON), preview live, download a SCORM 1.2 zip ready for D2L. No login, no backend — drafts auto-save to your browser. |
| **Kukui Engine** | The runtime that actually ships inside each SCORM zip. One self-contained bundle per activity type; loads its config JSON, renders the React component, reports the score back to the LMS via SCORM. |
| **Kukui Live** *(alpha)* | Real-time classroom mode using peer-to-peer WebRTC. Students join an instructor's session with a 6-digit code and synchronized state flows through a CRDT (Y.js). |

24 activity types ship today, grouped below.

## Activity catalog

Activities are organized by Bloom's revised taxonomy — what kind of thinking they exercise:

### Remember — recall facts and terminology
- **Flashcards** — Self-paced two-sided card deck with a spaced-style retry loop: cards the learner says they "didn't know" cycle back into the deck until mastered (cap of 2 retries by default). Self-rating is honor-system, so flashcards are graded as completion-only — finishing a run-through earns full credit, and a "Practice again" button lets learners reshuffle and run the deck as many times as they want without changing their grade.
- **Matching Pairs** — Click an item on the left, then its match on the right. Right column shuffles on load (configurable). On submit, wrong rows show "Correct match: X" so the learner sees the pairing.

### Understand — identify, explain, classify
- **Image Hotspot 2D** — Pick the correct region of an image. Single-correct (use Hotspot 3D's variant for spatial work). Includes a keyboard fallback list of named regions for AT users.
- **Anatomy Labeling** — Drag named labels to anchor points on a diagram. Each target accepts exactly one label; placing a different label displaces the previous one back to the tray. Per-label correctness shown on submit.
- **Highlight Text Spans** — Click words/phrases in a sentence; correct selections gain points, wrong ones lose them. After submit, dashed outlines appear on tokens the learner missed.

### Apply — use procedures in new contexts
- **Drag and Drop** — Drop labeled chips onto rectangles overlaid on a background image. Supports many-to-one (multiple chips on one zone) via per-chip `correctZones[]`. Visual editor in Studio + dnd-kit drag with a `<select>` keyboard fallback.
- **Sequence / Order Steps** — Arrange shuffled items in the correct order. Shuffle algorithm guarantees the start order isn't already correct. Partial credit per item-in-correct-position; reorder via mouse drag or keyboard arrows.
- **Categorization** — Sort items into named bins. No capacity limit per bin (vs. Drag and Drop). Items snap into bins; the keyboard fallback offers a `<select>` per item.
- **3D Hotspot Identification** — Same as 2D but on a 3D model (glTF/glb), rendered with react-three-fiber. Single-correct; falls back to a button list when WebGL is unavailable.
- **Virtual Environment Tour** — A 3D scene with clickable info overlays. Two completion modes: `manual` (Submit when ready) or `visitAll` (auto-completes when every required overlay has been visited).
- **Interactive Video** — A video player that pauses at author-chosen timestamps and overlays a sub-activity (multiple-choice or fill-in-the-blanks). Required interactions block completion until answered; if the learner skips past one, the player seeks back. HTML5 sources only in this release (YouTube/Vimeo planned).

### Analyze — break apart, compare, infer relationships
- **Image Annotation** — The learner draws on an image with rectangle, circle, arrow, or freehand tools. Optional `expectedAnnotations[]` lets authors set ground-truth regions; scoring uses Intersection-over-Union ≥ 0.5 per expected region.
- **Image Comparison Slider** — Before/after images with a draggable seam. Engagement-only scoring (completion = success). Full keyboard story via WAI-ARIA slider semantics.
- **Concept Map** — Free-form node + edge graph builder. Nodes drag to position; edges connect via an "edge mode." Optional `expected.nodes[]` and `expected.edges[]` enable scoring against a target map (undirected dedup). `allowFreeText` lets learners add nodes outside the seed set.
- **Lab Panel Interpretation** — A clinical lab values table where the learner flags abnormal results, then picks the best interpretation from a multiple-choice list. Combined `singlePoint` requires both perfect for credit.

### Evaluate — judge, critique, decide
- **Branching Scenario** — Choose-your-own-adventure walk through author-defined steps. Each step has a prompt and either choices (with `nextNodeId` pointing to the next step) or a terminal outcome with score/success/feedback. Idempotent submit on terminal nodes.
- **Differential Diagnosis Tree** — Like Branching Scenario but specialized for clinical reasoning: each step can `addsToCase[]` accumulating findings into a persistent case panel, and terminal nodes carry a diagnosis with correct/score.
- **Reflection Prompt** — Open-ended writing with optional minimum word count. Submission is success-only (not scored against an answer key); the act of reflecting is the activity.
- **OSCE Encounter** — A multi-phase clinical encounter (e.g. History → Examination → Closure). Each phase exposes actions the learner can perform; correct actions add points (configurable +/− anti-guess penalty). `expectedOrder` rewards performing phases in the right order.

### Create — produce original work
- **Audio Recording / Pronunciation** — Records mic audio in-browser via MediaRecorder. Optional reference audio plays alongside; `minSeconds`/`maxSeconds` enforce duration. Re-record allowed by default. *Pure completion scoring* — the audio itself isn't auto-evaluated.

### Quiz primitives (used inside other activities; not in Studio's catalog)
**Multiple Choice**, **Fill in the Blanks**, and **Question Set** ship in `@kukui/core` and are usable for Brightspace's native quiz tools. Studio hides them because Lamakū already has good native quiz authoring; Kukui exists to do what Lamakū *can't*.

## Quick start

```bash
git clone https://github.com/<your-org>/kukui-web
cd kukui-web
pnpm install
pnpm dev:studio                         # Studio authoring tool (port 5174)
pnpm dev                                # engine-web (per-activity preview, port 5173)
pnpm dev:live                           # Kukui Live alpha (port 5175)
pnpm test                               # ~230 tests across packages + apps
pnpm typecheck                          # tsc -b workspace-wide
pnpm build                              # production builds for every app
node packaging/pack-scorm.js --all      # build all SCORM zips → packaging/build/
```

### Use Studio (no install required)

Studio runs entirely in the browser and is hosted on GitHub Pages — no install, no login, no backend. Open the live site, pick an activity from the sidebar, fill in the form (or drop in JSON), preview it live, and click **Download** to get a SCORM 1.2 zip ready to upload into D2L (or any SCORM 1.2-compatible LMS). Grade passback is automatic via SCORM 1.2's `cmi.core.score.*` and `cmi.core.lesson_status` APIs.

> Live URL: `https://<your-org>.github.io/<repo>/` (set when you fork or push to your own GitHub repo — the workflow in [`.github/workflows/pages.yml`](.github/workflows/pages.yml) handles the deploy).

If you want to share an in-progress draft with another author, click **Export** to get a portable JSON file. Recipients click **Import** in their Studio to load it.

### Uploading a Kukui activity to Brightspace (Lamakū)

1. In Studio, fill out the activity form and click **Download / SCORM 1.2 zip**. You'll get a `<your-title>.zip` file.
2. In your Brightspace course, navigate to **Content > the unit/module** where the activity should live.
3. Click **Upload / Create > SCORM Object**, then choose the zip you just downloaded. Brightspace unpacks the package and adds it as a new topic.
4. To make grades flow into the gradebook, open the new topic, click the **gear icon > Edit Properties In-place**, and link it to a numeric grade item. Pass-percentage and points-out-of are configured on the grade item, not on the activity itself.

The Kukui activity reports `raw / max` (scaled to 0–100) and `passed` / `failed` to Brightspace. Completion-only activities (Reflection Prompt, Audio Recording, Image Comparison Slider, and Flashcards) always submit `100% / passed` so the gradebook records full credit on completion — they're not assessment items.

## Architecture (one diagram)

```
                ┌──────────────────┐
                │  Studio (web)    │  pick kind → fill form → download .scorm.zip
                └────────┬─────────┘
                         │ embeds the same @kukui/core build
                         ▼
                ┌──────────────────┐
                │  Engine bundle   │  one per activity kind
                │  inside each     │  (~400 KB gzipped per activity)
                │  SCORM zip       │
                └────────┬─────────┘
                         │ uploaded to D2L Brightspace as a SCO module
                         ▼
                ┌──────────────────┐
                │  Lamakū / D2L    │  posts cmi.core.score.* via pipwerks
                └──────────────────┘
```

Each activity is a React component in `packages/core/src/components/<kind>/`. It receives a Zod-validated config (from `packages/schemas/<kind>.ts`) and emits a `ScoreState` on submit. The runtime, scoring, and SCORM bridge are shared across every activity.

## Repository layout

```
kukui-web/
  apps/
    studio-app/               authoring tool (Vite + React + Tiptap + RJSF)
    engine-web/               per-activity HTML entries that ship inside SCORM
    live-mode/                M0 lobby for Phase 3 real-time classroom
  packages/
    core/                     activity components, ActivityHost router, scoring
    schemas/                  one Zod schema per activity kind
    bridge/                   SCORM 1.2 wrapper (pipwerks + Unity .jslib)
    live/                     Trystero + Y.js transport for Live
  packaging/
    pack-scorm.js             builds kukui-<kind>.scorm.zip from templates
    templates/imsmanifest.xml.tmpl
  docs/
    design-system.md          tokens, components, glass theme conventions
```

## Developing a new activity

1. Add a Zod schema under [`packages/schemas/src/<kind>.ts`](packages/schemas/src/).
2. Register it in [`packages/schemas/src/index.ts`](packages/schemas/src/index.ts).
3. Add the React component under [`packages/core/src/components/<kind>/`](packages/core/src/components/) — receive `config: TConfig`, call `onSubmit({ raw, max, success })` when finished.
4. Wire the component into [`packages/core/src/activity-host.tsx`](packages/core/src/activity-host.tsx).
5. Add a starter to [`apps/studio-app/src/starters.ts`](apps/studio-app/src/starters.ts) and a uiSchema to [`apps/studio-app/src/uiSchemas.ts`](apps/studio-app/src/uiSchemas.ts).
6. Add a per-activity HTML entry under [`apps/engine-web/<kind>.html`](apps/engine-web/) (copy any existing one).
7. Add the kind to [`packaging/pack-scorm.js`](packaging/pack-scorm.js)'s `PHASE_1_ACTIVITIES`.
8. `pnpm build && node packaging/pack-scorm.js --all`.

The simplest reference is `multiple-choice` (text-only, no media). For visual placement editors, see `drag-and-drop` and the parallel editor in `apps/studio-app/src/EditCanvas/`.

## Scoring & SCORM

Per-activity score math lives in [`packages/core/src/scoring.ts`](packages/core/src/scoring.ts). Each component computes raw/max points and a `success` boolean, then calls `onSubmit({ raw, max, success, suspendData })`. The [`@kukui/bridge`](packages/bridge/) wrapper translates this to SCORM 1.2:

| Component output | SCORM field | Notes |
|---|---|---|
| `raw / max` | `cmi.core.score.raw` (scaled to 0–100) | Bridge converts the ratio to a 0–100 percentage so D2L always sees a comparable scale. `cmi.core.score.min` / `score.max` are written as `"0"` / `"100"`. |
| `success` | `cmi.core.lesson_status` | `true` → `"passed"`; `false` → `"failed"`. |
| `suspendData` | `cmi.suspend_data` (≤ 4 KB) | JSON blob, used for resume. SCORM 1.2 caps this at 4096 chars; the bridge truncates and warns on overflow. |

`behaviour.singlePoint: true` collapses partial credit to all-or-nothing — useful for high-stakes assessments. `behaviour.enableRetry` shows a Try Again button after submission. Self-rated activities (Flashcards) and engagement-only activities (Reflection, Audio Recording, Image Comparison Slider) ignore raw/max entirely and always report `1 / 1, success: true` on completion, so the gradebook column reads 100%.

## Deploying to GitHub Pages

Push to `main` and the [Pages workflow](.github/workflows/pages.yml) builds + tests + publishes Studio automatically:

1. **Fork or push the repo** to your GitHub account.
2. **Enable Pages**: in the repo's **Settings > Pages**, set **Source = GitHub Actions**.
3. **Push to `main`**. The workflow runs `pnpm typecheck`, `pnpm test`, builds the engine, packs the SCORM templates, builds Studio with `KUKUI_BASE=/<repo>/`, and deploys the result.
4. Visit `https://<your-user>.github.io/<repo>/` once the workflow finishes (~3 min for a fresh build).

The deployed Studio bundles the per-activity SCORM templates from `packaging/build/` so authors can click **Download** without rebuilding anything locally — the templates ship as static files inside `/scorm-templates/kukui-<kind>.scorm.zip`.

## Accessibility & i18n

Built to WCAG 2.2 AA: keyboard fallbacks for every drag/drop, ARIA-labeled icon buttons, focus-trapped modals, `prefers-reduced-motion` and `prefers-reduced-transparency` respected at the CSS layer. The glass theme auto-flattens on OS-level translucency-reduction preferences.

i18n: not done yet. All strings are inline in components; a future phase will extract them to a translation layer.

## License

MIT — see [LICENSE](LICENSE). Use it, fork it, sell consulting on top of it. If you build something cool with Kukui, we'd love to hear about it.

## Acknowledgements

Built at UH JABSOM's Office of Medical Education. Designed from scratch as a React/SCORM toolkit aimed at clean schema-driven authoring and modern in-browser editing.
