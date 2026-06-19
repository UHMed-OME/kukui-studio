# Edit mode for every activity — design / plan

Extend the in-place editing we built for the 7 visual editors so **every activity
has an Edit mode** in Studio, and the pencil reaches **more fields** — shrinking
the form toward "only what can't live on the artifact."

## Where we are

- `InlineEdit` (in-place, content-sized, pencil-beside-text) and `StageHeader`
  (inline title + prompt) live in `apps/studio-app/src/EditCanvas/`.
- Only the **7 activities with a visual canvas** (interactive-video, drag-and-drop,
  hotspot-2d/3d, anatomy-labeling, image-annotation, concept-map) have an Edit
  mode — `hasEditor(kind)` gates the Edit/Live toggle and the `EditCanvas`.
- The other ~17 activities show **only** the form + Live preview; no pencils.

## Goal

1. **Edit/Live toggle on every activity.** `hasEditor` stops gating the toggle —
   every kind gets an Edit mode.
2. **A generic Edit stage** for activities without a bespoke canvas: render
   `StageHeader` (title/prompt inline) above the activity's **live preview**, so
   authors edit the two universal fields on the artifact immediately, with the
   real rendered component beneath for context.
3. **An inline-edit toolkit** so more field *types* can move onto the stage.
4. **Per-activity field migration** off the form and onto the stage, highest
   form-bulk first — the same north star as the centered-stage work.

## Why a stage, not pencils injected into the rendered component

The learner component owns arbitrary DOM; we can't reliably inject pencils into
it. So Edit mode is **our** editable surface (StageHeader + structured inline
fields), and the **Live** toggle still shows the true rendered component. The 7
bespoke canvases stay as-is (they already do direct manipulation); the generic
stage is the floor everything else gets.

## Scope: Studio only

Edit mode is an authoring concern. **engine-web** (learner runtime) and
**live-mode** (classroom) render activities; they don't author them, so they get
no edit mode. "Every app" here means **every activity kind inside Studio**.

## Inline-edit toolkit (built on `InlineEdit`)

| Editor | Field types | Status |
| --- | --- | --- |
| `InlineEdit` (text) | `string` (title, labels, short copy) | ✅ done |
| `InlineEdit` (multiline) | plain text serialised from simple HTML prompts | ✅ done (StageHeader) |
| `InlineRichEdit` | `string` with `ui:widget:"html"` — opens the Tiptap editor inline/popover; lossless | planned |
| `InlineSelect` | enums / `oneOf` (e.g. source type, tool) | planned |
| `InlineToggle` | `boolean` (e.g. per-item `correct`) | planned |
| `InlineNumber` | bounded numbers (timecodes already custom in IV) | planned |
| `InlineMedia` | image/video/model `src` (URL + upload), reuses FileUpload logic | planned |
| `InlineList` | arrays of `{label, …}` — add/reorder/delete + per-item inline fields | partial (IV markers, DnD chips) |

Each commits through the host editor's existing `onChange`, so undo/redo,
auto-save, and the validation badge keep working.

## Per-activity migration

Same approach as before: a field migrates onto the stage only when the stage can
show it in context, and is then dropped from the form (when still reachable for
the rare Live-mode edit, or safe like per-element labels/correctness). Priority =
biggest form-bulk first. The 7 canvases extend their existing inspectors; the
~17 others start from the generic stage and grow.

## Phasing

1. **Generic Edit stage + toggle everywhere.** `hasEditor` → always true; non-
   canvas kinds render `GenericEditStage` (StageHeader over the live preview).
   Drop `title` from the remaining forms. *Every activity gains the pencil for
   title/prompt.*
2. **Toolkit:** `InlineSelect`, `InlineToggle`, `InlineRichEdit` (the three that
   unlock the most fields).
3. **Per-activity migration**, highest-bulk first; drop migrated fields from
   forms; extend the 7 canvases' inspectors in parallel.
4. **Tests + a11y + design-system audit** (contrast, ≥44px text targets,
   color-never-sole-signal on toggles).

## Open decisions

- **Generic Edit-mode shape:** StageHeader *above the live preview* (recommended —
  cheap, gives instant context), or structured **field cards** (form-like rows
  with inline pencils, no live render) for activities whose structure the preview
  doesn't expose well? Could also be both (stage header + cards + preview).
- **Rich prompt inline:** open Tiptap in a popover on the stage, or keep routing
  formatted prompts to the form? (Today: simple prompts edit inline, rich ones
  point to the form.)
