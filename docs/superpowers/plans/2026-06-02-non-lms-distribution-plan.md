# Non-LMS distribution — plan

**Date:** 2026-06-02
**Status:** Proposal / planning
**Author:** Kukui core

## Problem

Today the only first-class distribution path is a **SCORM 1.2 zip** ([`packaging/pack-scorm.js`](../../../packaging/pack-scorm.js), Studio's in-browser [`scormDownload.ts`](../../../apps/studio-app/src/scormDownload.ts)). That assumes the author has an LMS that speaks SCORM (Brightspace, Canvas, Moodle, …).

Plenty of would-be authors don't:

- A clinician-educator with a personal site or a WordPress/Google Sites page.
- A student-run study resource shared as a link.
- An open educational resource (OER) meant to be embedded anywhere or just opened.
- Someone piloting an activity before committing to an LMS slot.

The activities **already run** without an LMS. `getScormDriver()` ([scorm.ts:149](../../../packages/core/src/scorm.ts#L149)) detects `window.pipwerks.SCORM`; when it's absent it silently falls back to `MemoryDriver`, which:

- logs the score to the console and throws it away,
- keeps `suspend_data` in a field that dies on reload,
- reports `isLive() === false`, so there's no completion surface for the learner and no record for anyone.

So the runtime gap a non-LMS package must close is **persistence + completion feedback + (optional) results collection**, without a backend (per the locked stack: Studio/Live are backendless, static-hosted, MIT).

## What we'd ship — package variants

Four forms, increasing in integration effort. We do **not** need all four at once; §"Phasing" sequences them.

| # | Form | Artifact | Best for | Host requirement |
|---|------|----------|----------|------------------|
| A | **Portable web zip** | `kukui-<activity>.web.zip` (static `index.html` + assets, no `imsmanifest.xml`, no pipwerks) | Drop onto any static host or open locally | Any static file host, or `file://` |
| B | **Single-file HTML** | `kukui-<activity>.html` with JS/CSS/JSON inlined | Email it, paste into a CMS raw-HTML block, Google Drive share | None — one file |
| C | **Hosted embed** | A stable URL on kukuistudio.com (or the author's host) + an `<iframe>`/`<script>` snippet | Embedding in WordPress, Notion, Wix, Google Sites, course homepages | We host, or author hosts the zip |
| D | **Web component / npm** | `<kukui-activity kind config>` custom element, published `@kukui/embed` | Developers embedding in their own React/Vue/plain sites | Author's build |

### The runtime piece all four share: a `LocalDriver`

The single most important change. Add a third `ScormDriver` implementation alongside `PipwerksDriver` and `MemoryDriver` in [scorm.ts](../../../packages/core/src/scorm.ts):

- Persists `suspend_data` and last score to `localStorage` keyed by activity id → **resume across reloads** on the same device/browser.
- `isLive()` semantics stay honest (not an LMS), but the host gains a real completion surface.
- On submit, renders a **completion panel**: score, pass/fail, and the chosen results-collection affordance (below).

Driver selection today is purely "is pipwerks present." We add an explicit **mode signal** so a web build opts into `LocalDriver` instead of the silent `MemoryDriver`. Cleanest: a `data-mode="web"` attribute on `#root` (mirrors the existing `data-activity` / `data-config` convention in [multiple-choice.html](../../../apps/engine-web/multiple-choice.html)), read in `main.tsx` and passed to `getScormDriver({ mode })`. LMS builds keep emitting no attribute → pipwerks path unchanged.

### Results collection without a backend

For authors who want more than "the learner sees their score." All optional, all backendless:

1. **Completion code** — encode score + interactions into a short copy-paste string the learner emails/pastes back. We already have the encoding primitives (`interaction-encoding.ts`, LZString compression used for `suspend_data`). Lowest-tech, works offline.
2. **Download results** — emit a JSON or a printable/PDF "certificate of completion" the learner submits as a file.
3. **Pre-filled `mailto:`** — a "Send my results" button that opens the learner's mail client addressed to the instructor with score in the body. Zero infra.
4. **Pluggable webhook / Google Form** — author pastes a POST endpoint or Google Form prefill URL into the config; on completion we fire it. Opt-in, author-supplied, so we stay backendless.
5. **xAPI → LRS** — the "real" telemetry path, but per the stack pin xAPI/cmi5 is deferred to Phase 6+. Note as future, don't build now.

## Where authors can host it (the "what sites / apps")

**Static hosts (drop the web zip):** GitHub Pages, Netlify, Cloudflare Pages, Vercel, Surge, AWS S3 + CloudFront, Firebase Hosting, itch.io (good fit for the game-like 3D/tour activities), Internet Archive.

**Embed in a CMS / site builder (variant B or C):** WordPress (Custom HTML block or iframe), Google Sites (Embed → by URL or code), Notion (`/embed` with a hosted URL), Wix / Squarespace / Webflow (HTML embed element), Canvas/Brightspace as a plain external-link/iframe topic even *without* SCORM grading.

**No-host / share-as-file (variant B):** open the single HTML file locally; share via Google Drive / Dropbox / OneDrive public link; hand out a QR code that points at any of the above.

We should ship a short **hosting recipes doc** (sibling to the existing [upload-to-lms.md](../../../apps/studio-app/src/content/docs/upload-to-lms.md), e.g. `host-on-the-web.md`) with click-by-click steps for the top 3–4 venues, exactly mirroring the LMS doc's structure.

## What we build, concretely

### Packager (`packaging/pack-scorm.js` → generalize)

The packer already has a forward-looking `--engine` flag and a clean staging pipeline. Add a **`--target <scorm|web>`** dimension (keep `scorm` the default for back-compat):

- `--target web` skips `imsmanifest.xml` and `pipwerks.SCORM.min.js`, sets `data-mode="web"` on the entry HTML, and outputs `kukui-<activity>.web.zip`.
- A second pass (or a small `inline-single-file.js`) produces variant B by inlining `assets/*.js`, `assets/*.css`, and the default `basic.json` into one `.html`. Watch the 3D/tour activities — large `.glb` assets make single-file impractical; gate variant B to activities under a size budget and fall back to the zip with a logged note (no silent truncation).
- Rename the module away from `pack-scorm` eventually, or add `pack-web.js` that shares the staging helpers. Low risk either way.

### Studio "Download for the web" (mirror the SCORM flow)

Studio already patches pre-built SCORM templates in the browser ([scormDownload.ts](../../../apps/studio-app/src/scormDownload.ts)). Add a parallel `webDownload.ts` that patches pre-built **web** templates (`/web-templates/kukui-<kind>.web.zip`) the same way: swap in the author's draft JSON, embed Sketchfab `.glb` imports identically, offer both the zip and the single-file HTML. This reuses ~90% of the existing logic.

### Web component (`@kukui/embed`, variant D — later)

Wrap `ActivityHost` in a custom element that reads `kind` + `config` (URL or inline JSON) from attributes and mounts React into a shadow root. Publish to npm + a CDN (`unpkg`/`jsDelivr`) so the embed snippet is one `<script>` + one tag.

### Docs

- `host-on-the-web.md` — hosting recipes (above).
- A "Distribution" comparison page: when to choose SCORM vs web zip vs single-file vs embed.

## Phasing

1. **Phase 1 — runtime + portable zip.** `LocalDriver` + `data-mode` signal + completion panel; `--target web` in the packer; the hosting-recipes doc. This alone unblocks "host it anywhere static." *Smallest shippable slice.*
2. **Phase 2 — Studio one-click.** `webDownload.ts` + "Download for the web" button + single-file HTML output. Brings non-LMS export to the no-code audience.
3. **Phase 3 — collection + embed.** Completion code + results download + opt-in webhook/Google Form; `@kukui/embed` web component and hosted embed URLs.
4. **Future — xAPI/LRS** when Phase 6+ commits to an LRS.

## Risks & open questions

- **`file://` limitations** — `fetch()` of a separate `basic.json` fails under `file://` (CORS/scheme). Variant B (inlined JSON) sidesteps this; the web zip should document "serve over http, or use the single-file build" for local use.
- **localStorage is per-browser, not per-user** — fine for resume, but two students on one machine share state unless we namespace by a learner-entered name. Decide whether to prompt for a name in web mode.
- **No verified scores** — any backendless collection (completion code, JSON download, mailto) is trivially forgeable. Frame web mode as **formative/low-stakes**; keep SCORM as the graded path. Say this plainly in the docs.
- **Asset weight** for 3D/tour/video activities pushes against single-file and even email-able zips; needs the per-activity size budget noted above.
- **Naming** — surface this as "Kukui for the web" / "share a link" rather than "non-LMS," which is jargon to the target educator.

## Recommendation

Build **Phase 1** first: it's a contained change (one new driver, one packer flag, one doc) that turns the already-working `MemoryDriver` fallback into a real, persistent, hostable experience — and it's the foundation every later variant builds on. Defer the web component and any collection beyond "learner sees + downloads their result" until there's demand.
