# Vendored: forever-ai-components (curated subset)

These `.html` files are vendored, unmodified, from the **forever-ai-components**
library as a *design reference* — not as a runtime dependency. Nothing here ships
in any Kukui build. They exist so we can read the CSS/Canvas/SVG techniques and
reimplement the worthwhile ones against the Kukui design system.

- **Upstream**: <https://github.com/isas1/forever-ai-components>
- **License**: MIT (see `LICENSE-forever-ai-components` in this folder)
- **Pinned commit**: `e099dbbdf7b0d3813bb68c1e6a97f6eb7952738b`
- **Vendored**: 2026-06-30
- **Scope**: 28 of 602 components, selected for relevance to Kukui's 7 activity types.

## Attribution (verbatim from upstream NOTICE.md)

> Every component in this library is **original code** that generates new, animated
> visuals. The components are not reproductions, scans, copies, or adaptations of
> any specific existing artwork. Some themes are inspired by historical artistic
> movements and public-domain art-history references. This project is not affiliated
> with, endorsed by, or connected to any artist, estate, museum, or brand; where an
> artist or movement name appears it is used descriptively only.

## Important: these are NOT token-compliant

Every vendored file uses **inline CSS with hardcoded hex colors** and is **vanilla
HTML/JS, not React**. Using one as-is would violate Kukui Hard Rule #1 (documented
design tokens only, no raw per-case hex) and the React/TS/Tailwind stack pin. Treat
them strictly as technique references. When porting:

1. Replace every hardcoded hex with a semantic token from `docs/design-system.md`.
   If a needed hue is missing, add the token *first* (design-system table → all three
   `apps/*/src/styles.css` `[data-color-scheme]` blocks → `tokens.ts`), WCAG-audited.
2. Reimplement as a React 19 component; drive animation from React state / CSS, not
   the standalone file's bare DOM script.
3. Honor the rest of the hard rules: layout-stable state changes (reserve space, change
   colors only, constant border widths), ≥44×44px tap targets, color never the sole
   signal, WCAG 2.2 AA.

## Refreshing

To re-pull or expand the subset, re-run the curation against a newer upstream commit
and update the pinned SHA above. See `INDEX.md` for the selection rationale.
