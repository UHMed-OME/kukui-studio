# Kukui Activity Usability & Accessibility Audit

**Date:** 2026-06-01
**Method:** Heuristic + accessibility expert review (static analysis — no live participants)
**Scope:** All 31 activity bundles in `packages/activities/`
**Rubric:** Kukui design system (`docs/design-system.md`) + WCAG 2.2 AA + Nielsen usability heuristics
**Reviewers:** 31 parallel audit agents, one per activity, each reading `Component.tsx`, `Component.css`, `schema.ts`, a sample fixture, and tests; Live variants checked where relevant.

> This is an expert heuristic evaluation, not a study with real users. Findings are defensible code-level observations with file:line references. Severity is the reviewer's estimate of learner/legal impact. Nothing in the codebase was modified.

---

## 1. Executive summary

The activity suite is, on the whole, **more mature and more accessibility-conscious than typical**. Most async activities already get the hard parts right: real semantic `<button>`/`<input>` elements, constant 2px borders for layout stability, color paired with ✓/✗ icons + text, reduced-motion handling, and SCORM suspend/restore. Several activities (`drag-and-drop`, `hotspot-3d`, `image-comparison-slider`, `categorization`, `matching-pairs`, `anatomy-labeling`, `sequence-steps`) ship genuine pointer-free keyboard alternatives to drag/canvas interactions — the single most common accessibility failure in this category of software, largely avoided here.

That said, the audit surfaced **5 Critical and ~30 High-severity issues**, plus a set of **systemic patterns** that recur across many activities. The highest-leverage work is fixing the systemic patterns once (in shared helpers) rather than per-activity.

### The five Critical findings

| Activity | Finding | Why critical |
|---|---|---|
| `interactive-video` | No caption/subtitle support at all (`schema.ts`, no `<track>`) | WCAG 1.2.2 — pre-recorded video in a university LMS must be captioned; legal floor for Section 508 |
| `image-annotation` | Drawing is pointer-only; no keyboard path to place/draw/erase | WCAG 2.1.1 Level A — keyboard users cannot complete the activity at all |
| `branching-scenario` | No focus move / announcement on node transition | Screen-reader users never learn the scenario advanced; the screen changes silently |
| `video-reflection` | No `MediaRecorder`/`getUserMedia` feature guard before use | On unsupported browsers the camera turns on, then `new MediaRecorder` throws; learner is stuck with a raw error and no Record affordance |
| `word-cloud` (Live) | Cloud is a single `role="img"`; words + frequencies invisible to AT | The entire pedagogical payload is unreadable by screen readers |

### Maturity at a glance

- **Complete async activities (21):** multiple-choice, fill-in-the-blanks, drag-and-drop, hotspot-2d, hotspot-3d, anatomy-labeling, categorization, matching-pairs, sequence-steps, crossword, concept-map, branching-scenario, ddx-tree, lab-panel, osce, reflection-prompt, flashcards, highlight-text, image-comparison-slider, audio-recording, video-reflection.
- **Partial async activities (3):** question-set (missing focus mgmt + scoring edge cases), virtual-tour (mouse-only 3D look, no load/error state), interactive-video (no captions, scoring bug).
- **Live-only by design (6):** confidence-meter, isometric-chatroom, qa-board, quick-quiz, straw-poll, word-cloud — the package `Component.tsx` is an intentional `LivePreviewCard`/stub; the real runtime is in `apps/live-mode/`. These are honestly labeled "(Live)" and `live: true`, **except** see the engine-completion concern in §3.

---

## 2. Severity counts

Approximate, de-duplicated to the most material items per activity.

| Activity | Maturity | Critical | High | Medium | Low |
|---|---|:-:|:-:|:-:|:-:|
| multiple-choice | complete | – | – | 3 | 4 |
| fill-in-the-blanks | complete | – | 2 | 4 | 3 |
| drag-and-drop | complete | – | 1 | 3 | 4 |
| question-set | partial | – | 2 | 4 | 4 |
| hotspot-3d | complete | – | 1 | 4 | 4 |
| virtual-tour | partial | – | 3 | 3 | 4 |
| interactive-video | partial | 1 | 3 | 4 | 4 |
| video-reflection | complete | 1 | 2 | 4 | 3 |
| audio-recording | complete | – | 2 | 3 | 4 |
| anatomy-labeling | complete | – | 2 | 3 | 4 |
| categorization | complete | – | 1 | 3 | 3 |
| matching-pairs | complete | – | 1 | 3 | 3 |
| sequence-steps | complete | – | 2 | 3 | 2 |
| hotspot-2d | complete | – | 2 | 4 | 3 |
| image-annotation | partial-ish | 1 | 3 | 4 | 3 |
| image-comparison-slider | complete | – | – | 3 | 4 |
| flashcards | complete | – | 2 | 4 | 3 |
| highlight-text | complete | – | – | 2 | 4 |
| crossword | complete | – | 2 | 3 | 3 |
| concept-map | complete | – | 2 | 4 | 4 |
| branching-scenario | complete | 1 | 2 | 3 | 4 |
| ddx-tree | complete | – | 1 | 4 | 3 |
| lab-panel | complete | – | 1 | 4 | 3 |
| osce | complete | – | 2 | 3 | 3 |
| reflection-prompt | complete | – | 1 | 3 | 3 |
| confidence-meter | Live | – | 2 | 3 | 2 |
| isometric-chatroom | stub/Live | – | 2 | 2 | 2 |
| qa-board | Live | – | 1 | 3 | 2 |
| quick-quiz | Live | – | 2 | 3 | 3 |
| straw-poll | Live | – | 1 | 3 | 3 |
| word-cloud | Live | 1 | 2 | 3 | 3 |

---

## 3. Cross-cutting systemic issues (fix once, fix everywhere)

These patterns recur across many activities. Each is best addressed in a shared helper (`packages/core/_shared`, `packages/schemas`) so all activities inherit the fix.

### S1 — Focus is never moved when a "screen" changes (a11y, High)
When the content region swaps but no element receives focus, screen-reader and keyboard users are not told the screen changed; focus drops to `<body>`.
- **Affected:** `branching-scenario` (Critical), `question-set`, `ddx-tree`, `osce`, `interactive-video` (overlay), `flashcards` (card flip).
- **Fix:** a shared "announce + focus" helper: give the new content region `tabIndex={-1}` + a ref, `.focus()` in an effect keyed on the active id (guarded against initial mount), and/or render the new prompt inside an `aria-live="polite"` region.

### S2 — Multiple `aria-live` regions fire simultaneously on submit; timers live inside live regions (a11y, Medium)
Several activities populate every per-item feedback region (all `aria-live="polite"`) plus the score region in the same commit, producing garbled/competing announcements. Recording/quiz timers updating 1–4×/sec inside a live region spam or drown out meaningful transitions.
- **Affected:** `multiple-choice`, `fill-in-the-blanks`, `matching-pairs`, `question-set`, `osce`, `sequence-steps`, `crossword`, `video-reflection`, `audio-recording`, `reflection-prompt`.
- **Fix:** one authoritative live region for the result summary; per-item feedback is reachable on navigation but not independently live. Keep ticking timers out of live regions (`aria-hidden` or a sibling), announce only discrete transitions and threshold warnings.

### S3 — Disabled Submit gives no announced reason (usability/a11y, Medium)
Submit is correctly disabled until valid (good error prevention), but a disabled button is not focusable and has no associated text, so keyboard/SR users get a dead control with no "why."
- **Affected:** `multiple-choice`, `fill-in-the-blanks`, `question-set`, `video-reflection`, `audio-recording`, `reflection-prompt`.
- **Fix:** a shared "submit gate hint" pattern — a visible/`aria-live` message ("Select an answer to continue", "Write N more words", "Record at least N seconds") tied to the button via `aria-describedby`.

### S4 — Drag paths lack screen-reader announcements even where a keyboard fallback exists (a11y, High/Medium)
The tap/`<select>` fallbacks are good, but the dnd-kit drag path (which keyboard users reach by default on desktop) often has no live announcements of pickup/drop, and in two cases advertises keyboard dragging it can't fulfill (focusable chips, non-focusable drop targets → dead-end).
- **Affected:** `drag-and-drop` (default desktop mode is the silent drag path), `categorization`, `anatomy-labeling` (dead-end KeyboardSensor), `sequence-steps` (move announced only via label change).
- **Fix:** pass dnd-kit `accessibility.announcements`/`screenReaderInstructions`, add an `announcerSlot` to the drag layer, and either wire real keyboard DnD on the droppables or remove `KeyboardSensor`/listeners so keyboard users are routed to the working fallback.

### S5 — Missing image load/error states (a11y/usability, Medium)
A broken/slow `image.src` (remote URLs are permitted) renders a broken-image glyph with interactive overlays floating over empty space, and the activity stays "answerable" — an unfair graded task with no recovery.
- **Affected:** `hotspot-2d`, `hotspot-3d`, `anatomy-labeling`, `image-annotation`, `image-comparison-slider`, `virtual-tour`, `interactive-video`.
- **Fix:** a shared `<MediaWithFallback>` that renders a `role="alert"` error panel on `onError` and an optional loading affordance; steer users to the keyboard fallback list and consider disabling submit when the media failed.

### S6 — `parseSuspend` can restore a "submitted" stage referencing an id that no longer exists → dead-end (bug, Low/Medium)
If config is edited between sessions, a restored `selectedHotspotId`/etc. resolves to `undefined`, leaving "submitted with no feedback, no Check button."
- **Affected:** `hotspot-2d`, `hotspot-3d` (and the same class of risk wherever suspend stores a selected id).
- **Fix:** validate restored ids against current config in `parseSuspend`; fall back to `answering` if absent.

### S7 — `tryAgain` resets to `initialState`, zeroing the persisted `attempts` counter (bug, Low)
Retry wipes the attempt count (and any restored attempts), so `attempts` never accumulates.
- **Affected:** `fill-in-the-blanks` (also re-reveals solutions on next submit — High), `highlight-text`, `lab-panel`, `image-annotation`.
- **Fix:** `setState((s) => ({ ...initialState, attempts: s.attempts }))`; reset `solutionsRevealed` explicitly in `tryAgain`.

### S8 — Submitted controls use the native `disabled` attribute → drop out of tab order, focus lost, review unreachable (a11y, Low/Medium)
After submit, keyboard/SR users can't Tab through the answers to read the per-item "correct/incorrect" review labels the components carefully build.
- **Affected:** `hotspot-2d`, `hotspot-3d`, `highlight-text` (and similar fieldset-disabled patterns).
- **Fix:** prefer `aria-disabled` + a no-op handler (the toggle reducers already guard on stage) so review state stays focusable; move focus to the results region on submit.

### S9 — `useEffect([config])` reset ignores `suspendData` changes and can clobber in-progress work in Studio Preview (bug, Low/Medium)
The reset effect keyed on `config` identity re-runs on any new config object (every Studio edit), discarding the learner's in-progress state; and a `suspendData` change without a `config` change is silently ignored (eslint-disabled deps).
- **Affected:** broadly — `multiple-choice`, `question-set`, `concept-map`, `flashcards`, `reflection-prompt`, `sequence-steps`, and others share this idiom.
- **Fix:** separate "external config reset" from suspend restoration; gate the reset on a content hash or explicit preview-edit signal rather than raw reference identity; read `suspendData` only in the initializer or include it intentionally.

### S10 — Hardcoded hex/rgb values bypass design tokens (design-system, Low–Medium)
Hard rule #1 forbids inventing color values. Several files use literal `#ffffff` on `--color-primary`, `rgb(123 67 36 / …)` (the literal primary), or raw success/error hex instead of tokens; some `*-soft` tokens are used without fallbacks.
- **Affected:** `question-set`, `hotspot-2d`, `image-annotation`, `anatomy-labeling`, `image-comparison-slider`, `quick-quiz`, plus `*-soft`-without-fallback in `fill-in-the-blanks`, `branching-scenario`, `video-reflection`, `reflection-prompt`, `highlight-text`.
- **Fix:** add `--color-on-primary` (and any missing soft tokens) to `docs/design-system.md`, then reference tokens with documented fallbacks. Verify contrast of every `*-soft` tint behind 13px badge text.

### S11 — Authored scoring config not threaded into the resolver (bug, High/Medium)
`behaviour.passPercentage` / `config.scoring` is dropped, so the authored pass threshold is silently ignored and pass/fail hard-codes to the 50% default.
- **Affected:** `interactive-video` (High — `resolveScoring` reads top-level `passPercentage`, schema nests it under `behaviour`), `osce` (Medium — `aggregate` never gets `config.scoring`).
- **Fix:** thread `config.behaviour?.passPercentage` / `config.scoring` into `resolveScoring`/`aggregate`, or flatten the schema. Add a test asserting a non-default threshold actually changes `success`.

### S12 — Live-only activities auto-pass in the async/SCORM path (usability/integrity, Low–High)
Every Live activity's engine surface posts SCORM `success: 1/1` on a single "Continue"/"Mark complete" click without participation. The Studio catalog suppression is Studio-only and does not gate engine/SCORM packaging.
- **Affected:** `confidence-meter`, `isometric-chatroom` (the stub literally posts a passing score — flagged High), `qa-board`, `quick-quiz`, `straw-poll`, `word-cloud`.
- **Fix:** for `live: true` kinds, render an engagement-only completion card that does **not** emit `success: true` (omit success / completion-only); drive catalog/launcher suppression from a single machine-readable manifest flag instead of duplicated string lists in `App.tsx` + `Preview.tsx`.

### S13 — Destructive Live resets use `window.confirm` (usability, Low)
Unstyled, not theme-aware, browser-suppressible, not focus-trapped.
- **Affected:** `confidence-meter`, `qa-board`, `quick-quiz`, `straw-poll`, `word-cloud`.
- **Fix:** a shared in-app confirm dialog consistent with the design system (Studio already has a `confirmReset` pattern to mirror).

---

## 4. Per-activity findings

Severity ∈ {Critical, High, Medium, Low}. Category ∈ {a11y, usability, bug, design-system}. Line numbers are from the audited revision on `feat/video-reflection`.

### multiple-choice — complete
- **[Medium]** a11y — Single-select offers no radio semantics / arrow-key nav (`Component.tsx:147-150,172-174`). Choices are `aria-pressed` toggle buttons in a `role="group"`; SR users hear "toggle button" not "radio, 1 of N" and can't arrow between options. Render `role="radio"`/`aria-checked` in a `role="radiogroup"` with roving tabindex when `!isMulti`.
- **[Medium]** a11y — Score `<output>` not announced on submit (`Component.tsx:227-230`). Add `aria-live`/`role="status"`. (See S2.)
- **[Medium]** bug — Multiple polite regions populate at once on submit (`Component.tsx:194-209`). (See S2.)
- **[Low]** bug — `Math.random()` shuffle is non-reproducible across mounts; reshuffles on count change only (`Component.tsx:63-66,76-84`). Seed deterministically.
- **[Low]** usability — Reveal `○` correct-but-unselected answers show no feedback text (`Component.tsx:194-208`) — the most teachable moment is blank.
- **[Low]** usability — Disabled Check gives no reason (S3).
- **[Low]** design-system — `.is-reveal` sets only border color; green `○` renders in body color (`Component.css:98-115`).

### fill-in-the-blanks — complete
- **[High]** bug — "Show solution" resets `attempts` and stays revealed after Try again (`Component.tsx:150,265`). After retry→resubmit, solutions auto-reveal. Preserve attempts; `setSolutionsRevealed(false)` in `tryAgain`. (S7)
- **[High]** a11y — Per-blank correctness not announced; only aggregate count (`Component.tsx:166,224`). Changed `aria-label` isn't reliably re-announced.
- **[Medium]** a11y — Weak empty-blank error identification (`Component.tsx:135,253`). (S3)
- **[Medium]** bug — Reveal shows only `accepts[0]` and desyncs from state (`Component.tsx:181`).
- **[Medium]** bug — A blank whose accepts parse to empty (`* *`, `*/*`) is unscoreable and reveals `""` (`schema.ts:60-63`). Validate ≥1 accept per blank.
- **[Medium]** usability — Levenshtein ≤1 fuzzy match is too loose for short medical tokens (CO2/DNA/K+) (`Component.tsx:59`). Scale threshold to length.
- **[Low]** usability — `widthCh` sized to longest alternate leaks answer length (`Component.tsx:183-186`).
- **[Low]** design-system — `*-soft` backgrounds lack fallbacks (`Component.css:86,91`). (S10)

### drag-and-drop — complete
- **[High]** a11y — Keyboard-drag path has no live announcements; desktop default mode *is* the silent drag path (`DragLayer.tsx:41-45`, `useInteractionMode.ts:38`). (S4)
- **[Medium]** usability — Silent rejection on capacity overflow / wrong-stage place (`state.ts:95`). Announce "Zone is full."
- **[Medium]** bug — single-point mode shows per-chip ✓/✗ while score is all-or-nothing → 3/4 right but scored 0 looks contradictory (`DnDActivity.tsx:216-243`).
- **[Medium]** a11y — Board `role="img"` can hide nested drop zones from AT (`DnDActivity.tsx:138-140`).
- **[Low]** a11y — Placed chip button announces only its label, not correct/incorrect (`Chip.tsx:113-117`).
- **[Low]** usability — No Escape-to-deselect though `deselect` reducer exists (`state.ts:79-80`).
- **[Low]** bug — Zones keep `tabIndex=0` when no chip is selected → dead Tab stops (`Zone.tsx:88-96`).
- **[Low]** usability — Default prompt says "tap Check"/"Drag" regardless of active mode (`DnDActivity.tsx:16-17`).

### question-set — partial
- **[High]** a11y — Focus never moves on question transitions (`Component.tsx:97-100,176`). (S1)
- **[High]** bug — `allAnswered` counts `max:0` children (enables Submit) while scoring skips them (`Component.tsx:93,113,151`). Gate "answered" on the same predicate as scoring.
- **[Medium]** bug — Navigating back re-mounts a blank, already-answered question; child state/feedback lost (`Component.tsx:176-189`). Persist & rehydrate child state.
- **[Medium]** bug — `useEffect([config])` reset races persistence and ignores `suspendData` (`Component.tsx:75-90`). (S9)
- **[Medium]** usability — Per-question feedback discarded on navigation (`Component.tsx:176`).
- **[Medium]** usability/a11y — Disabled Submit has no `aria-describedby` to its reason (`Component.tsx:202-225`). (S3)
- **[Low]** bug — Results mark "correct" only when `raw===max`, disagreeing with partial-credit scoring (`Component.tsx:251`).
- **[Low]** a11y — Results ✓/✗ are `aria-hidden` with no text equivalent (`Component.tsx:256-267`).
- **[Low]** bug — No overall score/percentage shown on the summary screen (`Component.tsx:235-273`).
- **[Low]** design-system — Hardcoded `#ffffff` on primary button (`Component.css:56`). (S10)

### hotspot-3d — complete
- **[High]** bug — GLTF resources never disposed on `config.model.src` change → GPU memory leak in Studio Preview (`Component.tsx:520`). Dispose/`useGLTF.clear` keyed on `src`.
- **[Medium]** bug — Schema/Component mismatch: `camera.mode`, `camera.initialDistance`, `ui.resetViewButton` accepted but never read (`schema.ts:60-62,118`). Authored framing silently ignored; no Reset-view control rendered.
- **[Medium]** a11y — Pre-submit selection not announced (`Component.tsx:140-175`).
- **[Medium]** a11y — 3D `<Html>` pins duplicate the fallback buttons → every option focusable twice (`Component.tsx:438` vs `:166`). `aria-hidden`/`tabindex=-1` the canvas pins.
- **[Medium]** bug — No guard for multiple/zero `correct: true` hotspots (`Component.tsx:77-80`). Add a schema `.refine` for exactly-one.
- **[Low]** a11y — Non-WebGL placeholder `role="img"` suppresses the helpful inner instruction (`Component.tsx:304-312`).
- **[Low]** bug — Suspend can restore submitted with a now-missing hotspot id → dead-end (`Component.tsx:530-546`). (S6)
- **[Low]** a11y — Submitted `<fieldset disabled>` drops revealed answers from tab order (`Component.tsx:140`). (S8)
- **[Low]** design-system — On-canvas pins `min-height:32px` < 44 (`Component.css:199`).

### virtual-tour — partial
- **[High]** a11y — Camera look is pointer-only; WASD translates but nothing turns the view → keyboard user can walk into a wall with no recourse (`Component.tsx:400-473,367-377`). Add yaw keys or de-emphasize the 3D view for keyboard users.
- **[High]** a11y — No `prefers-reduced-motion` handling for camera motion (vestibular trigger) (`Component.tsx:367-377`).
- **[High]** usability — No loading/error state for the GLB (`<Suspense fallback={null}>`) → permanently blank dark canvas on slow/404 (`Component.tsx:287-289`). (S5)
- **[Medium]** bug — `vt-overlay-title` id hardcoded, collides across instances (`Component.tsx:173-175`). Use `useId()`.
- **[Medium]** a11y — Overlay `role="dialog"` not modal, no focus trap (`Component.tsx:172-215`).
- **[Medium]** bug — Stale `submit` closure in visit-all auto-submit effect (`Component.tsx:114-120`).
- **[Medium]** usability — No "where am I"/reset-view/scene-count cue in the 3D view (`Component.tsx:278-307`).
- **[Low]** a11y — Occlusion ("behind wall") signaled by opacity/color only (`HotspotPin.css:95-99`).
- **[Low]** a11y — `autoPlay` audio in overlay risks WCAG 1.4.2 (`Component.tsx:206`).
- **[Low]** bug — Spawn position honored but not spawn facing; learner may spawn facing away from all hotspots (`Component.tsx:283,404-414`).
- **[Low]** usability — Hint text white-on-translucent over arbitrary scene can fail contrast (`Component.css:36-49`).

### interactive-video — partial
- **[Critical]** a11y — No captions/subtitles support (`schema.ts:6-12`, `Component.tsx:282-295`). Add a `tracks` field and render `<track kind="captions">`.
- **[High]** a11y — Overlay receives no focus when it appears; no trap/Escape (`Component.tsx:298-331`). (S1)
- **[High]** bug — Authored `behaviour.passPercentage` ignored; always default 50 (`Component.tsx:158`, `scoring.ts:56`). (S11)
- **[High]** a11y — Overlay appearance not announced (not in a live region, no focus move) (`Component.tsx:298-344`).
- **[Medium]** bug — Seek-back loop fights deliberate scrubbing with no explanation (`Component.tsx:204-218`).
- **[Medium]** bug — `handleTimeUpdate`/`handleEnded` read `state` from a stale closure → possible re-trigger of an answered interaction within the 0.5s window (`Component.tsx:194-219`).
- **[Medium]** a11y — No `onError`/loading state for the video (`Component.tsx:282-296`). (S5)
- **[Medium]** usability — No skip/close for non-required interactions; Resume is the only exit (`Component.tsx:320-327`).
- **[Low]** a11y — Overlay `aria-label` is a bare timestamp, not the question (`Component.tsx:303`).
- **[Low]** usability — YouTube/Vimeo validate but render "not supported"; no interactions fire (`schema.ts:9`, `Component.tsx:276-280`).
- **[Low]** design-system — Overlay clips a tall embedded activity at 200% zoom inside the 16:9 stage (`Component.css:66-76`).
- **[Low]** a11y — No `:focus-visible` on Resume/Try-again (`Component.css:92-141`).

### video-reflection — complete
- **[Critical]** bug — No `MediaRecorder`/`getUserMedia` feature guard; camera turns on then `new MediaRecorder` throws (`Component.tsx:257,291`). Add a `MEDIA_RECORDER_SUPPORTED` gate mirroring `SCREEN_SHARE_SUPPORTED`.
- **[High]** bug — Unmount cleanup revokes a stale `blobUrl` via empty-dep effect → real object-URL leak after recording (`Component.tsx:194-210`). Use a `blobUrlRef`.
- **[High]** a11y — Recording state changes unreliably announced; timer updates 4×/sec inside the live region (`Component.tsx:539-572`). (S2)
- **[Medium]** a11y — Max-duration auto-stop has no "N seconds remaining" warning (`Component.tsx:282-286`).
- **[Medium]** usability — Re-record discards the take with no confirmation (`Component.tsx:365-377`).
- **[Medium]** bug — Submit gate is `title`-only on a disabled button (`Component.tsx:612-624`). (S3)
- **[Medium]** a11y — Recorded `<video>` has no captions/transcript path (`Component.tsx:527-536`).
- **[Low]** bug — Persist effect writes `{stage:"submitted"}` clobbering the richer submit payload → reload sends learner back to `idle`, losing completion (`Component.tsx:214-217`).
- **[Low]** a11y — Error status should be `role="alert"`, not polite (`Component.tsx:547-550`).
- **[Low]** design-system — `--color-success-soft` confirmation bg has no fallback (`Component.css:267`).
- **[Low]** usability — Front/Back camera radios always shown even with one webcam (`Component.tsx:460-480`).

### audio-recording — complete
- **[High]** bug — No `MediaRecorder`/`getUserMedia` guard; on non-secure `http://`, `navigator.mediaDevices` is undefined → `TypeError` (`Component.tsx:218-221`). Gate + secure-context message.
- **[High]** bug — Stale-closure blob-URL leak on unmount (`Component.tsx:175-192`). Use a ref. (mirrors video-reflection)
- **[Medium]** usability — Re-record discards with no confirm (`Component.tsx:286-296`).
- **[Medium]** a11y — Per-second timer inside the `role="status"` live region (`Component.tsx:414-419`). (S2)
- **[Medium]** bug — `submit` re-`fetch`es the `blob:` URL (can be CSP-blocked in LMS iframes) instead of using the held Blob (`Component.tsx:320-322`).
- **[Low]** bug — `requesting-mic` stage has no Cancel; can wedge if the prompt hangs (`Component.tsx:216`).
- **[Low]** usability — Submit-disabled-below-min has no explanation (`Component.tsx:498`). (S3)
- **[Low]** a11y — White-on-`#c34132` Stop button ~4.0:1, borderline for 15px text (`Component.css:101-104`).
- **[Low]** bug — Dead no-op `onRecordKeyDown` handler (`Component.tsx:360-367`).
- **[Low]** usability — Error-recovery button hardcodes "Try Again" while other labels are configurable (`Component.tsx:473`).

### anatomy-labeling — complete
- **[High]** a11y — No image load/error state (`Component.tsx:215-220`). (S5)
- **[High]** a11y — Sample alt text describes the placeholder, not anatomy; targets expose only an index ("Target 3: empty") (`samples/basic.json:8`). Add authoring guidance + per-target position text.
- **[Medium]** a11y — Chips advertise keyboard drag (`KeyboardSensor` + listeners) but droppables are non-focusable → dead-end (`Component.tsx:76,351`). (S4)
- **[Medium]** a11y — Placement and bump-back-to-tray not announced (`Component.tsx:88-103`).
- **[Medium]** usability — Submit can be enabled with a missing/broken image (`Component.tsx:161,304`).
- **[Low]** usability — No show-solution on the image layer (correction only in the fallback list) (`Component.tsx:293-310`).
- **[Low]** a11y — No `:focus-visible` styling (`Component.css`).
- **[Low]** a11y — Placed chip duplicates the target's accessible name (`Component.tsx:362-366`).
- **[Low]** bug — Tray reshuffle is unseeded → non-deterministic across reloads vs persisted state (`Component.tsx:187-195`).
- **[Low]** design-system — Hardcoded `#ffffff` on state colors (`Component.css:94,100-107`). (S10)

### categorization — complete
- **[High]** a11y — No `aria-live` for drag pickups/drops; KeyboardSensor path is silent (`Component.tsx:218-224,80-96`). (S4)
- **[Medium]** bug — Unseeded `Math.random` shuffle reshuffles on unrelated config edits and after restore (`Component.tsx:149-158`). (S9)
- **[Medium]** a11y — Placed/tray chips expose no state/location name to SR (`Component.tsx:322-378`).
- **[Medium]** usability — `enableSolutionsButton` resolved but no Show-solution rendered (`Component.tsx:250-267`). Dead code or missing feature.
- **[Low]** a11y — Drag affordance is `cursor:grab` only; fallback discoverability requires scrolling (`Component.css:119`).
- **[Low]** a11y — No `:focus-visible` on chips/bins (`Component.css`).
- **[Low]** usability — Pre-submit, disabled Check has no "2 items still in tray" hint (`Component.tsx:128`). (S3)

### matching-pairs — complete
- **[High]** bug — Correctness is `leftId === rightId`; duplicate `right.text` becomes ambiguous/unmatchable (no "many lefts → one shared right answer") (`schema.ts:14-32`, `Component.tsx:163`). Add a `matchId` or enforce unique right text.
- **[Medium]** a11y — Two competing live regions on submit (`Component.tsx:204-215,271-275`). (S2)
- **[Medium]** a11y — Right buttons inert until a left is selected, with no `aria-disabled`/cue (`Component.tsx:120-122,311`).
- **[Medium]** a11y — Pair badge number `aria-hidden`; spoken `(N)` could desync from the rendered badge (`Component.tsx:253-255`).
- **[Low]** usability — `enableSolutionsButton` unused; only inline reveal + Try again (`Component.tsx:343-347`).
- **[Low]** a11y — Bare `<output>` "3 / 5" has no label and isn't live (`Component.tsx:340-342`).
- **[Low]** design-system — `--radius-pill:4px` fallback renders the badge square (`Component.css:133`).

### sequence-steps — complete
- **[High]** a11y — Reorder moves not announced (live region only emits the score) (`Component.tsx:249-262`). (S2/S4)
- **[High]** a11y/usability — Focus lost after a nudge-button move when the button becomes disabled at an end (`Component.tsx:129-136,364-383`). Refocus the moved row.
- **[Medium]** bug — Reset effect ignores `suspendData` changes (`Component.tsx:114-117`). (S9)
- **[Medium]** usability — `tryAgain` reshuffles even when `randomize:false` (`Component.tsx:183-189`).
- **[Medium]** a11y — Drag handle + Up/Down buttons not grouped/associated as alternatives (`Component.tsx:335-383`).
- **[Low]** a11y — Verify `--color-error-soft` badge text contrast at 13px/700 (`Component.css:158-161`).
- **[Low]** usability — Submit never disabled (acceptable for sequencing — informational) (`Component.tsx:272-275`).
- **[Low]** bug — `DragOverlay` ghost shows a stale pre-drag index (`Component.tsx:238-244`).

### hotspot-2d — complete
- **[High]** bug — Only a single correct hotspot is supported despite "region(s)" framing; multiple `correct:true` is undefined behavior (`schema.ts:33-45`, `Component.tsx:53-78`). Constrain schema or implement multi-select.
- **[High]** a11y — Submitted buttons use `disabled` → focus lost, feedback may not announce (`Component.tsx:121,147`). (S8)
- **[Medium]** a11y — Small rects (`h:0.05`) yield sub-44px pointer targets (`Component.tsx:131-136`, `samples/basic.json:28`).
- **[Medium]** a11y — Pre-submit selection not announced (`Component.tsx:60-63`).
- **[Medium]** design-system — Hardcoded `rgb(123 67 36 / …)` and white-at-0.85 label bg (`Component.css:49,64,69,95`). (S10)
- **[Medium]** a11y — No image load/error handling (`Component.tsx:98-103`). (S5)
- **[Low]** a11y — Overlay correct/incorrect conveyed by color/shadow only; fallback list has icons but the image doesn't (`Component.css:73-89`).
- **[Low]** usability — Feedback animates `min-height` 0→28 → layout shift (`Component.css:162-176`).
- **[Low]** bug — Suspend can restore submitted with a missing hotspot id → dead-end (`Component.tsx:84-86`). (S6)

### image-annotation — partial (functional but inaccessible core)
- **[Critical]** a11y — No keyboard path to place/draw/erase; all on `onPointerDown/Move/Up` (`Component.tsx:323-368`). WCAG 2.1.1 Level A failure. Add focusable add-shape controls + arrow-key nudge/resize or coordinate entry.
- **[High]** a11y — `role="application"` canvas labeled only "Drawing canvas", nothing inside operable (`Component.tsx:335-336`).
- **[High]** a11y — Grading result never announced; `<output>` not live (`Component.tsx:408-411`).
- **[High]** bug — `tryAgain` re-enables resubmit, overwriting the prior SCORM score with no lock/confirm (`Component.tsx:252-254`).
- **[Medium]** bug — `scoring.enableRetry` read but schema defines `behaviour.enableRetry`; `behaviour` is dead config (`Component.tsx:412`, `schema.ts:52-58`).
- **[Medium]** a11y — No image load/error handling (`Component.tsx:311-316`). (S5)
- **[Medium]** bug — IoU scoring ignores freehand/arrow and treats a circle as its bounding box → mis-grades lesion marking (`Component.tsx:544-558`).
- **[Medium]** usability — No undo; "Clear all" instantly wipes with no confirm (`Component.tsx:237-240,296-307`).
- **[Low]** bug — Whole shape `<ul>` is `aria-live` → verbose re-announcements (`Component.tsx:371`).
- **[Low]** bug — Suspend hard-codes `tool:"rectangle"` (maybe disabled) and fragile id-counter parse (`Component.tsx:606,108`).
- **[Low]** a11y — No `:focus-visible` on tool buttons (`Component.css`).
- **[Low]** design-system — Hardcoded `rgb(123 67 36 / 0.1)` fill (`Component.css:117`). (S10)

### image-comparison-slider — complete (one of the cleanest)
- **[Medium]** a11y — Before/After identity invisible to SR; both captions `aria-hidden`, `aria-valuetext` is bare `%` (`Component.tsx:235-240`). Describe sides in `aria-valuetext`.
- **[Medium]** a11y — No image load/error state (`Component.tsx:190-203`). (S5)
- **[Medium]** a11y — Click-to-jump position not announced for non-slider focus; `onWrapperClick` typed as PointerEvent but bound to `onClick` (type smell) (`Component.tsx:109-120,163`).
- **[Low]** bug — Keyboard handler reads `state.position` (stale closure risk) instead of a functional updater (`Component.tsx:123-151`).
- **[Low]** a11y — `aria-valuenow` rounds while position is a float → up to ~0.5% mismatch (`Component.tsx:163,217`).
- **[Low]** usability — `prefers-reduced-motion` block is dead (no transition declared) (`Component.css:222-227`).
- **[Low]** usability — `initialPosition` semantics ("0 = full after") are unintuitive vs the handle position (`schema.ts:33-34`).
- **[Low]** design-system — Grip arrows use literal `font-size:18px` (`Component.css:127`). (S10)

### flashcards — complete
- **[High]** a11y — Card flip/content change never announced; `cardLiveId` assigned but never referenced by any live region (`Component.tsx:273-277,216-242`).
- **[High]** a11y — Each face is `aria-hidden` when not active; combined with the missing live region, a flipped answer is in the tree but nothing surfaces it (`Component.tsx:262,275`).
- **[Medium]** a11y — Reduced-motion read once at render, no `change` listener (`Component.tsx:185-188`).
- **[Medium]** a11y — Flip-cue/hint/face-label 13px secondary text borderline on tip-bg gradient; verify ≥4.5:1 (`Component.css:262-268`).
- **[Medium]** usability — Custom `ui.nextButton` label shows on the front (reveal) button — mislabeled (`Component.tsx:136,313-314`).
- **[Medium]** bug — `practiceAgain` can be clobbered by the resume effect in Studio Preview (`Component.tsx:201-204`). (S9)
- **[Low]** a11y — `aria-pressed` on a momentary flip conflates "flipped" with "pressed" (`Component.tsx:253-255`).
- **[Low]** usability — No mid-deck restart/reshuffle; only post-completion (`Component.tsx:201-337`).
- **[Low]** bug — A truncated persisted `queue` can leave cards unreachable yet `completed:false` → stuck deck (`Component.tsx:343-376`).
- **[Low]** design-system — Card-stack pseudo-elements use undocumented rotate/inset/shadow values (`Component.css:112-128`). (S10)

### highlight-text — complete
- **[Medium]** a11y — Short word tokens fall below 44px width (`min-height` only) (`Component.css:57-66`). Add `min-width:44px` or document the inline-exception.
- **[Medium]** a11y — No live selection-count announcement during answering (`Component.tsx:167`). (S2/S3)
- **[Low]** usability — Score percentage computed but never shown (`Component.tsx:197-200`).
- **[Low]** usability — Authored band message is the less-prominent string vs a generic error line (`Component.tsx:174-180`).
- **[Low]** bug — `tryAgain` zeroes `attempts` (`Component.tsx:100`). (S7)
- **[Low]** a11y — Submitted tokens `disabled` → review labels unreachable by Tab (`Component.tsx:144`). (S8)
- **[Low]** design-system — `*-soft` tokens used without fallback (`Component.css:94,99,104`). (S10)

### crossword — complete
- **[High]** a11y — Cell `aria-label` is "Row 1, column 2" with no clue context (e.g. "3 Across, cell 2 of 5") (`Component.tsx:514`).
- **[High]** a11y — Per-cell correctness not conveyed to SR (`aria-label` overrides the sr-only status span; marks are `aria-hidden`) (`Component.tsx:491-501,514`).
- **[Medium]** a11y — Live region announces on every keystroke (`Component.tsx:427-441`). (S2)
- **[Medium]** bug — `behaviour.enableRetry` in schema but never wired; post-submit is permanently locked (`schema.ts:58`).
- **[Medium]** usability — Reshuffle comment says it carries correct/revealed entries forward but wipes them with no confirm (`Component.tsx:320-329`).
- **[Medium]** usability — Progress counts revealed cells as "correct" but submit excludes them → "8 of 8" then submits 5/5 (`Component.tsx:344-401`).
- **[Low]** a11y — `:focus` instead of `:focus-visible` on the active cell (`Component.css:179-182`).
- **[Low]** design-system — 10px low-contrast clue numbers are load-bearing info (`Component.css:144-153`).
- **[Low]** usability — Across↔down toggle not announced (`Component.tsx:235-256`).

### concept-map — complete
- **[High]** a11y — No discoverable keyboard-only way to create an edge; only a mouse-centric two-click flow (`Component.tsx:215-231,514-520`). Add a non-spatial "connect X to Y" control.
- **[High]** a11y — Correct/incorrect conveyed by color/stroke-width only; node/edge `aria-label`s not updated with correctness (`Component.tsx:545-575,613-628`). (Hard rule #4)
- **[Medium]** a11y — Edge handle `role="button"` ignores Enter/Space (only Delete/Backspace) (`Component.tsx:590-605`).
- **[Medium]** a11y — `role="application"` canvas with no documented keyboard model; new edges land in a non-live off-screen list (`Component.tsx:532-538`).
- **[Medium]** usability — Delete / "Clear all" act immediately, no confirm/undo (`Component.tsx:184-199,341-347`).
- **[Medium]** bug — Submit allowed with only seed nodes → completion-only scores 1/1 having done nothing (`Component.tsx:419-424,700-705`).
- **[Medium]** bug — Persist drops `attempts`/`stage`; resume after submit reopens the answering stage (`Component.tsx:112-115,798-848`). (S9-adjacent)
- **[Low]** bug — Deleted seed nodes never return; seed/palette id collision makes a concept unplaceable (`Component.tsx:184-193`).
- **[Low]** usability — Free-text/keyboard-added nodes all spawn stacked at (0.5,0.5) (`Component.tsx:145-154`).
- **[Low]** a11y — `white-space:nowrap` nodes with no max-width clip long terms at 200% zoom (`Component.css:182-199`).
- **[Low]** design-system — Edge selection cue is a 2px→4px stroke-width change only (`Component.css:140-143`).
- **[Low]** usability — `useEffect([config])` reset can wipe in-progress work in Preview (`Component.tsx:103-110`). (S9)

### branching-scenario — complete
- **[Critical]** a11y — No focus move/announcement on node transition; the focused choice unmounts, focus drops to `<body>`, new prompt not in a live region (`Component.tsx:114-130,161`). (S1)
- **[High]** a11y — New choice buttons not announced; feedback row shows the *previous* choice (`Component.tsx:163-194`).
- **[High]** usability — No progress/path orientation despite tracking `state.path` (`Component.tsx:154-244`).
- **[Medium]** usability — No "back"/undo control; design intent undocumented (`Component.tsx:132-135`).
- **[Medium]** a11y/bug — Choice `feedback` re-derived from `currentNode.choices` after navigation → resolves null; authored per-choice feedback effectively never shown (`Component.tsx:116-141`).
- **[Low]** bug — Cyclic graphs can loop forever; `state.path` grows unbounded → SCORM `suspend_data` 4096 overflow (`schema.ts:97-123`).
- **[Low]** a11y — Newly-mounted outcome live region may not announce (`Component.tsx:211-218`).
- **[Low]** a11y — Choice `aria-label={htmlToText(...)}` can diverge from rendered text (`Component.tsx:181`).
- **[Low]** usability — `is-active` highlight can persist onto an unrelated node after navigation (`Component.tsx:170,177`).
- **[Low]** design-system — `*-soft` tokens without fallback (`Component.css:83,122,127`). (S10)

### ddx-tree — complete
- **[High]** a11y — No focus management/announcement on node navigation (`Component.tsx:113-131`). (S1)
- **[Medium]** a11y — Component-level `:focus-visible` dropped vs the sibling `branching-scenario` (`Component.css`).
- **[Medium]** a11y — Choices use a bare `role="group"` (removes list semantics) with no progress/orientation (`Component.tsx:203`).
- **[Medium]** bug — Stale `lastChoiceId` carries across nodes; an id collision shows unrelated feedback on arrival (`Component.tsx:138-151`).
- **[Medium]** a11y — Freshly-mounted `aria-live` verdict panel may not be announced (`Component.tsx:232-246`).
- **[Low]** usability — No single-step "back" (only full restart) (`Component.tsx:133-136`).
- **[Low]** usability — Broken-`nextNodeId` is dead code but its message is learner-facing (`Component.tsx:117-122`).
- **[Low]** a11y — Running "Case so far" additions not announced (`Component.tsx:177-195`).

### lab-panel — complete
- **[High]** a11y — `role="radiogroup"`/`role="radio"` with no arrow-key nav or roving tabindex (`Component.tsx:282-332`). Implement the APG pattern or drop the radio roles.
- **[Medium]** a11y — Score result not announced (`<output>` not live) (`Component.tsx:362-367`). (S2)
- **[Medium]** a11y — Flag `aria-label` duplicates info; "H"/"L" glyphs have no `<abbr>`/title for sighted users (`Component.tsx:249-256`).
- **[Medium]** usability/a11y — `.is-reveal` (correct-but-unselected) reuses success styling; only a faint `○` differentiates it from a correct pick (`Component.tsx:323-326`, `Component.css:313-326`).
- **[Medium]** bug — A correctly-left-normal row gets a red `is-incorrect` look adjacent to the red abnormal flag — hard to tell "I was wrong" from "value is abnormal" (`Component.tsx:184-196`).
- **[Low]** bug — Correctly-left-normal row renders an empty icon → correctness is color-only there (`Component.tsx:232-240`).
- **[Low]** bug — No value-vs-range validation; `flag`/`isAbnormal`/`reference` can silently disagree (`schema.ts:24-40`). Add a `.refine`.
- **[Low]** usability — `tryAgain` discards `attempts` (`Component.tsx:144`). (S7)
- **[Low]** a11y — Wide 4-column table has no `overflow-x` wrapper for 200% zoom (`Component.css:58-60`).

### osce — complete
- **[High]** a11y — No focus/announcement on phase change (`Component.tsx:97,141-187`). (S1)
- **[High]** usability — Missed correct actions are never revealed after submit (feedback only for selected) (`Component.tsx:197-244`). Major pedagogical gap for a clinical assessment.
- **[Medium]** bug — `success` uses the 50% aggregate default; `config.scoring` never threaded into `aggregate` (`Component.tsx:118-124,374,397`). (S11)
- **[Medium]** usability — Order-bonus points are free in linear (non-skip) mode (`Component.tsx:380-395`).
- **[Medium]** a11y — Multiple simultaneous live regions on submit (`Component.tsx:237,249,271`). (S2)
- **[Low]** a11y — Action state glyphs `aria-hidden`; "selected" vs "correct" differ only by a small glyph/color visually (`Component.tsx:226-228`).
- **[Low]** usability — Stepper "visited" vs "current" differ only by background color (`Component.css:95-103`).
- **[Low]** bug — `htmlToText` (new `DOMParser` per call) runs per action per render (`Component.tsx:213`).
- **[Low]** usability — No overall pass/fail or band message shown (`Component.tsx:262-276`).

### reflection-prompt — complete
- **[High]** bug — Long reflections silently truncated at the SCORM 4096-char cap (`packages/core/src/scorm.ts:68-73`). This is the one activity designed for long prose; submitted text is lost on reload with only a `console.warn`. Add a `maxWords`/`maxChars` cap + visible "too long to save" error.
- **[Medium]** usability — Disabled Submit gives no announced "X more words" reason (`Component.tsx:157`). (S3)
- **[Medium]** a11y — Textarea has three competing accessible names; the prompt itself isn't in the name/description (`Component.tsx:108-121`).
- **[Medium]** bug — Empty→filled `role="status"` swap can miss the post-submit announcement; two polite regions update at once (`Component.tsx:140-151`).
- **[Low]** usability — No "edit after save"; submit is terminal with no confirm (`Component.tsx:86-97`).
- **[Low]** bug — `config`-change effect can clobber in-progress typing in Preview (`Component.tsx:62-65`). (S9)
- **[Low]** usability — Word count announces on every keystroke (`Component.tsx:123-128`). (S2)
- **[Low]** design-system — `--color-success-soft` without fallback (`Component.css:104`). (S10)

### confidence-meter — Live-only (real Live runtime; engine is a labeled preview)
- **[High]** a11y — Slider exposes no `aria-valuetext`; unit/low/high labels invisible to AT (`ConfidenceMeterLive.tsx:144-154`).
- **[High]** a11y — Histogram distribution has no accessible representation (bars `aria-hidden`) (`ConfidenceMeterLive.tsx:229-247`). The distribution is the whole point.
- **[Medium]** a11y — Histogram updates not announced (`ConfidenceMeterLive.tsx:220`).
- **[Medium]** usability/bug — "live" vs "revealed" distribution differs by bar fill color only (`ConfidenceMeterLive.tsx:114-116`). (Hard rule #4)
- **[Medium]** design-system — Sample lives in forbidden `apps/live-mode/public/samples/...` (CLAUDE.md violation) and ships a static `adminKey` (`apps/live-mode/public/samples/confidence-meter/basic.json`). Move into the bundle; placeholder the key.
- **[Low]** bug — Degenerate `min===max` scale dumps all ratings into bin 0; add a `.refine(max>min)` (`schema.ts:22-32`).
- **[Low]** bug — Unused `useState` import (`ConfidenceMeterLive.tsx:1`).
- **[Low]** usability — Reset uses `window.confirm` (`ConfidenceMeterLive.tsx:46`). (S13)

### isometric-chatroom — stub (engine) / complete (Live "Pixel Chat")
- **[High]** usability — Engine stub renders a generic placeholder with no activity identity; `kind` isn't passed so even the meta description never shows (`Component.tsx:15-16`, `activity-host.tsx:127-135`).
- **[High]** bug — Placeholder posts SCORM `success:1/1` for doing nothing; the Studio suppression doesn't gate engine/SCORM packaging (`StubActivity.tsx:46-54`). (S12)
- **[Medium]** usability — No `samples/` fixture at all (`packages/activities/isometric-chatroom/`).
- **[Medium]** a11y — "In design" status is a styled badge, not announced (`StubActivity.tsx:30`).
- **[Low]** design-system — Three names for one activity (slug vs "Pixel Chat (Live)" vs starter "Discussion Chatroom") (`meta.ts:4`).
- **[Low]** usability — Suppression is hand-maintained in two apps; derive from a manifest flag (`App.tsx:91-99`, `Preview.tsx:252-260`). (S12)

### qa-board — Live-only (engine is a labeled preview)
- **[High]** a11y — New questions / vote changes never announced; the `<ol>` updates silently (`QABoardLive.tsx:239`).
- **[Medium]** a11y — `.kukui-qa__action` (Mark answered/Reopen) ~26px tall, below 44px (`LiveCommon.css:313`).
- **[Medium]** a11y — Question `<textarea>` has no visible label (placeholder + `aria-label` only) (`QABoardLive.tsx:162`).
- **[Medium]** a11y — Char/quota counter not announced; disabled-Post reason silent (`QABoardLive.tsx:174,183`).
- **[Low]** usability — Reset uses `window.confirm` (`QABoardLive.tsx:67`). (S13)
- **[Low]** usability — Engine "Continue" reports completion without participation (`LivePreviewCard.tsx:53`). (S12)

### quick-quiz — Live-only (engine is a labeled preview; exposed in catalog)
- **[High]** a11y — Student result tallies update with no live-region summary (`QuickQuizLive.tsx:233-271`).
- **[High]** a11y — Instructor distribution + connected/answer counts not announced (`QuickQuizLive.tsx:125-155`).
- **[Medium]** a11y — Choice `<fieldset>` has no `<legend>`/prompt association (`QuickQuizLive.tsx:234-271`).
- **[Medium]** a11y — `window.confirm` reset dialog (`QuickQuizLive.tsx:113-117`). (S13)
- **[Medium]** usability — No timer; a distracted instructor can leave a question open indefinitely (deliberate design — flag in spec) (`QuickQuizLive.tsx:163-208`).
- **[Low]** design-system — Hardcoded `#2e6e41`/`#c34132` result colors bypass tokens (`LiveCommon.css:359-388`). (S10)
- **[Low]** a11y — Mis-picked tile has no non-color "incorrect" marker (correct gets a ✓) (`QuickQuizLive.tsx:238-253`).
- **[Low]** usability — Engine "Continue" grants free completion (`Component.tsx:20-37`). (S12)

### straw-poll — Live-only (engine is a thin read-only card; exposed in catalog)
- **[High]** bug — `live.turn` referenced in `docs/turn-server.md:89` is absent from the `.strict()` `live` schema → following the doc produces JSON that fails validation (`schema.ts:99-124`).
- **[Medium]** a11y — Engine stub Continue button has no `:focus-visible` (`Component.css:105-119`).
- **[Medium]** usability — Engine stub renders choices as non-interactive yet button-like (affordance trap) (`Component.tsx:42-56`).
- **[Medium]** bug — Reset uses `window.confirm` (`StrawPollLive.tsx:110`). (S13)
- **[Low]** bug — `revealButton`/`submitVoteButton` label overrides are schema'd but never consumed (`StrawPollLive.tsx:103-106`).
- **[Low]** usability — Closing a poll is effectively terminal; only Reset (which clears votes) goes back (`StrawPollLive.tsx:109-164`).
- **[Low]** a11y — Live tally bars update silently to AT (`StrawPollLive.tsx:298-313`). *(Division-by-zero is correctly guarded.)*

### word-cloud — Live-only (engine is a labeled preview)
- **[Critical]** a11y — Cloud is a single `role="img"` with only a total-count label; words + frequencies unreadable by SR (`WordCloudLive.tsx:242`). Render `role="list"`/`listitem` with each item's name including its count.
- **[High]** a11y — Frequency encoded by font size with no programmatic alternative (`WordCloudLive.tsx:245`). (Resolved together with the list fix.)
- **[High]** a11y — Smallest words 14px / count badge ~10px, below readable minimum (`WordCloudLive.tsx:245`, `LiveCommon.css:193`).
- **[Medium]** a11y — New submissions not announced (`WordCloudLive.tsx:201`).
- **[Medium]** usability — Cloud re-sorts/re-flows on every submission → jarring (`WordCloudLive.tsx:223-228`). Add a stable secondary sort key.
- **[Medium]** a11y — No reduced-motion handling for the re-flow (`LiveCommon.css:171`).
- **[Medium]** bug — `remove(s)` deletes the last string match, not the clicked duplicate index (`useWordCloud.ts:56-67`).
- **[Low]** bug — Caps (`maxSubmissions`/`maxWords`/`maxChars`) enforced only in the UI, not the CRDT hook (`useWordCloud.ts:43-54`).
- **[Low]** usability — Reset uses `window.confirm` (`WordCloudLive.tsx:57`). (S13)
- **[Low]** usability — Engine "Continue" grants free completion (`Component.tsx:14`). (S12)

---

## 5. Recommended remediation order

**Tier 1 — legal/ship blockers (do first):**
1. `interactive-video` captions (WCAG 1.2.2 — Critical).
2. `image-annotation` keyboard drawing path (WCAG 2.1.1 — Critical).
3. `branching-scenario` (and the S1 cohort) focus management.
4. `video-reflection` + `audio-recording` `MediaRecorder`/`getUserMedia` guards and blob-URL leak fix.
5. `word-cloud` cloud as a readable list (Critical) and the §S12 engine auto-pass for all Live kinds.

**Tier 2 — systemic, high leverage (shared helpers):**
6. S1 focus-on-transition helper, S2 single-live-region + timers-out-of-live-regions, S3 submit-gate hint, S4 dnd announcements.
7. S5 shared `<MediaWithFallback>`, S6 suspend-id validation, S11 scoring-config threading (+ regression tests).

**Tier 3 — correctness & polish:**
8. S7 (attempts), S8 (`aria-disabled` over `disabled`), S9 (config-vs-suspend reset), S10 (token hygiene), S13 (in-app confirm).
9. Per-activity Mediums/Lows from §4.

**Process suggestions:**
- Add a CI a11y smoke test (axe-core via Playwright) that loads each activity's `basic.json` and asserts: no positive-tabindex, every interactive element has an accessible name, exactly one results live region, and no `disabled` controls after submit where review text exists.
- Add a unit test per scored activity asserting a non-default `passPercentage`/`scoring` actually changes `success` (would have caught S11).
- Decide and document the Live-only engine contract (engagement-only completion, no `success:true`) and enforce it via the manifest `live` flag rather than per-app suppression lists.
