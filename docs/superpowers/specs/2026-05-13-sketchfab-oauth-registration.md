# Sketchfab OAuth — registration ticket + implementation spec

**Date:** 2026-05-13
**Repo:** kukui-studio
**Status:** Spec — registration prereq not yet completed.

## Prereq: file the support ticket

Sketchfab requires emailing/ticketing them to register an OAuth app. Submit at https://support.fab.com/s/?ProductOrigin=Sketchfab with the following information.

---

### 📧 Registration ticket — ready to paste

**Subject:** Register OAuth application — Kukui Studio (educational use)

**Body:**

> Hi Sketchfab team,
>
> I'd like to register an OAuth application so educators using our open-source authoring tool can sign in to Sketchfab and use their Creative Commons–licensed models in interactive learning activities.
>
> Here's the information requested in your developer docs (https://sketchfab.com/developers/oauth):
>
> **Application name:** Kukui Studio
>
> **Grant type:** Implicit
> (Kukui Studio is a browser-only single-page application with no backend server, so we can't safely hold a Client Secret. Implicit grant is the only flow Sketchfab supports that fits this constraint.)
>
> **Redirect URI:** `https://kukuistudio.com/auth/sketchfab/callback`
> (HTTPS, GitHub Pages–served. We can add additional redirect URIs for self-hosted institution instances later if you support multiple.)
>
> **Sketchfab username:** jessetho@hawaii.edu
>
> **About Kukui Studio:**
>
> - Open-source, MIT-licensed: https://github.com/UHMed-OME/kukui-studio
> - Live at https://kukuistudio.com
> - Authoring tool for interactive learning activities used in medical and online education
> - We need OAuth so authors can sign in to Sketchfab, browse their CC-licensed models, and import them into 3D Hotspot Identification activities. The activities then ship as SCORM 1.2 packages for use in LMS platforms (Brightspace, Canvas, Moodle).
> - All Creative Commons license terms (attribution, source link, license display) are rendered in the activity footer when authors import a model.
>
> Thanks — happy to provide any additional information.
>
> — Jesse Thompson
> UH JABSOM (University of Hawaiʻi, John A. Burns School of Medicine)
> jessetho@hawaii.edu

---

### What you'll get back

Sketchfab responds with:
- **Client ID** — public, ships in the Kukui Studio source
- **Client Secret** — *we won't use this* because Implicit grant doesn't need it. Store it somewhere safe just in case the policy changes.

---

## Implementation spec (after registration)

### Stack

- **Grant type:** Implicit (per Sketchfab's supported list; Authorization Code needs the Secret server-side, Username/Password is hostile UX)
- **Token lifetime:** Sketchfab Implicit tokens last ~30 days then re-auth
- **Token storage:** Reuse the AI Assist storage pattern from `apps/studio-app/src/ai/settings.ts` — author picks persistent (`localStorage`) or session-only (`sessionStorage`)
- **Model cache:** IndexedDB blob store, keyed by Sketchfab UID. Tokens for the download URL itself are short-lived (~minutes), but the .glb body can be cached for the session

### Routes

- New `/auth/sketchfab/callback` route in `apps/studio-app/src/main.tsx`. Parses `window.location.hash` (Implicit puts the token in the fragment, not query string), stores the token, redirects to the user's pre-auth URL (stashed in sessionStorage before the redirect).

### Files

```
apps/studio-app/src/sketchfab/
├── settings.ts          // token storage (mirrors ai/settings.ts shape)
├── client.ts            // OAuth start, token parsing, API calls
├── modelCache.ts        // IndexedDB blob store
└── useSketchfabAuth.ts  // hook: { token, signIn, signOut, status }

apps/studio-app/src/pages/AuthCallback.tsx
                         // /auth/sketchfab/callback route handler
```

### Editor flow

In `Hotspot3DEditor.tsx`'s `AttributionPanel`:

1. If not signed in → show a "Sign in to Sketchfab" button
2. If signed in → show a "Sketchfab URL" input + "Load model" button
3. On Load: parse UID → `GET /v3/models/{uid}` (metadata + license check) → `GET /v3/models/{uid}/download` (signed download URLs) → fetch .glb → store in IndexedDB → set `model.src` to a blob URL → fill `model.attribution` from metadata

### Settings dialog

New tab in `SettingsDialog.tsx` between AI Assist and About: **Integrations**. Initial content: Sketchfab sign-in/sign-out + storage preference. Future home for other third-party services.

### Configuration

- `SKETCHFAB_CLIENT_ID` constant in code (it's public, lives in the repo)
- Hardcoded for now; if a self-hosting institution wants its own OAuth app they fork + replace

### Security notes

- Client ID is public, fine to commit
- Token never leaves the browser (no backend to send it to)
- Sketchfab signed download URLs expire in minutes — we fetch on demand, never store the URL long-term, only the resulting blob

### Limits & risks

- Implicit grant tokens in URL fragment are visible to scripts running in the auth-callback context. We immediately parse, store via our settings module, then strip the fragment via `history.replaceState` — same hygiene as the existing `_kkb` cache-bust marker handling.
- Sketchfab rate limits aren't publicly documented; if we hit limits we'll add backoff to the client.
- If Sketchfab deprecates Implicit grant before they support Authorization Code with PKCE, we'd need a serverless function (Cloudflare Worker, etc.) to hold the secret. Plan for that contingency but don't build it until needed.

### Out of scope

- No Sketchfab content browsing UI in Studio (paste a URL, that's it). A model picker is a separate feature.
- No upload-to-Sketchfab from Studio.
- No automatic license refresh — author re-imports if Sketchfab changes the model's license.

## Next steps

1. **User**: file the support ticket above. Wait for Sketchfab to respond with a Client ID (typical: 1–3 business days).
2. **Once Client ID lands**: implement the scaffolding (modelCache, settings, OAuth flow, callback route, Integrations pane). ~1 day of focused work.
3. **Hook into the Hotspot 3D editor**: replace the manual AttributionPanel "Sketchfab URL" field with the OAuth-aware flow. ~half day.
4. **Docs**: add a "Sketchfab integration" page to `/docs` explaining the sign-in flow + the supported CC license types.

## Decision: scaffold now or wait?

**Recommendation: wait for the Client ID before writing any OAuth code.**

The entire flow depends on having a working Client ID. We could scaffold the structure (routes, settings storage, IndexedDB helper) but every layer touches the Sketchfab API at some point and can't be tested end-to-end. Risk of building something that doesn't quite work and then having to revise once we see real Sketchfab response shapes.

The IndexedDB blob cache and the settings-pane addition are independently useful — those *could* land first. But that's also feature work happening for a feature we haven't decided to fully invest in yet.

Cleanest plan: file the ticket, wait, then implement in one focused session once the Client ID is in hand.
