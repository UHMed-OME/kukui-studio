# Drag and Drop — redesign

**Date:** 2026-05-12
**Status:** Design committed; implementation begins immediately after this lands.
**Triggers:** User report ("drag and drop is broken still, dragging is not working at all") + audit findings across runtime, authoring, and mobile.

## Goal

Rebuild the Drag-and-Drop activity from the inside out. The activity stays conceptually the same — chips into zones — but the interaction model, the authoring flow, and the mobile behaviour all get redesigned.

Three concrete failure modes the redesign fixes:

1. **Dragging doesn't fire at all** (regression after `e2b0161`). Replace the brittle "lazy pointer-events on the dragged chip" pattern with a sturdier overlay-driven model and a regression test that boots a real DndContext.
2. **Authoring requires raw-JSON edits** to link chips to zones via the `correctZones[]` string array. Studio's visual editor only handles zone geometry, not chip→zone pedagogy. The redesign moves chip authoring into the same canvas with visible relationship lines.
3. **Mobile is unusably small**. Tap targets are tiny, the tray sits below the board (off-screen on phones), drag fights page scroll. Mobile gets a tap-to-place model + sticky tray.

## Locked decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Layout shape | Board (canvas with optional background + overlaid drop zones) on the left, tray on the right. On mobile (`< 760 px`): board on top, tray as a sticky bottom sheet. |
| 2 | Interaction model | Two coexisting modes, sharing state: **drag** (mouse / trackpad / stylus — chip follows cursor, drops on zone), **tap-to-place** (touch + keyboard — tap chip to select, tap zone to place). Mode auto-detected from input type; author can force one via `behaviour.interaction`. |
| 3 | Drop semantics | Zones remain **discrete rectangles**. No free-position drop. Chips snap into zones; capacity controls how many can stack. |
| 4 | Authoring shape | WYSIWYG canvas + side-panel chip list. Editing a chip is a row in the side panel with label, optional image, and a `correctZones` picker that picks from existing zone IDs (chip-style multi-select, no raw text). Selecting a chip in the side panel highlights its correct zones on the canvas; selecting a zone highlights chips that target it. |
| 5 | Solutions button | `behaviour.enableSolutionsButton` is finally wired — clicking the button (after submit) animates each chip to one of its correct zones over ~600 ms then locks the board. |
| 6 | Accessibility model | Replace the `<select>`-based fallback. Keyboard users use the **tap-to-place flow** with Tab to focus, Space/Enter to select/place. `aria-live` announces selection state. No alternate-UX bifurcation. |
| 7 | Schema | Backward-compatible. Add `behaviour.interaction: "drag" \| "tap" \| "auto"` (default `auto`) and `behaviour.aspectRatio: "16/10" \| "4/3" \| "1/1"` (default `16/10`). All existing samples + activity configs continue to parse and render unchanged. |
| 8 | Library | Keep `@dnd-kit` (already in the bundle, well-tested). The interaction-mode abstraction sits above it. |

## Architectural shape

```
packages/core/src/components/drag-and-drop/
  DragAndDrop.tsx                 # top-level, owns state machine, renders DnDActivity
  DnDActivity.tsx                 # the canvas + tray + actions, presentation only
  state.ts                        # state machine + reducer (selection, placement, stage)
  useInteractionMode.ts           # detect mouse vs touch; expose effective mode
  DragLayer.tsx                   # @dnd-kit DndContext + DragOverlay
  TapLayer.tsx                    # tap-to-place keyboard + touch handlers
  Chip.tsx                        # tray chip; supports both drag and tap
  Zone.tsx                        # drop zone; supports both drag-over and tap-target
  SolutionsAnimation.tsx          # animates chips to correct zones when solution button fires
  DragAndDrop.css
  DragAndDrop.test.tsx            # includes a regression test that simulates real drag

apps/studio-app/src/EditCanvas/
  DnDEditor.tsx                   # rewritten: canvas (existing zone-geometry editor) + chip side-panel
  DnDChipPanel.tsx                # side panel: add / edit / link chips
  DnDLinkOverlay.tsx              # SVG layer drawing chip→zone guide lines on the canvas
```

State machine (`state.ts`):

```ts
type Stage = "answering" | "submitted" | "showing-solution";

type State = {
  stage: Stage;
  placement: Record<chipId, zoneId | null>;
  selectedChipId: chipId | null;  // tap-to-place selection; ignored in pure drag mode
  attempts: number;
};

type Action =
  | { type: "select-chip"; id: chipId }
  | { type: "deselect" }
  | { type: "place"; chipId: chipId; zoneId: zoneId | null }
  | { type: "submit" }
  | { type: "try-again" }
  | { type: "show-solution"; assignment: Record<chipId, zoneId> }
  | { type: "rehydrate"; state: State };
```

`place` is the unified action both drag-end and zone-tap dispatch — no separate paths.

Interaction-mode detection (`useInteractionMode.ts`): one-time pointer-events listener on mount. First `pointermove` with `e.pointerType === "touch"` flips effective mode to `tap`; first `mouse`/`pen` event flips to `drag`. Stays whichever fired first for the session. Author override (`behaviour.interaction`) wins over auto.

## Schema additions

`packages/schemas/src/drag-and-drop.ts`:

```ts
behaviour: z
  .object({
    enableRetry: z.boolean().optional(),
    enableSolutionsButton: z.boolean().optional(),
    singlePoint: z.boolean().optional(),
    interaction: z.enum(["drag", "tap", "auto"]).optional(),  // NEW; default "auto"
    aspectRatio: z.enum(["16/10", "4/3", "1/1"]).optional(),  // NEW; default "16/10"
  })
  .strict()
  .optional(),
```

Everything else stays. `correctZones[]` is preserved as the source of truth for chip→zone linkage; the Studio picker writes to it. `background` already became optional in `e2b0161` — no changes there.

## Authoring UX (Studio editor)

```
┌─────────────────────────────────────────────────────────────┐
│  Canvas (board + zones)                  │  Chips           │
│                                          │  ┌──────────────┐│
│  [zone-1]      [zone-2]                  │  │ Amazon       ││
│                                          │  │ Linked: z-1  ││
│                                          │  ├──────────────┤│
│  [zone-3]      [zone-4]                  │  │ + Add chip   ││
│                                          │  └──────────────┘│
└─────────────────────────────────────────────────────────────┘
```

- The canvas keeps the current zone-geometry editor (draw-to-create, drag-to-move, corner-handle-resize, ✕/Delete, right-click for z-order). All that logic is preserved.
- The side panel lists chips. Each row shows: label, image thumbnail (if any), and a "Linked to" chip-multi-select that picks from the current zone IDs.
- **Selecting** a chip in the side panel: that chip's `correctZones` are highlighted on the canvas with a colored guide stroke (1 colour per chip, deterministic from chip ID hash).
- **Selecting** a zone on the canvas: that zone's targeting chips are highlighted in the side panel.
- Adding a new chip: button at the bottom of the side panel; opens an inline form (label required, image optional). New chip starts with `correctZones: []` and the panel nudges the author to pick at least one.
- Drag a chip from the side panel onto a zone to set it as a `correctZones` entry — alternative to the picker.
- Image upload uses the existing `FileUploadWidget`.

Validation surfacing: a chip with `correctZones.length === 0` shows an inline warning ("This chip has nowhere correct to drop"). Schema requires at least one already, so this is a UX nudge during editing before the form is fully valid.

## Mobile UX

- Below 760 px width: layout collapses to board-on-top, tray-as-bottom-sheet.
- Tray bottom sheet: sticky, ~80 px tall (one row of chips), horizontally scrollable when there are more chips than fit.
- Drag is disabled at this width — `useInteractionMode` returns `"tap"` unconditionally.
- Tap a chip → all zones get a "Place here" overlay badge. Tap a zone → chip moves there. Tap an already-placed chip → it lifts back to tray and becomes selected.
- The canvas + bottom sheet design fits a phone in portrait without scrolling for the typical 4-zone activity.

## Accessibility

- Tab order: tray chips → zones in DOM order → action buttons.
- Each chip is a `<button>` with `aria-pressed` reflecting selection.
- Each zone is a `<button role="button">` with `aria-label` from `zone.label ?? "Drop zone N"`.
- `aria-live="polite"` region announces "Chip 'X' selected. Tap a zone to place." and "Placed 'X' in 'Zone Y'."
- Solutions animation is gated behind `prefers-reduced-motion: reduce` — when set, chips teleport into place with a focus pulse instead of moving over 600 ms.
- The current `<select>` fallback is removed (replaced by the tap-to-place flow).

## Scoring + behaviour

No changes to scoring math. `enableRetry`, `singlePoint`, per-chip `feedback`, the post-submit summary, and the `<x of y> correctly placed` live region all behave as today.

`enableSolutionsButton`: when the activity is `submitted` and the flag is true, show a "Show solution" button alongside Try Again. Clicking it dispatches `show-solution` with a deterministic per-chip zone assignment (first entry of `correctZones`); the animation runs; the board enters `"showing-solution"` stage where chips can't be dragged.

## Migration

Existing samples (`basic.json`, `full.json`, plus any authored configs) render unchanged — schema is backward-compatible, behaviour defaults match prior behaviour for all unspecified fields. Visual styling shifts (side-panel layout on desktop, sticky tray on mobile, new chip animations) but the activity does the same thing.

## Testing strategy

- **Drag regression test** (new): boots a real `DndContext` in jsdom + `@dnd-kit/core/test`, simulates `pointerdown / pointermove / pointerup` over a tray chip and a zone, asserts the chip moves into the zone. This is the canary that catches the kind of regression that motivated the redesign.
- **Tap-to-place flow test** (new): unit test on the state reducer + integration test for tap-select → tap-place → submit happy path + keyboard variant.
- **Solutions animation test** (new): clicking show-solution after submit results in every chip in `correctZones[0]`, board in `"showing-solution"` stage.
- **Backward-compat fixture test**: existing `basic.json` + `full.json` round-trip parse + render without warnings.
- Existing tests for capacity, retry, single-point scoring, suspend-data resume all retained.

## Milestones

1. **M1 — Schema + state.ts + useInteractionMode** *(~½ day)*: add the two new behaviour fields, write the reducer + the mode detector, with unit tests for both.
2. **M2 — Runtime rewrite** *(~1 day)*: new DragAndDrop / DnDActivity / Chip / Zone / DragLayer / TapLayer components. Implement enableSolutionsButton. Drag regression test passes.
3. **M3 — Studio editor rewrite** *(~1 day)*: side-panel chip authoring + canvas link overlay. Existing zone-geometry editor preserved.
4. **M4 — Mobile / a11y polish** *(~½ day)*: bottom-sheet tray, prefers-reduced-motion, aria-live announcements, focus management on selection.

Total: ~3 days focused.

## Open decisions

| # | Decision | Resolution |
|---|---|---|
| 1 | Free-position drop on canvas? | **No** — zones stay discrete rectangles (decision 3). Free-position adds pedagogical ambiguity (what's "close enough"?) and requires fuzzy correctness scoring. |
| 2 | Drop the `<select>` accessibility fallback? | **Yes** — replaced by first-class keyboard support in the tap-to-place flow. Reduces UI surface and stops the alternate-UX bifurcation. |
| 3 | Reuse @dnd-kit or replace? | **Keep**. Well-tested, already in the bundle. The interaction-mode abstraction lives above it. |
| 4 | Per-chip vs per-pair feedback? | Per-chip (existing). Per-pair (which chip ended up in which wrong zone) is a v2. |

## What this design deliberately defers

- **Per-pair wrong-answer feedback** ("you put X in Y when X belongs in Z") — interesting but adds an authoring surface that maybe one user in fifty needs. v2.
- **Free-position drop** — covered above.
- **Image-as-chip** richer styles (current schema supports an image on a chip; the redesign renders it the same way the current one does, no improvements there).
- **Multi-correct ranking** (which of the chip's correct zones is the "best" one) — out of scope.

## References

- Current implementation: `packages/core/src/components/drag-and-drop/DragAndDrop.tsx`, `apps/studio-app/src/EditCanvas/DnDEditor.tsx`
- Audit findings driving this redesign: this conversation's earlier perf + code-quality + security audits + the regression report from real-world use.
- The `e2b0161` commit message documents the prior drag-pointer-events regression.
