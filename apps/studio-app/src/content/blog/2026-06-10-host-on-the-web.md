---
title: Activities without an LMS — the web package
excerpt: Download any Kukui activity as a self-contained web page. Host it anywhere static, embed it in your site, or hand out a link — no SCORM, no LMS, no server.
date: 2026-06-10
---

# Activities without an LMS — the web package

When we launched, every Kukui activity went out the same door: a **SCORM 1.2 zip** you upload to Lamakū, Canvas, Moodle, or another LMS. That's still the right path for graded work — but it assumes you *have* an LMS that speaks SCORM, and plenty of the ways people actually want to share an activity don't involve one at all.

Today there's a second door. Every activity can now be downloaded as a **web package**: a self-contained folder that runs as an ordinary web page. No SCORM wrapper, no manifest, no server to operate.

## One click in Studio

Open any activity and you'll see a new button next to *Download SCORM*:

> **Download → For the web**

You get a `kukui-<activity>.web.zip` with an `index.html`, the bundled assets, and your activity's JSON. Unzip it, upload the contents to anything that serves static files, and it runs:

- **GitHub Pages, Netlify, Cloudflare Pages, Vercel** — drop in the folder.
- **WordPress, Google Sites, Notion, Wix, Squarespace** — embed the hosted URL in an iframe.
- **Google Drive / Dropbox / OneDrive** — share the `index.html` link, or hand out a QR code.

Learners see their score immediately, and their progress is saved in their own browser — so they can close the tab and pick up where they left off, exactly like the LMS path, just backed by local storage instead of a gradebook.

## Getting results back — without a backend

The web package has no verified gradebook, so anything a learner sends back is **self-reported**. We've kept that honest and lightweight. Every learner finishes on a completion panel with two always-available options:

- **Completion code** — a short code they copy and send you. Paste it into Studio's **Settings → Results** to read back their score.
- **Download results (JSON)** — a file with their score and every answer.

If you want more, package with the `--collect` flag (or hand-edit one attribute in the unzipped `index.html`) to add an **email button**, an **external form** link (e.g. a Google Form), or an **`https://` webhook** that posts results automatically. All of it is backend-free.

> Because results are self-reported, treat the web package as **formative / low-stakes**. For graded work, the [SCORM package](/docs/upload-to-lms) and a real LMS gradebook are still the way to go.

## Embedding

For sites and CMSes, host the package and drop in an iframe pointing at its URL — that's the most portable option and works everywhere. There's also a small `<kukui-activity>` custom element for cleaner, lazy-loaded embeds when you control the page's markup.

## Why this matters

A lot of good teaching happens outside the LMS — a course homepage, a personal site, a self-study link before a session, a quick pilot before you commit an activity to Brightspace. The web package means a Kukui activity can live in any of those places with the same authoring workflow you already use, and the same accessibility guarantees.

It's the same engine, the same JSON, the same activities — just unbundled from the LMS.

## Try it

- **[Host on the web](/docs/host-on-the-web)** — the full guide: hosting, embedding, and collecting results
- **[Open Studio](/studio)** — author an activity and hit *Download → For the web*
- **[GitHub](https://github.com/UHMed-OME/kukui-studio)** — source, issues, contributing
