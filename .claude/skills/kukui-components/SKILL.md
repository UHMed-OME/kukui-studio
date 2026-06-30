---
name: kukui-components
description: Reference shelf of vendored motion/interaction techniques (from forever-ai-components) mapped to Kukui's 7 activity types. Use when designing or building the VISUAL/INTERACTION layer of an activity — selection states, correct/incorrect feedback, progress, drag-and-drop, slide nav, 3D hotspot/orbit, or tour scene nav — and you want a proven CSS/Canvas/SVG technique to adapt. NOT a component installer; everything must be ported to Kukui tokens + React before use.
---

# Kukui component reference shelf

A curated, vendored set of 28 single-file UI components kept purely as a **technique
reference**, indexed by Kukui activity type. The source files live in
[docs/references/forever-ai-components/](../../../docs/references/forever-ai-components/);
the full mapping with per-component port notes is
[INDEX.md](../../../docs/references/forever-ai-components/INDEX.md).

This skill is for the *look-and-feel and interaction* layer. For activity content
authoring or scaffolding a new activity type, use `/kukui` instead.

## When to use

Reach for this when a task involves how an activity *moves or responds*:

- Selection / selected / correct / incorrect states (Multiple Choice, Question Set)
- Progress bars or score rings (Question Set)
- Character/word entry or word-bank chips (Fill in the Blanks)
- Drag-to-reorder / categorize, especially the **FLIP** technique (Drag and Drop)
- Slide nav, indicators, deck transitions (Course Presentation)
- Reveal / orbit / focus-a-point and exploded views (3D Hotspot Identification)
- Scene nav, ambient 3D, loading states (Virtual Environment Tour)

## How to use it

1. Open [INDEX.md](../../../docs/references/forever-ai-components/INDEX.md) and find the
   section for the activity type you're working on.
2. Read the candidate file(s) for the *technique* — the CSS keyframes, the Canvas/SVG
   math, the FLIP bookkeeping. Ignore their visual styling and structure.
3. Reimplement in React against the Kukui design system. **Do not import, embed, or
   copy a file wholesale.**

## Non-negotiable porting rules

Every vendored file is vanilla HTML/JS with **hardcoded hex** — using one as-is breaks
the project's hard rules. When porting (see also
[NOTICE.md](../../../docs/references/forever-ai-components/NOTICE.md)):

1. **Tokens only.** Replace every hex with a semantic token from
   [docs/design-system.md](../../../docs/design-system.md). If a hue is missing, add the
   token *first* (design-system table → all three `apps/*/src/styles.css`
   `[data-color-scheme]` blocks → `tokens.ts`), WCAG-audited (≥4.5:1 text) across all schemes.
2. **React, not bare DOM.** Drive animation from React state / CSS, not the file's
   standalone script.
3. **Layout-stable** (Hard Rule #2): reserve space, change colors only, keep border
   widths constant across states. The fill/outline/FLIP picks already respect this.
4. **≥44×44px** tap targets (Rule #3).
5. **Color never the sole signal** (Rule #4): keep the paired checkmark/icon/position cue.
6. **WCAG 2.2 AA** and honor `prefers-reduced-motion`. Add keyboard support to any
   pointer-only reference before shipping it interactive.
7. Heavy-tier references (spotlight mask, magnetic dot, rotating cube) need a perf check
   and a non-pointer fallback.

## Maintenance

The subset is pinned to upstream commit `e099dbbd…`. To expand or refresh it, re-curate
against a newer commit (the full upstream index is `infinite/components.index.json` —
filter with code), copy files into the references folder, and update INDEX.md + the
pinned SHA in NOTICE.md.
