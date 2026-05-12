# Landing page, routing, docs, blog

**Date:** 2026-05-12
**Repo:** kukui-studio
**Scope:** Add a real public homepage to kukuistudio.com, route the authoring tool to `/studio`, build a markdown-driven documentation system, build a blog/news system with one seed post.

## Why

`kukuistudio.com` currently drops first-time visitors straight into the authoring editor with a Flashcards default. There's no explainer, no on-ramp, no docs, no way to learn what the tool is before being thrown into the UI. We need:

1. A landing page so educators arriving cold can understand what Kukui Studio is and why to use it.
2. Documentation pages so authors can find guides on individual activities, the upload flow, and self-hosting.
3. A blog so we can ship release notes and announcements.

## Architecture decisions

| Decision | Choice | Why |
|---|---|---|
| Routing | React Router v7 | Clean public URLs; the GitHub Pages 404.html shim is one file |
| Default at `/` | Landing always, except `?activity=` URLs redirect to `/studio` | Respects existing bookmarks; otherwise everyone sees the landing |
| Hero visual | Auto-flipping Flashcard preview (reuses existing component) | Cheapest interactive moment with high payoff |
| Markdown | `react-markdown` + `remark-gfm` runtime | Drop-in `.md` files, no rebuild needed for content edits |
| Content location | `apps/studio-app/src/content/{docs,blog}/*.md` imported via `import.meta.glob` | In-repo content, version-controlled, PR-able |
| GitHub Pages SPA | `public/404.html` redirects to `index.html` with the path preserved in `sessionStorage` | Standard GitHub Pages SPA pattern |

## Information architecture

```
/                       Landing page
/studio                 Authoring tool (current App.tsx; ?activity= preserved)
/docs                   Docs index (linked list of all doc pages)
/docs/getting-started   First-author walkthrough (~5 min read)
/docs/activity-guide    All 24 activities with pedagogical notes
/docs/upload-to-lms     Lamakū upload steps + generic SCORM 1.2
/docs/live-mode         Kukui Live (alpha) — instructor + student flows
/docs/self-hosting      Fork + GitHub Pages deploy
/docs/contributing      How to add a new activity type
/blog                   Blog index — posts list with date / title / excerpt
/blog/[slug]            Individual post
```

## Phasing

Three independent shippable phases:

### Phase 1 — Routing + landing (this commit)

- Add `react-router-dom` and a minimal `BrowserRouter` setup
- Add `public/404.html` SPA fallback (GitHub Pages convention)
- Create `apps/studio-app/src/pages/Landing.tsx`
- Move current `<App />` rendering to `/studio` route
- URL migration: if `/` is hit with `?activity=X`, redirect to `/studio?activity=X` (one effect on mount)
- Header on landing + studio: clicking the brand wordmark links to `/`
- Landing page contains: hero, value props, activity catalog grid, how-it-works, developer footer

### Phase 2 — Docs system

- `apps/studio-app/src/pages/Docs.tsx` index + `apps/studio-app/src/pages/DocPage.tsx` per-page renderer
- `apps/studio-app/src/content/docs/*.md` (one file per page)
- `react-markdown` + `remark-gfm` + a small style sheet for prose
- Sidebar nav listing doc pages in `frontmatter.order`
- Seed pages: `getting-started.md`, `activity-guide.md` (stub), `upload-to-lms.md`, `live-mode.md` (alpha), `self-hosting.md` (stub linking to README), `contributing.md` (stub linking to README)

### Phase 3 — Blog system + seed post

- `apps/studio-app/src/pages/BlogIndex.tsx` + `apps/studio-app/src/pages/BlogPost.tsx`
- `apps/studio-app/src/content/blog/2026-05-12-kukui-studio-launch.md`
- Same markdown rendering as docs
- Index: cards with date, title, excerpt; sorted desc by date
- Post: full content + nav back to index

## Landing page — content outline

### Hero

- **Eyebrow:** `KUKUI STUDIO`
- **Headline (Source Serif 4, 56–64px):** *Interactive learning activities for any LMS.*
- **Sub (16px Inter):** "JSON-driven, SCORM-packaged, no backend. Made for medical education at UH JABSOM. Open-source — free for anyone."
- **Primary CTA:** *Open Studio* → `/studio`
- **Secondary CTA:** *Read the docs* → `/docs/getting-started`
- **Visual:** auto-flipping Flashcards mini-preview (component embedded inline, 360×240 card)

### Value props (4-up grid)

| Icon | Title | Body |
|---|---|---|
| Server-slash | No backend, no login | Studio runs entirely in your browser. Drafts auto-save to local storage; nothing is sent to a server we operate. |
| Universal access | WCAG 2.2 AA from day one | Keyboard fallbacks for every drag-and-drop, ARIA-labeled controls, focus-trapped modals, `prefers-reduced-motion` and `prefers-reduced-transparency` respected. |
| Download | SCORM 1.2 ready | Click *Download* and you get a `<title>.zip` you upload to Lamakū, Canvas, Moodle, or any SCORM 1.2 LMS. Grades flow back automatically. |
| Open | MIT-licensed | Fork the repo, host your own instance on GitHub Pages, customize the palette. No per-seat license, no SaaS lock-in. |

### Activity catalog (showcase)

A 6-tile grid showing the most distinctive activities with:
- Activity icon (reuse existing)
- Activity name (serif)
- One-sentence description
- Hover reveals a screenshot

Picks: Flashcards · Crossword · Image Hotspots · Drag and Drop · Anatomy Labeling · OSCE Encounter.

Below the grid: link "See all 24 activities" → `/docs/activity-guide`.

### How it works

4-step horizontal timeline:
1. **Pick an activity.** Browse by Bloom's taxonomy.
2. **Author content.** Fill the form, paste JSON, or use the AI editor.
3. **Download a SCORM zip.** One click; activity is packaged with everything it needs.
4. **Upload to your LMS.** Drop the zip into a course module. Grades report automatically.

### For developers & institutions

- 2-column section
- Left: "Self-host your own instance — fork, push, GitHub Pages. ~5 minutes."
- Right: "Contribute a new activity — the activity components live in `packages/core` with a Zod schema and a React component."
- Both link to docs.

### Footer

Same as current studio footer (privacy, GitHub, license).

## Documentation page — content outlines

Per-page frontmatter:
```yaml
---
title: Getting started
description: Open Studio, pick an activity, download a SCORM zip
order: 1
updated: 2026-05-12
---
```

### `getting-started.md` (~5 min read)
1. Open kukuistudio.com → Open Studio
2. Pick an activity from the sidebar
3. Fill in the form (title, prompt, content)
4. Preview live on the right
5. Click *Download / SCORM 1.2 zip*
6. Upload to your LMS (link to `upload-to-lms`)

### `activity-guide.md`
- Brief intro on Bloom's taxonomy organization
- Per-activity entries:
  - **Flashcards** — purpose, when to use, when not to, sample JSON snippet
  - **Crossword** — same shape
  - …all 24
- Initially: launch with 3-5 activities documented; rest as stubs marked "Coming soon."

### `upload-to-lms.md`
- Lamakū / D2L Brightspace step-by-step with screenshots
- Generic SCORM 1.2 notes (Canvas, Moodle, Blackboard)
- Troubleshooting: "Grades aren't appearing," "Activity won't load," etc.

### `live-mode.md` (alpha)
- What Live Mode is — real-time classroom sync
- Setting up an instructor session
- Sharing the 6-digit join code
- What students see
- Current limitations / alpha status

### `self-hosting.md`
- Fork the repo
- Enable GitHub Pages
- Push to main → workflow builds and deploys
- Custom domain setup
- Link to README's deploy section for command details

### `contributing.md`
- Brief intro to the architecture (3 apps + shared packages)
- Adding a new activity:
  1. Zod schema in `packages/schemas/src/<kind>.ts`
  2. React component in `packages/core/src/components/<kind>/`
  3. Starter in `apps/studio-app/src/starters.ts`
  4. Engine entry in `apps/engine-web/src/<kind>.html`
- Tests, conventions, PR checklist

## Blog — seed post

### `2026-05-12-kukui-studio-launch.md`

**Title:** Kukui Studio is here — interactive learning activities for any LMS

**Excerpt:** Today we're launching Kukui Studio, an open-source toolkit for building interactive learning activities that drop directly into Lamakū and other SCORM-compatible LMS platforms.

**Body sections:**
1. Why we built this — JABSOM's incumbent options didn't fit (proprietary, paid per-seat, couldn't fork)
2. What's in the box — 24 activities at launch, organized by Bloom's
3. Open-source from day one — MIT-licensed, fork-friendly
4. What's next — Kukui Live (alpha), more activity types, internationalization
5. How to try it — links to /studio and /docs/getting-started

## Non-goals (out of scope for this work)

- No analytics, no tracking pixels
- No newsletter signup
- No internationalization yet (English only)
- No CMS — content is markdown in the repo
- No comments on blog posts
- No dark mode toggle

## Open questions (decided later, after Phase 1 lands)

- Should the landing page have a "Showcase" gallery of real activities authors have built? (Requires consent + curation; defer.)
- Should `/docs/activity-guide` have a live "try it" widget per activity? (Would be great but expensive; defer.)
- RSS feed for blog? (Cheap to add later if anyone asks.)
