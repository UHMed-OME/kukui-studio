# Studio: Preview depth, activity search, sidebar icons

**Date:** 2026-05-11
**Repo:** kukui-studio
**Scope:** `apps/studio-app/src/` only — no engine or core changes.

## Goal

Make the Studio sidebar faster to scan and pick from, and make the rendered activity in the preview panel read as a distinct artifact "sitting on top of" the page (rather than as a flat sibling of the editor).

Three changes, all in the studio app:

1. **Preview-panel depth.** The `.kukui-studio-panel--preview` panel gets a stronger drop shadow so it visually lifts off the page; the `.kukui-studio-panel--edit` panel stays flat as a "workbench surface."
2. **Sidebar search.** An inline text input above the Bloom-grouped activity list that filters the visible activities in place.
3. **Activity-type icons.** Each activity row in the sidebar (and the mobile `<select>`'s associated row, where feasible) gets a small icon in front of the label.

## Non-goals

- No new color tokens, no new spacing values. We use what `docs/design-system.md` and `styles.css` already define.
- No Cmd-K command palette. Single search surface in the sidebar.
- No icons for "in design" activities yet (`PLANNED_ACTIVITY_KINDS` is empty as of this spec). When planned items return, they'll get a neutral placeholder icon — out of scope here.
- No change to the mobile `<select>` shape — native `<option>` elements can't render inline SVG icons. The sidebar (which already shows on tablet+) carries the iconography.
- No change to header, toolbar, panel-edit chrome, or any activity's internal preview rendering.

## 1. Preview-panel depth

### Decision

Add a preview-only modifier that applies a stronger shadow than the default panel treatment, in both `flat` and `glass` themes.

### Tokens

Existing tokens that we reuse:

- Flat theme: no panel shadow today (just a 1px border). We'll add a new low-level shadow inline on `.kukui-studio-panel--preview`.
- Glass theme: `--shadow-glass-card` (current panel) and `--shadow-glass-pop` (already defined, stronger) — we promote the preview panel from `card` to `pop`.

### CSS changes

In `apps/studio-app/src/styles.css`:

1. Default theme — add a rule:
   ```css
   .kukui-studio-panel--preview {
     box-shadow:
       0 12px 28px rgb(0 0 0 / 0.08),
       0 2px 6px rgb(0 0 0 / 0.04);
   }
   ```
   Values mirror the *shape* of `--shadow-glass-card` but use neutral black so the flat theme stays neutral.

2. Glass theme — override the existing `html[data-theme="glass"] .kukui-studio-panel` rule for the preview variant:
   ```css
   html[data-theme="glass"] .kukui-studio-panel--preview {
     box-shadow:
       var(--shadow-glass-pop),
       inset 0 1px 0 rgba(255, 255, 255, 0.5);
   }
   ```

3. Accessibility-flat toggle (if any current rule strips shadows): preview panel keeps its border but drops its `box-shadow` so the panel reads as a flat rectangle. (Verify against the existing flat/glass toggle in `styles.css` during implementation; do not weaken the toggle's guarantee.)

### Why preview-only

The preview is the artifact users are crafting; the editor is the tool. Differentiating their depth makes that hierarchy honest visually and gives "Live preview" mode some of the feel of looking at an embedded learner widget on a course page.

## 2. Sidebar search

### Decision

Single text input at the top of `.kukui-studio-sidebar`, above the first Bloom group. Filters the visible activity buttons in place using case-insensitive substring match against the activity label.

### UX details

- **Placement:** First child of `<nav className="kukui-studio-sidebar">` in `App.tsx`. The narrow-viewport `<select>` picker remains as-is — the search is a desktop/tablet feature where the sidebar is visible.
- **Behavior:** As the user types, hide non-matching activity buttons. Hide entire Bloom group headings + taglines when no activities in that group match. Show a small "No activities match" empty state when nothing matches.
- **Match field:** Activity label (from `ACTIVITY_LABELS`). Bloom level and tagline are *not* searched — keeps the mental model "type the name of the activity."
- **Clear:** A small × button inside the input clears the query when non-empty (uses the existing `XIcon` from `icons.tsx`).
- **Selection persistence:** If the currently-selected activity is filtered out, we do *not* change `kind` — the active selection just isn't visible until the query is cleared or changed. (Avoids the surprise of "I typed three letters and it picked a different activity for me.")
- **Keyboard:**
  - Input is a plain `<input type="search">` with `aria-label="Search activities"`.
  - `Escape` clears the query if non-empty, otherwise blurs the input.
  - `Enter` selects the first visible activity if exactly one is visible *and* it's different from the current selection. (Otherwise no-op.)
- **Focus styling:** Reuses existing focus-visible treatment used by other inputs (3px primary-soft ring per design system).

### State

Local component state in `App.tsx`:

```ts
const [search, setSearch] = useState("");
```

Derived in the existing sidebar render path: filter `kindsAtLevel` by `ACTIVITY_LABELS[k].toLowerCase().includes(search.trim().toLowerCase())` before mapping to buttons.

### Markup sketch

```tsx
<nav className="kukui-studio-sidebar" aria-label="Activity type">
  <div className="kukui-studio-sidebar__search">
    <input
      type="search"
      className="kukui-studio-sidebar__search-input"
      placeholder="Search activities"
      aria-label="Search activities"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      onKeyDown={handleSearchKeydown}
    />
    {search ? (
      <button
        type="button"
        className="kukui-studio-sidebar__search-clear"
        aria-label="Clear search"
        onClick={() => setSearch("")}
      >
        <XIcon />
      </button>
    ) : null}
  </div>
  {/* …existing Bloom groups, now filtered… */}
</nav>
```

### Styles

New CSS classes alongside existing sidebar rules:

- `.kukui-studio-sidebar__search` — wrapper with relative positioning, `margin-bottom: var(--spacing-md)`.
- `.kukui-studio-sidebar__search-input` — 36px min-height, full-width, reuses border + radius tokens. Padding right reserves space for the clear button.
- `.kukui-studio-sidebar__search-clear` — absolutely positioned right-side button, 24×24, ghost styling, only rendered when query non-empty.
- Empty state: `.kukui-studio-sidebar__empty` — small muted paragraph: "No activities match "{query}"."

## 3. Activity-type icons

### Decision

Add one stroke-SVG icon per built activity kind, rendered inside the sidebar button before the label. Style matches the existing `icons.tsx` set (1.8px stroke, `viewBox 0 0 24 24`, `currentColor`).

### Icon assignments

Each icon is a small visual hint of the activity's interaction style — not literal pictograms. One icon per kind, all 17 currently-built kinds (per `BLOOM_BY_KIND` in [App.tsx:32-61](../../../apps/studio-app/src/App.tsx#L32-L61)):

| Activity kind | Icon concept |
|---|---|
| `flashcards` | A card with a small "flip" curl on one corner |
| `matching-pairs` | Two small shapes with a connecting line |
| `hotspot-2d` | Image frame with a target/dot inside |
| `anatomy-labeling` | A simple body silhouette with a tag |
| `highlight-text` | Lines of text with the middle line highlighted |
| `drag-and-drop` | A square being dragged into a dashed slot |
| `sequence-steps` | Three small numbered dots connected by a line |
| `categorization` | Three squares grouped under a bracket |
| `hotspot-3d` | A cube with a target dot on one face |
| `virtual-tour` | A 360° arrow ring (or compass-like circle) |
| `interactive-video` | A play triangle inside a frame |
| `image-annotation` | An image frame with a small comment-bubble pin |
| `image-comparison-slider` | A split rectangle with a center handle |
| `concept-map` | Three nodes connected by lines |
| `lab-panel` | A test-tube glyph |
| `branching-scenario` | A small tree-fork |
| `ddx-tree` | A larger multi-leaf tree |
| `reflection-prompt` | A speech bubble with a small spark |
| `osce` | A clipboard with a checklist |
| `audio-recording` | A microphone |

These are concepts, not pixel specs — the implementer renders them as stroke SVGs that read clearly at 16×16. All icons go in a new file `apps/studio-app/src/activityIcons.tsx` (kept separate from `icons.tsx` so the activity-icon mapping stays self-contained).

### Lookup

```ts
// activityIcons.tsx
import type { ActivityKind } from "@kukui/core";
import type { SVGProps } from "react";

export function ActivityIcon({ kind, ...rest }: { kind: ActivityKind } & SVGProps<SVGSVGElement>) {
  const Icon = ICONS[kind];
  return Icon ? <Icon {...rest} /> : null;
}

const ICONS: Partial<Record<ActivityKind, (p: SVGProps<SVGSVGElement>) => JSX.Element>> = {
  flashcards: FlashcardsIcon,
  // …etc
};
```

The component returns `null` if no icon is registered for the kind — defensive in case a new `ActivityKind` lands in core before its icon is added here.

### Markup change

In the sidebar button:

```tsx
<button …>
  <ActivityIcon kind={k} className="kukui-studio-sidebar__btn-icon" aria-hidden="true" />
  <span className="kukui-studio-sidebar__btn-label">{ACTIVITY_LABELS[k]}</span>
</button>
```

### Styles

- `.kukui-studio-sidebar__btn` becomes `display: flex; align-items: center; gap: var(--spacing-sm);` so icon + label sit on one row.
- `.kukui-studio-sidebar__btn-icon` — 16×16, `flex: 0 0 16px`, `color: var(--color-text-secondary)` so they read as quieter than the label. On `.is-active` / `:hover`, the icon picks up the active text color via `currentColor`.

## File changes summary

- `apps/studio-app/src/App.tsx` — add `search` state, render the search input + clear button, filter sidebar kinds, render `<ActivityIcon>` inside each sidebar button, render empty state, handle keyboard.
- `apps/studio-app/src/activityIcons.tsx` *(new)* — 17 stroke-SVG icon components + `ActivityIcon` dispatcher keyed by `ActivityKind`.
- `apps/studio-app/src/styles.css` — preview-panel shadow rules (flat + glass), sidebar search styles, sidebar button flex layout, icon color rules.

## Testing

- **Vitest unit tests** (the repo already runs vitest — `vitest.config.ts` at repo root):
  - `activityIcons.test.tsx` — every kind in `BUILT_ACTIVITY_KINDS` resolves to a non-null `<ActivityIcon>` render output. Guards against forgetting an icon when a new activity ships.
  - Sidebar search filtering — render `<App />`, type into the search input, assert non-matching activity buttons disappear and the empty state shows for nonsense queries.
- **Manual visual check** in `pnpm dev`:
  - Preview panel reads as lifted vs. editor in both flat and glass themes.
  - Sidebar icons align consistently across all 17 rows at default font size and at 1.5× browser zoom.
  - Tab order: search input → first visible activity button → next → … (no orphan tab stops introduced by the clear button when input is empty).

## Open questions (not blockers)

- Should the search input persist across page reloads in `localStorage`? Default: no — search is ephemeral, like a filter. Easy to add later if users ask.
- Long-term, the Bloom group headings could become collapsible. Out of scope here.
