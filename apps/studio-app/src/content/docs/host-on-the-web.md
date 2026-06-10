---
title: Host on the web (no LMS)
description: Share a Kukui activity as a plain web page. Host it anywhere static, embed it in your site, or hand out a link. No LMS required.
order: 3
updated: 2026-06-10
---

# Host on the web (no LMS)

Not every activity needs to live in an LMS. When you download the **web package** from Studio (Download → *For the web*), you get a self-contained folder that runs as an ordinary web page. Learners see their score, their progress is saved in their browser, and, if you want, they can hand their results back to you without any server.

Use the web package when you want to:

- put an activity on a personal site, course homepage, or blog,
- embed it in WordPress, Notion, Google Sites, or a site builder,
- share a single link (or QR code) for self-study,
- pilot an activity before committing it to an LMS.

> **Web vs. SCORM.** The web package has no verified gradebook: anything a learner sends back is self-reported, so treat it as **formative / low-stakes**. For graded work, use the [SCORM package](/docs/upload-to-lms) and an LMS instead.

## What's in the web package

A `kukui-<activity>.web.zip` containing:

```
index.html              # the activity: open this
assets/                 # bundled JavaScript + CSS
samples/<activity>/      # your activity's JSON content
```

There is **no** `imsmanifest.xml` and **no** SCORM wrapper. It's just a web page. Open `index.html` over `http(s)` (most static hosts do this for you) and it runs.

## Where to host it

Any host that serves static files works. Unzip the package and upload its contents.

### Static hosts (drop the unzipped folder)

- **GitHub Pages**: commit the files to a repo, enable Pages, done. (Free.)
- **Netlify / Cloudflare Pages / Vercel**: drag the unzipped folder onto their deploy page.
- **Surge**: `surge ./` from the unzipped folder.
- **Amazon S3 + CloudFront**, **Firebase Hosting**: upload as a static site.
- **itch.io**: upload the zip as an HTML project (good for the 3D and tour activities).

### Embed in a site or CMS

Host the package somewhere (above), then embed the resulting URL:

- **WordPress**: add a **Custom HTML** block with an `<iframe src="…">`, or use an iframe plugin.
- **Google Sites**: **Insert → Embed → By URL**, paste the activity's URL.
- **Notion**: paste the URL and choose **Create embed**.
- **Wix / Squarespace / Webflow**: add an **Embed / HTML** element pointing at the URL.

```html
<iframe
  src="https://your-host.example.com/kukui-multiple-choice/"
  width="100%"
  height="640"
  style="border:0"
  title="Kukui activity"
  allow="camera; microphone"
></iframe>
```

> Keep `allow="camera; microphone"` only for activities that use them (Audio Recording, Video Reflection). Drop it otherwise.

### Just share a file

You can also drop the unzipped folder in a shared **Google Drive / Dropbox / OneDrive** folder and share the `index.html` link, or hand out a **QR code** pointing at any of the hosted URLs above.

## Collecting results (optional, no backend)

In the web package every learner sees a **completion panel** after they finish, with their score and two always-available options:

- **Completion code**: a short code they copy and email/paste back to you. Paste it into Studio's *Read a completion code* box to see their score.
- **Download results (JSON)**: a file with their score and every answer, which they submit to you.

If you want more, you can wire one of these when you package with the `--collect` flag (e.g. `node packaging/pack-scorm.js --target web --collect '{"email":"you@example.edu"}'`), or by hand-editing the `data-collect` attribute on the `#root` element in the unzipped package's `index.html`:

| Channel | What the learner sees | What you provide |
|---|---|---|
| **Email** | an "Email my results" button | your email address |
| **External form** | an "Open the form" button | a form URL (e.g. a Google Form) |
| **Webhook** | results POST automatically on finish | an `https://` endpoint that accepts JSON (must send CORS headers) |

All of these are backend-free and self-reported. See the note at the top about low-stakes use.

## Troubleshooting

**"The activity loads but Submit / the completion panel does nothing."**
The web package must be served over `http(s)`, not opened straight off the desktop as a `file://` path, because browsers block a `file://` page from loading the activity's JSON. Upload it to any host above (or run a local static server) and it works.

**"Grades aren't in my LMS."**
The web package intentionally has no LMS gradebook connection. If you need grades in an LMS, download the [SCORM package](/docs/upload-to-lms) instead.

**"The webhook didn't fire."**
The endpoint must return CORS headers (`Access-Control-Allow-Origin`) and accept a `POST` of JSON. Without them the browser blocks the request and the learner sees a "couldn't send" message with a retry.
