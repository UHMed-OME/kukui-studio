# Curated component index — forever-ai-components → Kukui activities

A reference shelf of motion/interaction techniques, mapped to Kukui's 7 activity
types. **Read these for ideas; never import them.** Each is vanilla HTML with inline
hex — see `NOTICE.md` for why and how to port to tokens + React.

Legend: `cheap/medium/heavy` = perf tier · `kb` = source size · a11y flags from upstream
metadata (`aria`, `kbd` = keyboard, all are reduced-motion + seizure-safe).

---

## Multiple Choice — selectable options + selected/correct/incorrect states

The whole game here is **layout-stable selection** (Hard Rule #2): the fill/outline
techniques below change color without reflowing, which is exactly what we want.

| File | Technique to steal | Port notes |
|---|---|---|
| [buttons/06-jelly-press.html](buttons/06-jelly-press.html) — Jelly Press · css-only, cheap, 4kb | Elastic spring squash on press as a tactile "this is selectable" cue | Spring transform only; keep border width constant across states. Map gradient → `primary`/`primary-soft`. |
| [buttons/08-sliding-fill.html](buttons/08-sliding-fill.html) — Sliding Fill · css-only, cheap, 4kb | Gradient fill sweeps in to mark the *selected* answer; text flips to dark | Ideal "selected" state — fill is additive, no reflow. Drive from React `selected` prop, not the loop. |
| [buttons/07-stroke-draw-outline.html](buttons/07-stroke-draw-outline.html) — Stroke-Draw Outline · svg+css, cheap, 5kb, aria | Self-drawing SVG outline for focus/selected emphasis | Outline draws *inside* reserved space — good for selected ring without layout shift. |
| [inputs-switches/06-radio-ripple.html](inputs-switches/06-radio-ripple.html) — Radio Ripple · raf, medium, 4kb, aria | Single-select radio with ripple confirm pulse | Use for single-answer MC. Ripple = the "color + motion" pairing beyond raw color (Rule #4). |
| [inputs-switches/05-checkbox-morph.html](inputs-switches/05-checkbox-morph.html) — Checkbox Morph · raf, medium, 4kb | Checkmark-stroke draw on toggle for multi-select MC | Checkmark is a non-color signal (Rule #4). Add the missing aria-checked when porting. |

## Question Set — progress across questions + success feedback

| File | Technique to steal | Port notes |
|---|---|---|
| [progress-status/01-linear-determinate.html](progress-status/01-linear-determinate.html) — Linear Progress · raf, medium, 8kb, aria | Determinate bar with percent readout + tick scale | Question N-of-M progress. Numeric readout satisfies "not color alone." Map fill → `info`/`primary`. |
| [progress-status/03-ring-percent.html](progress-status/03-ring-percent.html) — Percent Ring · svg+raf, medium, 8kb, aria | Circular score ring with numeric center | End-of-set score display. SVG `stroke-dashoffset` technique ports cleanly to React. |
| [ui-microinteractions/10-success-checkmark.html](ui-microinteractions/10-success-checkmark.html) — Success Checkmark · svg+raf, medium, 5kb | Circle-draw + checkmark + glow for "correct" | Reuse across MC/Fill/Drag for correct feedback. Map green → `success`. Mirror with an X-draw for incorrect (`error`). |

## Fill in the Blanks — char/word entry + word bank

| File | Technique to steal | Port notes |
|---|---|---|
| [inputs-switches/08-otp-boxes.html](inputs-switches/08-otp-boxes.html) — OTP Boxes · raf, medium, 5kb | Per-character cells with caret + slide-up fill | Great for fixed-length blanks. Each cell its own reserved box → layout-stable as letters land. |
| [inputs-switches/09-tag-chips.html](inputs-switches/09-tag-chips.html) — Tag Chips · raf, medium, 5kb, aria | Pop-scale chips appearing/removing in a field | Word-bank tokens for drag-or-tap fill. Pairs with the drag set below. |

## Drag and Drop — reorder / categorize, with the FLIP technique

These four are the strongest reference in the whole subset: all are **drag + keyboard +
aria**, and all use **FLIP** (First-Last-Invert-Play) for spring reordering — the
accessible, layout-stable way to animate position changes.

| File | Technique to steal | Port notes |
|---|---|---|
| [drag-reorder/01-flip-list.html](drag-reorder/01-flip-list.html) — FLIP Reorder · raf, medium, 10kb, aria+kbd | Canonical FLIP list with keyboard reorder | Study the keyboard path — we need it for WCAG. Ordering activities. |
| [drag-reorder/02-kanban-move.html](drag-reorder/02-kanban-move.html) — Kanban Move · raf, medium, 11kb, aria+kbd | Cards springing between labeled columns | Categorization / sorting-into-buckets activities. |
| [drag-reorder/05-sortable-grid.html](drag-reorder/05-sortable-grid.html) — Sortable Grid · raf, medium, 9kb, aria+kbd | 2D grid swap reordering | Image/term grid matching. |
| [drag-reorder/09-reorder-handle.html](drag-reorder/09-reorder-handle.html) — Drag Handle · raf, medium, 11kb, aria+kbd | Explicit grip handle (bigger tap target) for lift | Handle helps hit ≥44px (Rule #3). |

## Course Presentation — slide nav, indicators, deck transitions

| File | Technique to steal | Port notes |
|---|---|---|
| [navigation/08-breadcrumb-trail.html](navigation/08-breadcrumb-trail.html) — Breadcrumb Trail · svg+css, cheap, 6kb, aria | Self-drawing chevron trail showing position | Slide progress / section path. |
| [navigation/06-underline-follow.html](navigation/06-underline-follow.html) — Underline Follow · raf, medium, 5kb | Gliding underline that follows the active item | Slide/section tab indicator. Map glow → `primary`. |
| [navigation/07-sliding-pill.html](navigation/07-sliding-pill.html) — Sliding Pill · raf, medium, 5kb, aria | Spring pill between segmented options | Mode/section switcher within a presentation. |
| [css-3d/02-card-deck-fan.html](css-3d/02-card-deck-fan.html) — Card Deck Fan · raf, medium, 4kb | 3D fan spread as a slide-deck metaphor | Slide overview / thumbnail fan. Decorative — keep subtle, honor reduced-motion. |
| [css-3d/03-coverflow-ring.html](css-3d/03-coverflow-ring.html) — Coverflow Ring · raf, medium, 4kb, pointer | Rotating 3D carousel of panels | Slide carousel. Add keyboard nav when porting (it's pointer-only). |

## 3D Hotspot Identification — reveal, orbit, focus a point on an object

| File | Technique to steal | Port notes |
|---|---|---|
| [cursor-pointer/03-spotlight-mask.html](cursor-pointer/03-spotlight-mask.html) — Spotlight Mask · canvas, heavy, 7kb, aria | Radial spotlight punches a hole in a veil to reveal | "Explore to find the hotspot" reveal. **Heavy** — profile before adopting; provide a non-pointer fallback. |
| [cursor-pointer/01-magnetic-dot.html](cursor-pointer/01-magnetic-dot.html) — Magnetic Dot · canvas, heavy, 6kb, aria | Cursor springs/snaps toward a target point | Hotspot snap-to-target affordance. Heavy; needs keyboard equivalent for WCAG. |
| [css-3d/01-rotating-cube.html](css-3d/01-rotating-cube.html) — Rotating Cube · raf, heavy, 4kb, pointer | Pointer-steered CSS-3D wireframe orbit | Orbit-an-object interaction *without* react-three-fiber for simple cases. Heavy. |
| [css-3d/17-exploded-cube-bloom.html](css-3d/17-exploded-cube-bloom.html) — Exploded Cube Bloom · raf, medium, 6kb | Breathe between sealed and **exploded** views | Exploded anatomy / layered-structure reveal — directly relevant to JABSOM anatomy cases. |
| [css-3d/19-helical-dna-stair.html](css-3d/19-helical-dna-stair.html) — Helical DNA Stair · raf, medium, 6kb | Rotating double-helix with depth-faded opacity | Bio/anatomy structure visual; depth-opacity trick is the takeaway. |

## Virtual Environment Tour — scene nav, ambient 3D, loading

| File | Technique to steal | Port notes |
|---|---|---|
| [navigation/04-radial-fan-menu.html](navigation/04-radial-fan-menu.html) — Radial Fan Menu · css-only, cheap, 6kb, aria | Core button fans out hotspot/scene options in an arc | In-scene navigation menu for jumping between tour points. |
| [css-3d/15-gyroscope-rings.html](css-3d/15-gyroscope-rings.html) — Gyroscope Rings · css-only, cheap, 7kb, pointer | Independent precessing gimbal rings | Ambient 3D focal point / scene loading motif. Cheap and pure CSS — easiest 3D port. |
| [loaders/05-skeleton-shimmer.html](loaders/05-skeleton-shimmer.html) — Skeleton Shimmer · css-only, cheap, 5kb, aria | Content-placeholder shimmer while assets load | Scene/asset loading state for tours (and any heavy activity). Map shimmer → neutral tokens. |

---

## Selection rationale

Picked from 602 components by: role relevance to the 7 activity types; bias toward
`cheap`/`medium` perf tier (heavy ones flagged); presence of `aria`/`kbd` a11y metadata
(mandatory for the interactive ones we'd port); and preference for **layout-stable**
techniques (fills, outlines, FLIP) that fit Hard Rule #2. Decorative-only backgrounds,
artistic-movement themes, and pure text-effects were excluded — they don't map to an
activity interaction. To widen the net, the full upstream index is at
`infinite/components.index.json` in the source repo (filter with code, not by eye).
