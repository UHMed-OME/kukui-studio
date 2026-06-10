<p align="center">
  <img src="kukui-logo.svg" alt="Kukui" width="120" />
</p>

<h1 align="center">Kukui</h1>

<p align="center"><em>JSON-driven interactive learning activities for the LMS. SCORM-packaged, browser-hosted, no backend.</em></p>

<p align="center">
  <a href="https://kukuistudio.com"><strong>▶ Open Kukui Studio (live)</strong></a>
  &nbsp;·&nbsp;
  <a href="#uploading-a-kukui-activity-to-lamakū-or-any-other-lms">Upload to Lamakū</a>
  &nbsp;·&nbsp;
  <a href="#activity-catalog">Activity catalog</a>
  &nbsp;·&nbsp;
  <a href="#local-development">Local development</a>
</p>

---

Kukui is an open-source toolkit for building, packaging, and shipping interactive learning activities to a Learning Management System. It started as a project for [University of Hawaiʻi John A. Burns School of Medicine](https://jabsom.hawaii.edu/)'s LMS instance ("Lamakū") and is released under the MIT license for any institution that wants to author their own.

The project name comes from the **kukui** nut — the candlenut Hawaiians traditionally burned in *lamakū* torches. Lamakū hosts the activities; Kukui *is* the activities.

## Why Kukui exists

A handful of incumbent interactive-content authoring platforms already exist for education. Kukui was built because none of them, in the form available to JABSOM, satisfied all of the following at once:

- **No backend, no login, no SaaS.** Studio runs entirely in the browser. Drafts auto-save to your local browser storage; nothing is sent to a server we operate. There's nothing to provision, no per-seat license, and no central database holding course content. An institution can fork the repo, push to its own GitHub, and host Studio for free on GitHub Pages.
- **WCAG 2.2 AA from day 1, not retrofitted.** Every activity ships keyboard fallbacks for drag-and-drop interactions, ARIA-labeled controls, focus-trapped modals, and respects `prefers-reduced-motion` / `prefers-reduced-transparency`. Required `alt` text is enforced at the schema layer — authors can't ship an inaccessible image even by accident.
- **Direct SCORM 1.2 packaging, no third-party hosting.** Click **Download** and you get a `<title>.zip` you upload to Lamakū (or any SCORM 1.2 LMS) as a SCO module. Grades flow back through `cmi.core.score.*` and `cmi.core.lesson_status` automatically. No external content service to integrate, no LTI consumer key to provision, no risk of an outage on someone else's server breaking your gradebook.
- **JSON-driven, version-controllable authoring.** Every activity is a Zod-validated JSON config. Authors can hand-edit the JSON, paste into Studio, diff it in git, copy a working activity and tweak it, or generate one from a script. The schemas are the contract — no proprietary binary formats, no editor-locked files.
- **Open content + open code.** MIT-licensed code; activities are plain JSON the author owns. No vendor can revoke access, change pricing, or sunset a feature an institution depends on. The 30+ activity types ship as components in the repo — extend or fork freely.
- **Modern web stack, native to the browser.** React 19, TypeScript strict, Tailwind, Vite. No Flash, no Java applet, no proprietary runtime. WebGL/`react-three-fiber` powers the 3D activities; `MediaRecorder` powers audio capture; everything degrades gracefully when a feature isn't available.


## Use Kukui Studio (no install required)

> **▶ https://kukuistudio.com**

Studio runs entirely in the browser — no install, no login, no backend. Drafts auto-save to your browser's local storage; you can also **Export** an in-progress draft as a portable JSON file for another author to **Import**.

**Workflow for an instructor / author:**

1. Open the link above.
2. Pick an activity type from the sidebar (organized by Bloom's taxonomy).
3. Fill in the form, or paste your own JSON. Preview renders live alongside the form.
4. Click **Download / SCORM 1.2 ZIP**. You get a `<your-title>.zip` that drops directly into Lamakū (or any SCORM 1.2-compatible LMS).
5. Upload the zip into your course (steps in the [Upload section](#uploading-a-kukui-activity-to-lamakū-or-any-other-lms) below). Grades flow back automatically via SCORM 1.2's `cmi.core.score.*` and `cmi.core.lesson_status` APIs.

## What's in the box

Three apps, one shared core:

| App | What it does |
|---|---|
| **Kukui Studio** | Browser-based authoring tool. Pick an activity type, fill in the form (or drop in JSON), preview live, download a SCORM 1.2 zip ready for Lamakū or any other SCORM 1.2 LMS. No login, no backend — drafts auto-save to your browser. |
| **Kukui Engine** | The runtime that actually ships inside each SCORM zip. One self-contained bundle per activity type; loads its config JSON, renders the React component, reports the score back to the LMS via SCORM. |
| **Kukui Live** *(alpha)* | Real-time classroom mode using peer-to-peer WebRTC. Students join an instructor's session with a 6-digit code and synchronized state flows through a CRDT (Y.js). |

30+ activity types ship today; the highlights are grouped below.

## Activity catalog

Activities are organized by Bloom's revised taxonomy — what kind of thinking they exercise:

### Remember — recall facts and terminology
- **Flashcards** — Self-paced two-sided card deck with a spaced-style retry loop: cards the learner says they "didn't know" cycle back into the deck until mastered (cap of 2 retries by default). Self-rating is honor-system, so flashcards are graded as completion-only — finishing a run-through earns full credit, and a "Practice again" button lets learners reshuffle and run the deck as many times as they want without changing their grade.
- **Matching Pairs** — Click an item on the left, then its match on the right. Right column shuffles on load (configurable). On submit, wrong rows show "Correct match: X" so the learner sees the pairing.
- **Crossword** — Author provides a list of `{ term, definition }` entries; the runtime randomly lays out a connected crossword grid from those entries with seeded determinism (same seed = same grid on resume; "New layout" reshuffles). Scoring is per-cell; "Reveal letter" / "Reveal word" affordances cost the revealed cells.

### Understand — identify, explain, classify
- **Image Hotspots** — Pick the correct region of an image. Single-correct (use 3D Hotspots for spatial work). Includes a keyboard fallback list of named regions for AT users.
- **Anatomy Labeling** — Drag named labels to anchor points on a diagram. Each target accepts exactly one label; placing a different label displaces the previous one back to the tray. Per-label correctness shown on submit.
- **Highlight Text Spans** — Click words/phrases in a sentence; correct selections gain points, wrong ones lose them. After submit, dashed outlines appear on tokens the learner missed.

### Apply — use procedures in new contexts
- **Drag and Drop** — Drop labeled chips onto rectangles overlaid on a background image. Supports many-to-one (multiple chips on one zone) via per-chip `correctZones[]`. Visual editor in Studio + dnd-kit drag with a `<select>` keyboard fallback.
- **Sequence Steps** — Arrange shuffled items in the correct order. Shuffle algorithm guarantees the start order isn't already correct. Partial credit per item-in-correct-position; reorder via mouse drag or keyboard arrows.
- **Categorization** — Sort items into named bins. No capacity limit per bin (vs. Drag and Drop). Items snap into bins; the keyboard fallback offers a `<select>` per item.
- **3D Hotspots** — Same as Image Hotspots but on a 3D model (glTF/glb), rendered with react-three-fiber. Single-correct; falls back to a button list when WebGL is unavailable.
- **Virtual Tour** — A 3D scene with clickable info overlays. Two completion modes: `manual` (Submit when ready) or `visitAll` (auto-completes when every required overlay has been visited).
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
- **Audio Recording** — Records mic audio in-browser via MediaRecorder. Optional reference audio plays alongside; `minSeconds`/`maxSeconds` enforce duration. Re-record allowed by default. *Pure completion scoring* — the audio itself isn't auto-evaluated.

### Quiz primitives (used inside other activities; not in Studio's catalog)
**Multiple Choice**, **Fill in the Blanks**, and **Question Set** ship in `@kukui/core` and are usable for an LMS's native quiz tools. Studio hides them because Lamakū already has good native quiz authoring; Kukui exists to do what Lamakū *can't*.

## Uploading a Kukui activity to Lamakū (or any other LMS)

1. In Studio, fill out the activity form and click **Download / SCORM 1.2 zip**. You'll get a `<your-title>.zip` file.
2. In your LMS course (Lamakū shown here), navigate to **Content > the unit/module** where the activity should live.
3. Click **Upload / Create > SCORM Object**, then choose the zip you just downloaded. The LMS unpacks the package and adds it as a new topic.
4. To make grades flow into the gradebook, open the new topic, click the **gear icon > Edit Properties In-place**, and link it to a numeric grade item. Pass-percentage and points-out-of are configured on the grade item, not on the activity itself.

The Kukui activity reports `raw / max` (scaled to 0–100) and `passed` / `failed` to the LMS. Completion-only activities (Reflection Prompt, Audio Recording, Image Comparison Slider, and Flashcards) always submit `100% / passed` so the gradebook records full credit on completion — they're not assessment items.

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
                         │ uploaded to Lamakū or another LMS as a SCO module
                         ▼
                ┌──────────────────┐
                │  Lamakū / LMS    │  posts cmi.core.score.* via pipwerks
                └──────────────────┘
```

Each activity is a self-contained bundle at `packages/activities/<slug>/` — Zod schema (`schema.ts`), React component (`Component.tsx`), Studio form metadata (`ui-schema.ts`, `starter.ts`, `meta.ts`), and sample fixtures (`samples/`) co-located in one folder. Every bundle exports an `ActivityManifest` from its `manifest.ts`, and `packages/activities/src/index.ts` discovers all of them via `import.meta.glob` — Studio's catalog, the engine's component registry, and the schema registry derive from the manifests automatically; there is no hand-maintained central registry. The host runtime, scoring, and LMS drivers live in `@kukui/core` and are shared across every activity.

SCORM isn't the only output. The same engine build also packages as a **web package** (`node packaging/pack-scorm.js --target web`, or **Download → For the web** in Studio): a self-contained static folder that runs on any web host with no LMS — progress persists in the learner's browser, and a completion panel lets learners self-report results. `packages/embed/` ships a dependency-free `<kukui-activity>` custom element for dropping a hosted web package onto any page.

## Repository layout

```
kukui-studio/
  apps/
    studio-app/               authoring tool (Vite + React + Tiptap + RJSF)
    engine-web/               per-activity HTML entries that ship inside each package
    live-mode/                Phase 3 real-time classroom (alpha)
  packages/
    activities/               one bundle per activity kind: {slug}/schema.ts,
                              Component.tsx, ui-schema.ts, starter.ts, meta.ts,
                              samples/, manifest.ts; src/index.ts derives all
                              registries from the manifests via import.meta.glob
    core/                     ActivityHost runtime, scoring, SCORM/web drivers,
                              shared component utilities
    schemas/                  cross-activity schema scaffolding (shared fields,
                              appearance, migrations, SchemaRegistry)
    bridge/                   SCORM 1.2 wrapper (pipwerks + Unity .jslib)
    live/                     Trystero + Y.js transport for Live
    embed/                    <kukui-activity> custom element for embedding
                              hosted web packages on any page
  packaging/
    pack-scorm.js             builds SCORM zips (default) or portable web
                              packages (--target web) from the engine build
    templates/imsmanifest.xml.tmpl
  docs/
    design-system.md          tokens, components, glass theme conventions
```

## Developing a new activity

Everything for one activity lives in a single folder: [`packages/activities/<slug>/`](packages/activities/).

1. Create the bundle folder `packages/activities/<slug>/` with:
   - `schema.ts` — the Zod config schema
   - `Component.tsx` — the React component; receives `config`, calls `onSubmit({ raw, max, success })` when finished
   - `meta.ts` — label, description, Bloom level, `live` flag
   - `starter.ts` — the minimal valid config Studio loads when an author picks the kind
   - `ui-schema.ts` — RJSF form hints (can be empty if defaults are fine)
   - `samples/basic.json` — a fixture, served at `/samples/<slug>/` in dev and used as the packaging default
   - `manifest.ts` — assembles the above into an `ActivityManifest` (copy from an existing bundle, e.g. `flashcards`)
2. That *is* the registration. [`packages/activities/src/index.ts`](packages/activities/src/index.ts) discovers every `manifest.ts` via `import.meta.glob`, so Studio's sidebar, the schema registry, and the engine's activity router all pick the new kind up automatically — there is no central file to hand-edit.
3. Add a per-activity HTML entry under [`apps/engine-web/<slug>.html`](apps/engine-web/) (copy any existing one and change the `data-activity` / `data-config` attributes).
4. `pnpm typecheck && pnpm test` — cross-reference tests enforce that manifests are complete.
5. `pnpm build:scorm:all` (or `node packaging/pack-scorm.js --activity <slug>`). Packaging auto-discovers slugs from `packages/activities/`, so there's no activity list to update there either.

The simplest reference bundle is `packages/activities/multiple-choice/` (text-only, no media). For visual placement editors, see `drag-and-drop` and the parallel editor in `apps/studio-app/src/EditCanvas/`. If you develop with Claude Code, the repo's `/kukui` slash command scaffolds a new bundle interactively.

## Scoring & SCORM

Per-activity score math lives in [`packages/core/src/scoring.ts`](packages/core/src/scoring.ts). Each component computes raw/max points and a `success` boolean, then calls `onSubmit({ raw, max, success, suspendData })`. The driver layer in [`packages/core/src/scorm.ts`](packages/core/src/scorm.ts) routes that to the right backend: in an LMS, a pipwerks-based SCORM 1.2 driver; in a web package, a `LocalDriver` that persists to the learner's browser storage and powers the completion panel. In LMS mode the mapping is:

| Component output | SCORM field | Notes |
|---|---|---|
| `raw / max` | `cmi.core.score.raw` (scaled to 0–100) | Bridge converts the ratio to a 0–100 percentage so the LMS always sees a comparable scale. `cmi.core.score.min` / `score.max` are written as `"0"` / `"100"`. |
| `success` | `cmi.core.lesson_status` | `true` → `"passed"`; `false` → `"failed"`. |
| `suspendData` | `cmi.suspend_data` (≤ 4 KB) | JSON blob, used for resume. SCORM 1.2 caps this at 4096 chars; the bridge truncates and warns on overflow. |

`behaviour.singlePoint: true` collapses partial credit to all-or-nothing — useful for high-stakes assessments. `behaviour.enableRetry` shows a Try Again button after submission. Self-rated activities (Flashcards) and engagement-only activities (Reflection, Audio Recording, Image Comparison Slider) ignore raw/max entirely and always report `1 / 1, success: true` on completion, so the gradebook column reads 100%.

## Deploying to GitHub Pages

Push to `main` and the [Pages workflow](.github/workflows/pages.yml) builds + tests + publishes Studio automatically:

1. **Fork or push the repo** to your GitHub account.
2. **Enable Pages**: in the repo's **Settings > Pages**, set **Source = GitHub Actions**.
3. **Push to `main`**. The workflow runs `pnpm typecheck`, `pnpm test`, builds the engine, packs the SCORM and web-package templates, builds Studio (with Live mode staged under `/live/`), and deploys the result.
4. Visit `https://<your-user>.github.io/<repo>/` once the workflow finishes (~3 min for a fresh build).

The workflow computes the Vite base path automatically: a fork builds with base `/<repo-name>/` and serves at `https://<your-user>.github.io/<repo-name>/`, while the canonical repo — or any fork with a custom domain configured via a `CNAME` file in `apps/studio-app/public/` — builds with base `/` and serves at the domain apex (that's how https://kukuistudio.com is deployed).

The deployed Studio bundles the per-activity templates from `packaging/build/` so authors can click **Download** without rebuilding anything locally — SCORM zips ship as static files under `/scorm-templates/`, and the non-LMS web packages under `/web-templates/`.

## Local development

For contributors and self-hosting institutions. Authors don't need any of this — they use the live Studio URL above.

```bash
git clone https://github.com/UHMed-OME/kukui-studio
cd kukui-studio
pnpm install
pnpm dev:studio                         # Studio authoring tool (port 5174)
pnpm dev                                # engine-web preview (port 5173)
pnpm dev:live                           # Kukui Live alpha (port 5175)
pnpm test                               # full Vitest suite (100+ test files)
pnpm typecheck                          # tsc -b workspace-wide
pnpm build                              # production builds for every app
node packaging/pack-scorm.js --all      # build all SCORM zips → packaging/build/
node packaging/pack-scorm.js --all --target web   # non-LMS web packages
```

Requires Node 20+ and pnpm 10. Tested on macOS and Linux.

## Accessibility & i18n

Built to WCAG 2.2 AA: keyboard fallbacks for every drag/drop, ARIA-labeled icon buttons, focus-trapped modals, `prefers-reduced-motion` and `prefers-reduced-transparency` respected at the CSS layer. The glass theme auto-flattens on OS-level translucency-reduction preferences.

i18n: not done yet. All strings are inline in components; a future phase will extract them to a translation layer.

## License

MIT — see [LICENSE](LICENSE). Use it, fork it, sell consulting on top of it. If you build something cool with Kukui, we'd love to hear about it.

## Acknowledgements

Built at the John A. Burns School of Medicine’s Office of Medical Education. Designed from scratch around a clean schema-driven authoring model and modern in-browser editing, with WCAG 2.2 AA conformance from day 1.
