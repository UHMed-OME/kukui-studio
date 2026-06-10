# Studio: visual refresh (Editorial Calm + authoring-tool personality)

**Date:** 2026-05-12
**Repo:** kukui-studio
**Source skill:** [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (used as a design-reasoning framework, not installed)

## Why

Sidebar/buttons/panels currently follow a *border-everywhere* skeuomorphism that reads as late-2010s authoring chrome. Modern peer tools (Figma, Linear, Notion) achieve depth through *absence* of chrome on idle UI and reserve borders/shadows for the 20% of elements that need visual weight — the primary CTA, the active selection, the floating preview artifact. This refresh applies that discipline to Kukui Studio while keeping the kukui-brown palette and Hawaiian framing mandated by `CLAUDE.md`.

## Audience and product type

Faculty + instructional designers comparing Kukui Studio to other interactive-content authoring tools. **Not** devs, **not** marketing visitors. The visual language target is "authoring tool with personality" — closer to Figma than to a marketing site, with some warmth carried over from the Hawaiian framing.

## Five-dimension system

### 1 — Pattern (layout)

Split-view editor stays. Sidebar (240–260px) on the left, two-column main on the right (editor + preview). The preview reads as the artifact; the editor reads as the workbench.

### 2 — Style: "Editorial Calm with personality"

- **Chrome reduction:** 80% of UI loses its idle border + shadow. Hover states paint a *surface* (color shift), not a border or shadow ring.
- **Personality moves:** Figma-style left rail with **category color dots** in front of each row (Bloom level → dot color); preview panel keeps the gentle `--shadow-glass-pop` it already has.
- **Reject:** brutalism, full glassmorphism, AI-purple gradients, neon, dark mode (out of scope for this refresh).

### 3 — Color: same palette, tighter usage

| Token | Reserved for |
|---|---|
| `--color-primary` (kukui-brown) | Primary CTA, active selection, focus rings — **only** |
| `--color-success` (kalo-green) | "Valid" / success badge, success status |
| `--color-error` | Validation errors, destructive confirms |
| `--color-bg`, `--color-surface`, `--color-tip-bg` | Idle surfaces (sidebar, panels, page) |
| Neutral mid-tones (`--color-text-muted`) | Icons, dividers, inactive controls |

**New Bloom-category colors** (sidebar dots + active-state tint for that section only):
- Remember: warm amber
- Understand: sage green
- Apply: terracotta
- Analyze: dusty plum
- Evaluate: kalo (matches success)
- Create: kukui (matches primary)

These are *category cues*, not accents — used at <10% saturation behind the kind row when active, full saturation for the dot itself. Locked in `docs/design-system.md` as Bloom tokens.

### 4 — Typography (Phase 1, shipping now)

Decision: **path B from the brainstorm** — self-host Inter Variable.

- **Inter Variable** (single woff2, ~344KB, weight axis 100–900) at `apps/studio-app/public/fonts/InterVariable.woff2`
- `@font-face` with `font-display: swap` so cached fonts surface instantly and the page never blocks on a network font fetch
- `font-feature-settings: "cv11", "ss03"` for the modern single-storey `a` + sharper `i / J / l` stems
- `text-rendering: optimizeLegibility`, `font-smoothing: antialiased` (macOS) / `grayscale` (firefox-mac)
- Heading weights drop from 700 → 600/650 (Inter at 700 is too heavy at small sizes; 600 is the modern "bold" target for variable fonts)
- Letter-spacing tightened on headings (`-0.01em` to `-0.015em`)
- Numeric elements get `font-variant-numeric: tabular-nums` (validation badge counts, hotspot counts, etc.) so digits don't reflow neighbors

Type scale tweak: `--font-size-title` drops 24px → 22px (Inter is wider than system-ui at the same size; matches optical weight to old system-ui at 24).

### 5 — Effects

- Shadows on **only**: modals, popovers, toasts, the preview panel. Everything else flat.
- Hover: solid surface change (e.g. `--color-primary-soft` background). No border-color shift, no shadow growth, no translateY.
- Focus rings: 3px ring at `--color-primary-soft`, always visible on keyboard nav. Outline color → `--color-primary`.
- Motion: 150–200ms ease on hover/state, 250–300ms on layout. `prefers-reduced-motion` collapses to 0ms.

## Phasing

Each phase ships independently. Each is its own commit + push so the user can review the live deploy before continuing.

1. **Phase 1 — Typography (this commit).** Self-host Inter Variable, swap `--font-family-sans`, enable feature settings, tighten heading weights + letter-spacing, add tabular-nums to badges, retune `--font-size-title`. Single CSS file change + the woff2 asset.
2. **Phase 2 — Sidebar with Bloom dots.** Add Bloom color tokens, render a 6×6 color dot in front of each activity row, tint the active-row background with the corresponding Bloom color (low alpha), drop idle row borders, lighten hover treatment. Update `App.tsx` to pass the Bloom level to each row.
3. **Phase 3 — Buttons & panels.** Ghost-by-default buttons (no idle border). Reserve solid border + shadow for the primary `Download SCORM` CTA. Reduce panel rim weight; remove idle shadows from non-preview panels. Update `--shadow-*` tokens to retire one tier.
4. **Phase 4 — Form renderers.** Replace the 3-4 most-used RJSF widgets (string, textarea, array-of-strings, select) with custom components that use the new chrome. Bigger surgical change; spec'd separately once Phase 3 lands.

## Source-of-truth updates

After Phase 1: `docs/design-system.md` gains the Inter Variable note + updated type scale.
After Phase 2: `docs/design-system.md` gains the Bloom color tokens.
After Phase 3: `docs/design-system.md` gains the new button/elevation rules.
After Phase 4: `docs/design-system.md` documents the custom form widgets.

## Non-goals for this refresh

- No dark mode (separate effort)
- No animation library (keeping CSS transitions only)
- No new color *brand* (palette stays; usage tightens)
- No restructure of routes, components, or activity content rendering
