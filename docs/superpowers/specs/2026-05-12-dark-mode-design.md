# Dark mode

**Date:** 2026-05-12
**Repo:** kukui-studio
**Status:** Spec — not yet approved.

## Why

The site is currently light-mode-only. Two distinct user populations want dark:

1. **Authors** working in Studio late at night, or in dim lecture-prep environments.
2. **Learners** running activities inside an LMS that's already themed dark — the activity should match, not blast a cream surface into a dark course page.

Adding dark mode is one of the highest-ROI accessibility/comfort improvements we can ship.

## Approach

**Recommended: three-mode system (Light / Dark / Auto), with Auto as the default.**

- **Auto** follows `prefers-color-scheme`. Best default behavior — matches OS / browser preference without any user action.
- **Light** forces light regardless of OS.
- **Dark** forces dark regardless of OS.

User preference persists in `localStorage` as `kukui:theme = "auto" | "light" | "dark"`.

### Theme controller

We already have a small theme infrastructure:

- `packages/core/src/theme.ts` exports `applyTheme("glass" | "flat")` and `initTheme()` (currently hardcoded to glass).
- The root `data-theme` attribute drives `[data-theme="glass"]` CSS overrides.

The current "glass" / "flat" distinction is about *translucency*, not lightness. We're adding an orthogonal *brightness* axis. Two attributes is cleaner than collapsing them into one:

- `data-theme = "glass" | "flat"` (transparency, driven by `prefers-reduced-transparency`)
- `data-color-scheme = "light" | "dark"` (brightness, driven by user pref + auto-detect)

Combinations: glass-light (current default), glass-dark, flat-light (reduced-transparency users), flat-dark.

## Token strategy

The `@theme {}` block in `apps/studio-app/src/styles.css` defines all color tokens. Add a dark variant:

```css
:root[data-color-scheme="dark"] {
  --color-bg: #1a1814;
  --color-surface: #221f1a;
  --color-surface-alt: #2a2620;
  --color-text-primary: #f1ece2;
  --color-text-secondary: #b3aa9a;
  --color-text-muted: #8f8675;
  --color-border: #3a3528;
  --color-border-hover: #534b3a;
  --color-primary: #d68a5c;          /* lighter terracotta, readable on dark */
  --color-primary-hover: #e89c6e;
  --color-primary-soft: rgb(214 138 92 / 0.14);
  --color-success: #6db884;
  --color-success-soft: rgb(109 184 132 / 0.14);
  --color-error: #e88574;
  --color-error-soft: rgb(232 133 116 / 0.14);
  --color-tip-bg: #2a2620;
  /* Bloom-level colors brightened for dark backgrounds */
  --bloom-remember: #e2a854;
  --bloom-understand: #8fc474;
  --bloom-apply: #d97b58;
  --bloom-analyze: #b08fb8;
  --bloom-evaluate: #6db884;
  --bloom-create: #d68a5c;
}
```

The body gradient gets a dark variant too — cool warm-grey radials instead of amber/rose.

### Glass-on-dark

`--shadow-glass-card` and `--shadow-glass-pop` need rebalanced alphas in dark mode (the brown-tinted shadows that work on cream become invisible against `#1a1814`). Probably switch the shadow color to black at higher alpha for dark mode.

## Toggle UI

A simple segmented control in the header (between brand and toolbar) or in a settings dropdown:

```
☀ Light    ◐ Auto    ☾ Dark
```

Three states, click to switch. Persisted to localStorage. The Auto state shows the underlying resolved theme as a subtle indicator.

Where it lives:
- **Studio header** — first-class affordance for authors who spend hours in the editor
- **Landing nav** — same control, same position, in case visitors want to preview the dark site
- **Activity runtime (SCORM)** — *not* a toggle. The activity follows the host LMS context (via `prefers-color-scheme`), so learners get a coherent experience.

## Activity components

Each activity's CSS lives in `packages/core/src/components/<kind>/<Kind>.css`. Most already reference tokens (`var(--color-surface)`, `var(--color-text-primary)`), which means **they'll pick up dark mode for free** once the tokens cascade.

Audit will catch a few hardcoded hex values in some activities (color-mix expressions with literal hex). Mechanical sweep similar to the dashed-border cleanup earlier.

## Phasing

1. **Phase 1 (this spec):** Add `data-color-scheme` attribute system, dark token set in styles.css, light/dark/auto toggle in header + landing nav, persistence, OS-pref detection. Studio chrome only.
2. **Phase 2:** Audit + fix activity component CSS so every activity renders correctly in dark mode. Test all 24 activities visually.
3. **Phase 3 (optional):** Custom "high contrast" mode for accessibility users, or themes beyond light/dark (sepia, etc.). Defer.

## Non-goals

- No per-component dark customization beyond what the token cascade gives us.
- No themed brand asset (the kukui-logo.svg stays one color; it's already a silhouette that reads on both backgrounds).
- No animation between modes — instant swap. Smooth transitions invariably cause "flash" issues on first paint.
- No dark mode for the SCORM activity author's preview only — the preview and the deployed runtime should match.

## Open questions

1. Three modes (Light / Auto / Dark) or two (Light / Dark)? My recommendation: three, because Auto-as-default is the modern norm and removing it loses the "match my OS" affordance.
2. Where exactly should the toggle live? Header right side (next to Save/Download)? Settings dropdown? Bottom-left status strip?
3. The dark palette I sketched uses warm browns/oranges (consistent with the brand). Confirm direction — or go cooler (slate / blue-grey) to match more conventional dark UIs?
4. Should the `data-color-scheme` attribute live on `<html>` (cascades everywhere) or only on the Studio shell (activities outside Studio always default to system pref)?

## Cost estimate

- **Phase 1 (Studio chrome + landing):** ~1 day of dev work + visual review pass
- **Phase 2 (activity audit):** ~1 day across 24 activities
- **Maintenance:** ~5 min per new component (just reference tokens, don't hardcode hex)
