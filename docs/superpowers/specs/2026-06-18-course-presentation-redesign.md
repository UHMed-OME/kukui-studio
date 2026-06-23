# Course Presentation — redesign spec (2026-06-18)

## Problem

The first Course Presentation was a hand-typed slide deck: each slide held prose HTML, at most
one image, and at most one embedded multiple-choice / fill-in-the-blanks shown *below* the
content. There was no way to bring in real teaching material (a PDF, a PowerPoint export, a
Google Slides deck), and the interaction model was a single inline quiz per slide rather than the
positioned, gating interactions that make Interactive Video compelling.

This redesign makes **imported decks** the spine of the activity and adds **positioned on-slide
interactions** — the slide analog of Interactive Video's timed checkpoints.

## Goals

1. Import a deck from **PDF** (first-class), **Google Slides link** (best-effort), and
   **PowerPoint** (`.pptx` → guided export-to-PDF). One slide per source page.
2. Place **interactions on the slide image**: clickable **info hotspots** (reveal text/image) and
   **question checkpoints** (MC / fill-in-the-blanks). A checkpoint may be **required** — it gates
   advancing to the next slide.
3. Stay within the platform's hard constraints: no backend, browser-local drafts, SCORM-offline
   delivery, WCAG 2.2 AA.

## Non-goals

- Native in-browser `.pptx` rasterization (no reliable library exists; we route to PDF).
- A live/linked deck that re-fetches from Google at runtime (breaks offline SCORM + a11y).
- Re-introducing the rich per-slide prose editor as a headline path (blank/title slides remain).

## Runtime model — snapshot to offline images

All imports are resolved **at author time** into, per page:

- a rendered **PNG** (the slide background), and
- an **extracted text layer** (used as the image's `alt` and an accessible notes region).

This means the learner-facing runtime is a sequence of static images + overlays — fully offline,
fully screen-reader-addressable, no runtime dependency on Google/Office/PDF tooling.

### Why not live iframe embeds

Google Slides / Office Online embeds need network at every view, can't be packaged into an
offline SCORM zip, and expose no text layer to assistive tech. Rejected as the default. (A
deck author who truly wants a linked deck can still paste a public image URL per slide, but that
is not the supported import path.)

## Asset storage (the load-bearing constraint)

Studio drafts live in `localStorage` with a **2 MB cap per draft**
(`apps/studio-app/src/drafts.ts`). Slide PNGs would blow that instantly, so:

- Slide images are stored in **IndexedDB**, keyed by a generated `assetId`
  (`apps/studio-app/src/slides/slideAssetStore.ts`, generalized from the Sketchfab
  `sketchfab/modelCache.ts` blob store).
- The **draft JSON stores only** `{ assetId, alt, naturalWidth, naturalHeight }` per slide
  background — never the bytes.
- For **preview** (Edit canvas + Live tab), Studio resolves `assetId → object URL`
  (`resolveDeckAssets`) and injects it as a transient `src` before the runtime Component renders.
  Object URLs are revoked on unmount.
- For **export**, `embedSlideAssets()` (in `scormDownload.ts` / `webDownload.ts`, beside the
  existing `embedSketchfabImports()`) writes each blob to `samples/<kind>/assets/<assetId>.png`
  inside the zip and rewrites `background.src` to the relative `./assets/<assetId>.png`. The
  package is then self-contained; `packaging/pack-scorm.js` already ships `samples/<kind>/assets/*`.

The engine-facing `Component` only ever reads `background.src` (a string). All `assetId` /
IndexedDB resolution is a Studio-only authoring concern.

## Data model

```
CoursePresentationConfig { _comment?, version, title, author?, slides[], scoring?, appearance }

Slide {
  id                       // unique within deck
  title?
  background:
    | { kind: "image", assetId?, src?, alt, naturalWidth, naturalHeight }   // import or upload
    | { kind: "blank" }                                                      // title / section slide
  notes?                   // extracted slide text / author prose → accessible region
  overlays: Overlay[]
}

Overlay {
  id                       // unique within the slide
  rect: { x, y, w, h }     // normalized 0..1, resolution-independent
  kind:
    | { kind: "info", label, html }
    | { kind: "checkpoint", required?, activity: { kind: "multipleChoice"|"fillInTheBlanks", config } }
}
```

- `background.src` uses `SAFE_MEDIA_URL` and is **optional**: a freshly imported slide has only an
  `assetId`; a transient object-URL `src` is injected for preview; a relative `./assets/...` `src`
  is written at export.
- Inner checkpoint `config` is stored as `z.unknown()` and **validated at render** against the
  matching MC / FITB schema — the same late-validation pattern Interactive Video uses for its
  checkpoint interactions. A malformed checkpoint degrades to a no-op marker rather than crashing.

## Interaction & runtime behaviour

- The current slide's image renders at its natural aspect ratio; overlays are absolutely
  positioned over it by `rect` percentages.
- **Info hotspot**: a ≥44 px button (icon + visible label) toggling an accessible disclosure with
  the sanitized `html` (`SafeHtml`).
- **Checkpoint**: a button opening the embedded MC / FITB component. A **required** checkpoint
  blocks the **Next** control until it has been answered (mirrors Interactive Video's required
  gating).
- Deck navigation: Prev / Next + a dot strip; `aria-live` slide announcement; completion badge.
- **Scoring**: aggregate every checkpoint's score (`aggregate` / `resolveScoring` from
  `@kukui/core`). A deck with zero checkpoints is **completion-only** — reaching the end and
  finishing marks success. Resume persists current slide + per-checkpoint scores via `onPersist`.

## Import pipeline (Studio authoring)

- **PDF** (`slides/importPdf.ts`): dynamic `import("pdfjs-dist")` (worker via Vite `?url`,
  dynamically imported like `jszip` so it stays out of the main chunk). Per page: render to a
  canvas → PNG blob → `putSlideAsset`; pull the text layer → `notes` + default `alt`. Returns
  `Slide[]`.
- **PowerPoint `.pptx`**: detected and routed to a guided "In PowerPoint/Keynote, export as PDF,
  then import the PDF" flow. No native rasterization.
- **Google Slides link** (`slides/importGoogleSlides.ts`): parse the deck id; best-effort fetch of
  the published per-slide images. Google's export endpoints generally lack CORS headers, so this
  often fails / taints the canvas; on failure the importer routes the author to the same
  export-to-PDF guidance. PDF is the guaranteed-offline path; the link is convenience-best-effort.

## Authoring surface

- **Visual editor** `apps/studio-app/src/EditCanvas/CoursePresentationEditor.tsx`, registered in
  `EditCanvas/index.tsx` (`EDITORS["course-presentation"]`). Import panel + slide filmstrip
  (add / delete / reorder via `zorder.ts`) + slide canvas with draggable/resizable overlay rects
  (reusing `minRect.ts` / `roundCoord` / `ContextMenu` / `StageHeader` from the rect editors) +
  an inspector (info content or checkpoint MC editor, the inline MC editor lifted from
  `InteractiveVideoEditor`'s `Inspector`).
- **Form** (`ui-schema.ts`): `slides` hidden (authored on canvas), like Interactive Video hides
  `interactions`. Title / author / appearance remain.
- **Starter** (`starter.ts`): one blank title slide + copy prompting an import. No external asset.

## Accessibility & design system

- Slide images always carry `alt` (extracted text or author-edited). Overlays pair color with icon
  + visible text. Required checkpoints are announced. Documented tokens only; layout-stable state
  changes (reserve space, change color only, constant border widths); tap targets ≥ 44 × 44 px.

## Risks

- **Google Slides + CORS**: link import is best-effort with a PDF-export fallback (above).
- **Storage volume**: large decks → many MB of PNGs in IndexedDB (browser-quota bound, not the
  2 MB draft). Surface a per-deck size readout + a cache-clear, like the Sketchfab cache.

## Verification

Unit (vitest): schema accepts the new shape / rejects bad rects + dup ids; Component renders a
slide, reveals an info hotspot, answers a checkpoint, blocks Next on a required unanswered
checkpoint, aggregates scoring; editor adds/moves an overlay; `importPdf` yields N slides from a
fixture. Typecheck + lint + build. Manual: import a real PDF in Studio → place overlays → Live
renders offline → download SCORM → confirm `samples/course-presentation/assets/*.png` exist and
backgrounds point at `./assets/...`.
