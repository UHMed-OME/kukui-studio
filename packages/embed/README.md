# @kukui/embed

A `<kukui-activity>` custom element that drops a hosted Kukui activity onto any
web page with one tag. It wraps the non-LMS **web package** (see
`docs/host-on-the-web.md`) in a lazy, responsive iframe — so the activity keeps
its own origin and its own localStorage persistence + completion panel, while
this element stays a few KB of dependency-free DOM code.

## Usage

Host a web package somewhere static, then:

```html
<script type="module" src="https://kukuistudio.com/embed/kukui-embed.js"></script>

<kukui-activity src="https://my-host.example.com/kukui-multiple-choice/"></kukui-activity>
```

The script above is the prebuilt bundle published with every Studio deploy
(staged from this package's `dist/index.js` by the Pages workflow). You can
also self-host the file — it's a single dependency-free ES module.

> **Sandbox caveat.** The iframe is created with `sandbox="allow-scripts
> allow-same-origin …"`. That combination provides **no isolation** when the
> web package is hosted on the *same origin* as the embedding page — a
> same-origin document with both flags can reach the parent and escape the
> sandbox entirely. If you want the activity isolated from your page, host
> the package on a separate origin (e.g. a dedicated subdomain like
> `activities.example.com`); the browser's cross-origin boundary is what
> actually does the isolating.

### Attributes

| Attribute | Default | Notes |
|---|---|---|
| `src` (required) | — | URL of a hosted package's `index.html` (or its folder). |
| `height` | `640` | Iframe height in px. |
| `title` | `Kukui activity` | Accessible iframe title. |
| `allow` | — | Feature-policy passthrough, e.g. `camera; microphone` for Audio Recording / Video Reflection. |
| `eager` | — | Present → mount immediately instead of lazily on scroll. |

The element lazy-mounts when scrolled near the viewport (via
`IntersectionObserver`), and listens for `{ type: "kukui:resize", height }`
postMessages from the framed activity to auto-grow — harmless today, ready for
auto-height later.

## Building

Pure DOM TypeScript — no React, no bundler required:

```bash
pnpm --filter @kukui/embed build   # tsc → dist/index.js (ES module)
```

For a CDN-ready single file, bundle `dist/index.js` (or `src/index.ts`) with any
bundler; it has no runtime dependencies.

## Why an iframe (and not an inline React mount)?

An inline mount would have to bundle the engine's React + Tailwind build and
re-create its theme inside a shadow root — a large, brittle artifact. The iframe
keeps the activity on its own origin (storage + CSP stay intact), keeps this
package tiny and framework-free, and works identically on every host. A
shadow-DOM inline element remains a possible future addition for same-page
state sharing.
