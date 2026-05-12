# Settings architecture

**Date:** 2026-05-12
**Repo:** kukui-studio
**Status:** Spec — not yet approved.

## Why

The current "Settings" surface is a single gear-icon button in the footer that opens `AISettingsDialog` — a 290-line modal that holds AI Assist preferences (provider, model, API key) and nothing else. With **language**, **dark mode**, and inevitably more user preferences on the way, that single-purpose dialog needs to evolve into a real settings system.

This spec covers the IA, surface design, and the migration path from the existing AI dialog. It does *not* design the individual settings panes — those land in their own feature work (i18n spec, dark mode spec).

## What goes in Settings?

| Section | Status | Description |
|---|---|---|
| **AI Assist** | Existing (`AISettingsDialog.tsx`) | Provider, model, API key, default mode |
| **Appearance** | Proposed (per dark mode spec) | Theme: Light / Auto / Dark. Possibly transparency override. |
| **Language** | Proposed (per i18n spec) | UI language picker; per-language default content notes |
| **Accessibility** | Proposed | Motion override, contrast preference, font-size scaling |
| **Privacy & data** | Existing (separate modal) | What's saved locally, what's sent to AI providers, draft-clear button |
| **About** | Implicit (in footer) | Version, links, MIT license, repo |

Six sections is a reasonable launch surface. The first three are "user prefers X"; the rest are informational or destructive-action surfaces.

## Surface design

Three architectures to choose from. The choice has real implications for both code and UX.

### Option A — Single multi-pane dialog

One modal with left-rail tabs:

```
┌─ Settings ─────────────────────────────┐
│  ┌──────────┐   ┌──────────────────┐   │
│  │ AI       │   │  Provider:       │   │
│  │ Appearance│  │  ○ Anthropic     │   │
│  │ Language │   │  ○ OpenAI        │   │
│  │ A11y     │   │                  │   │
│  │ Privacy  │   │  Model:          │   │
│  │ About    │   │  [dropdown]      │   │
│  └──────────┘   │                  │   │
│                 │  API key:        │   │
│                 │  [          ]    │   │
│                 │                  │   │
│                 └──────────────────┘   │
│                          [Close] [Save]│
└────────────────────────────────────────┘
```

**Pros:** familiar pattern (System Preferences, VS Code, every desktop app). Single entry point. All settings discoverable in one place. Scales well as we add more sections.

**Cons:** modal limits height; long content (Privacy, About) feels cramped. Tab navigation requires keyboard support.

### Option B — Dedicated `/settings` route

URL-based settings:

```
/settings              → redirects to /settings/ai
/settings/ai
/settings/appearance
/settings/language
/settings/privacy
```

Same vertical-tab layout but as a full page, not a modal.

**Pros:** room to breathe. Deep-linkable (support docs can say "go to Settings → Language"). Browser back works.

**Cons:** pulls the user out of the editor context. They have to navigate back. Not the dominant pattern for authoring tools (Figma, Notion use modals).

### Option C — Hybrid

Lightweight "quick toggles" inline in the header for the most-common controls (theme switcher, language picker as icon buttons), plus the full multi-pane dialog (Option A) behind the gear icon for everything heavier.

**Pros:** common settings are one click; full settings still discoverable. Mirrors how modern apps do it (think: Figma's theme toggle in the toolbar with a Preferences dialog behind a menu).

**Cons:** two surfaces for "settings" — slightly more code, two places to look for things.

### Recommendation: **C — Hybrid**

For Kukui specifically:
- Theme toggle benefits massively from being a 1-click header control (dark mode after sundown). Hiding it inside a 2-deep dialog is friction.
- Language toggle similarly — once you've picked it, you rarely change it, but the first switch should be instant.
- AI settings (API key entry, model picker) is too dense for a header dropdown. Belongs in the dialog.
- Privacy & About are read-mostly. Dialog is fine.

Concrete header additions for Phase 1 of this spec:
- **Theme toggle** — small icon button (sun/moon/auto), three states, persistent. Replaces what would otherwise be 1 of 6 dialog tabs.
- **Language picker** — small icon button (globe), dropdown with supported languages.

Everything else stays inside the gear-icon dialog, which becomes multi-pane.

## Migration from AISettingsDialog

The existing `AISettingsDialog.tsx` becomes the **AI pane** of the new multi-pane dialog, not a standalone component.

```
apps/studio-app/src/settings/
├── SettingsDialog.tsx          // shell with tab nav
├── panes/
│   ├── AIPane.tsx              // moved from AISettingsDialog.tsx
│   ├── AppearancePane.tsx      // (dark mode work plugs in here)
│   ├── LanguagePane.tsx        // (i18n work plugs in here)
│   ├── AccessibilityPane.tsx
│   ├── PrivacyPane.tsx         // moved from existing privacy modal
│   └── AboutPane.tsx
└── useSettings.ts              // shared persistence hook
```

The existing `showAISettings` state in `App.tsx` becomes `settingsPane: "ai" | "appearance" | ... | null`. Footer gear opens to the "ai" pane by default (matches current behavior). Header quick-toggles can open directly to "appearance" or "language" if the user clicks the "more…" affordance on a quick toggle.

## URL state (optional but valuable)

Even with the modal pattern, deep-linking to a specific settings pane is useful for docs ("To set your AI key, go to Settings → AI"). Add a query param:

```
/studio?settings=ai
/studio?settings=appearance
```

When the param is present on load, open the dialog to that pane. Closing the dialog clears the param. Implementation is ~5 lines using `useSearchParams`.

## Storage

All settings persist to `localStorage`. Two storage strategies:

- **One key per setting:** `kukui:theme`, `kukui:language`, `kukui:ai-settings`. Simple, each setting can be loaded independently.
- **One root key with a typed blob:** `kukui:settings = JSON.stringify({ theme, language, ai: {…} })`. Migrations are clearer (single version field at the root) but requires a centralized reducer.

**Recommendation:** one key per setting for now. We don't have migration pressure yet, and isolating storage keys makes failure modes simpler (a corrupt AI settings blob doesn't nuke the theme preference).

## Phasing

Settings is **infrastructure work** — it doesn't ship a visible feature by itself. So it can either:

- **Run ahead** as a separate small feature ("convert AISettingsDialog into the multi-pane SettingsDialog with just an AI pane"), so the dark-mode and i18n features have a clean place to plug in.
- **Run alongside** dark mode (the first new setting), which forces the multi-pane refactor.

**Recommendation: run ahead.** A 1-day refactor that produces a multi-pane shell with the existing AI pane intact. Then dark mode and i18n each add a single pane in their respective implementations — clean dependency direction.

## Non-goals

- No per-activity settings (those live in each activity's JSON config).
- No "user account" — Studio doesn't have accounts and isn't getting them. Settings are device-local.
- No settings export/import (defer; nice-to-have once there's enough surface to make it worthwhile).
- No "experimental features" pane (defer).

## Open questions

1. **Confirm the surface model.** Hybrid (C) is my recommendation. If you prefer everything in the dialog with no header quick-toggles (A), say so — saves a small amount of work and keeps the header less busy.
2. **Where does the gear icon live?** Currently in the footer. Other options: header (next to Save/Download), the right edge of the editor panel header (next to Reset). Footer is fine for a once-in-a-while interaction; header is fine if we want it more discoverable.
3. **Does the gear stay a gear, or become a menu trigger?** With multi-pane settings, the gear could open a small dropdown ("AI…", "Appearance…", "Language…", "Privacy…", "About") instead of directly opening the dialog. Adds a click but exposes the section structure visually.
4. **Privacy modal merge — yes or no?** Currently the footer has a "Privacy & data" link that opens its own dialog. Folding it into the multi-pane dialog as a "Privacy" tab keeps everything in one place but loses some of the current discoverability (footer link is more visible than a tab inside a dialog).

## Cost estimate

- **Infrastructure refactor (this spec):** ~1 day. Multi-pane dialog shell, AI pane migration, settings persistence hook, optional `?settings=` URL state, header quick-toggle scaffolding (even if both initial toggles are placeholders until dark mode + i18n features land).
- **Per new pane (dark mode, i18n, etc.):** spec'd in their own feature work; this refactor just gives them somewhere to live.
