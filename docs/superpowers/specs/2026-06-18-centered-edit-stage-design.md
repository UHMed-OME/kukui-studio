# Centered edit stage — design

Rework Kukui Studio's authoring layout so the **activity itself is the centre of
gravity**, not the form. Today the screen is a 50/50 split: a tabbed form panel
on the left and an Edit/Live preview panel on the right. Authors spend most of
their time reading the live artifact, yet it's pinned to one half of the screen
while a long scrolling form competes for equal space.

This change makes the **edit/preview stage the dominant centre column**, moves
the **settings form to a narrower right rail**, and pushes the most-edited
fields (title, prompt, and each activity's repeated elements) **out of the form
and onto the stage** as direct, in-canvas interactions.

## Goals

1. **Centered stage.** The Edit/Live preview becomes the wide centre column and
   the visual focus. The Edit/Live toggle is unchanged — it still flips the
   centre column between the visual editor and the rendered learner component.
2. **Settings on the right.** The tabbed form panel (Editor / Scoring / Raw JSON
   / AI Assist) moves to a narrower right rail. Its contents are unchanged; only
   its position and width change.
3. **More editing on the canvas.** Every visual editor gains:
   - A **stage header** with inline-editable **title** and **prompt**, rendered
     above the canvas, so the two fields every activity has are edited where the
     author is looking.
   - **Structured insets** — a per-element inspector for the activity's repeated
     items (markers, zones, hotspots, labels, annotations, nodes), following the
     pattern the interactive-video editor already established.
4. **No regressions.** The form remains the complete, canonical editing surface.
   Everything editable on the stage is also editable in the form; the stage is a
   faster path, never the only path. Auto-save, undo/redo, validation badge, and
   draft persistence all keep working because every stage edit flows through the
   same `onChange` → `markDirty` pipeline.

## Non-goals

- **Changing the activity sidebar.** The 220px Bloom-grouped activity picker on
  the far left stays exactly where it is.
- **Changing the form's contents.** ui-schemas, field templates, and widgets are
  untouched. We relocate the panel and (optionally) hide the title/prompt fields
  from the form for editors that now own them on the stage — but the fields
  themselves and their validation are unchanged.
- **Live-only activities.** Activities with no visual editor (straw-poll, qa-board,
  etc.) keep their single centred live preview; they gain the centred layout but
  no stage header (no canvas to host it).
- **Mobile redesign.** Narrow viewports keep the existing single-column
  Editor/Preview switch. The centred 3-zone layout is desktop-only.

## Layout

Shell grid is unchanged: `sidebar | main`. Inside `main`, swap the two panels and
reweight:

```
.kukui-studio-main {
  /* was: minmax(0, 1fr) minmax(0, 1fr) */
  grid-template-columns: minmax(0, 1.7fr) minmax(320px, 0.85fr);
}
```

- **Centre column (first):** the preview panel — Edit/Live toggle header + the
  `EditCanvas` (edit) or rendered component (live). Wider, with a stronger card
  lift; reads as the artifact.
- **Right column (second):** the settings panel — the tab row + form body.
  Narrower (min 320px so inputs stay usable), scrolls independently.

The two `<section>` elements in `App.tsx` are reordered (preview first, settings
second). The mobile switch labels ("Editor" / "Preview") and the
`--show-edit`/`--show-preview` classes are remapped so the narrow-viewport
behaviour is preserved.

## Stage header

A new shared component `EditCanvas/StageHeader.tsx`:

```
<StageHeader title={…} prompt={…} promptRequired onChange={patch} />
```

- Renders an inline-editable title (single-line, large) and prompt (auto-growing
  textarea). Both commit on change through the editor's existing `onChange`,
  patching only `title` / `prompt` on the config object.
- Layout-stable: the inputs are borderless until hover/focus, then reveal a
  border drawn from `--color-border` / `--color-primary`. Border width is
  constant (transparent → coloured), so focus never reflows the canvas (hard
  rule #2).
- Tap targets ≥ 44px (hard rule #3). Placeholder text guides empty fields.
- `promptRequired` mirrors the schema: editors whose prompt is required show the
  placeholder without an "(optional)" hint; the rest mark it optional.

Each of the 7 visual editors renders `<StageHeader>` at the top of its canvas.
**Title/prompt stay in the form too** — the stage header only renders in Edit
mode, so removing them from the form would make them uneditable in Live preview
mode (except via Raw JSON). Keeping both is safe: they edit the same state
through the same `onChange`, so editing either updates the other live. The mild
duplication reinforces that the stage and the form are the same fields, the way
canvas builders commonly mirror a title in both the canvas and a sidebar.

## Structured insets (per-element inspector)

The interactive-video editor already demonstrates the target pattern: a marker is
selected on the canvas, and an inspector below it edits that element's fields
inline. Generalise this so every editor with repeated elements has:

- **Selection state** (already present in DnD, hotspot-2d/3d, anatomy, annotation,
  concept-map via click-to-select).
- **An inspector region** docked in/under the canvas that edits the selected
  element's fields (label text, correctness, feedback, coordinates as read-outs)
  without round-tripping to the form.
- **Empty state** prompting the author to select or create an element.

Editors already carrying most of this (IV, DnD) get the stage header + an
inspector polish pass. Editors with thinner inspectors get them brought up to the
shared bar.

## Phasing

1. **Layout swap.** Reorder the two panels in `App.tsx`; reweight
   `.kukui-studio-main`; remap mobile classes; verify the toggle, validation
   badge, async strip, and mobile switch still work.
2. **Shared `StageHeader`** component + CSS (`ks-stage-head__*`). Layout-stable,
   a11y-checked, design-token-only.
3. **Per-editor wiring** (one phase each): interactive-video (reference) → drag-
   and-drop → hotspot-2d → hotspot-3d → anatomy-labeling → image-annotation →
   concept-map. Each: mount `StageHeader`; ensure a per-element inspector meets
   the shared bar. (Forms keep title/prompt — see above.)
4. **Polish + tests.** Update/extend editor tests; run the studio-app test suite
   and typecheck; visual pass for layout stability and contrast.

## Reduce the form: field migration (north star)

The deeper goal is **fewer fields in the Editor form**. Every field an author has
to scroll past is friction; the centred stage exists so the most-edited fields
can be authored *on the artifact* and dropped from the form. The endpoint: the
form holds only what genuinely can't live on the canvas (appearance pin,
behaviour the canvas can't show, raw structural escape hatches), and authoring a
new activity is mostly direct manipulation.

### Inline-edit primitive

A shared **hover-to-edit** affordance, `InlineEdit`: a value renders read-only on
the stage; on hover (or focus) a small pencil button appears; activating it swaps
the value for an inline editor (text input, textarea, select, media picker, or
rich-text popover, by field type), committing through `onChange`. Layout-stable —
the pencil occupies reserved space so revealing it never reflows. The
`StageHeader` is the first instance (title/prompt); it generalises to any leaf
field.

### Migration targets per editor

Priority order is "biggest form-bulk first". A field migrates only when the
canvas can show it in context; everything else stays in the form.

| Editor | Migrate to stage (inline) | Keep in form |
| --- | --- | --- |
| interactive-video | title, prompt, video source (URL/type/poster), per-marker question + answers (done) | behaviour, appearance |
| drag-and-drop | title, prompt, background (done), zone labels, draggable labels + correct-zone links | behaviour, appearance |
| hotspot-2d | title, prompt, image source, hotspot label + correct toggle | behaviour, appearance |
| hotspot-3d | title, prompt, hotspot label + correct toggle | model source, camera, behaviour |
| anatomy-labeling | title, prompt, image source, label text, target↔label pairing | behaviour, appearance |
| image-annotation | title, prompt, image source, annotation label + tool | behaviour, appearance |
| concept-map | title, prompt, node labels, palette terms, expected edges | behaviour, appearance |

Each row is one increment: add the inline editor on the canvas, then hide that
field in the activity's `ui-schema` *only if* it's also reachable in Live mode
(media/behaviour) or leave it for the rare Live-mode edit. Per-element labels and
correctness are safe to drop from the form once on-canvas because the visual
editor is the canonical path for them already.

## Risks

- **Double-edit drift.** Title/prompt are editable on both the stage and the
  form. No drift: both write the same config keys through the one `onChange`, so
  each surface re-renders from the same state on the next keystroke.
- **Vertical budget.** Stage header + canvas + inspector must fit the centre
  column without the canvas collapsing. Header is compact (≈2 rows); inspector
  scrolls within the panel body, not the page.
- **Test fragility.** Adding a title input near existing controls can collide
  with `getByRole`/`getByLabelText` queries. Inspector/stage labels are namespaced
  ("Activity title", "Activity prompt") to stay unambiguous.
