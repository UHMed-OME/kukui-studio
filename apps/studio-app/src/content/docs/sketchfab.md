---
title: Sketchfab integration
description: Sign in to Sketchfab and import your Creative Commons–licensed 3D models into Hotspot 3D activities.
order: 9
updated: 2026-05-15
---

# Sketchfab integration

Kukui Studio can sign in to Sketchfab via OAuth so you can browse and import your own Creative Commons–licensed 3D models directly into a **Hotspot 3D Identification** activity. The model is downloaded once, cached in your browser, and embedded into the SCORM package at export time, so learners using the activity never need a Sketchfab account themselves.

## Signing in

1. Open **Settings → Connections** in Studio.
2. Scroll to the **Sketchfab** section and click **Sign in to Sketchfab**.
3. Sketchfab's authorization page opens; click **Allow** to grant Kukui read access to your models.
4. You're redirected back to Studio and the section now shows **Signed in (token expires …)**.

The token Sketchfab issues is read-only and limited to model browsing + download. Kukui never uploads anything to Sketchfab, never sees your private models that aren't downloadable, and has no backend that could exfiltrate your token.

## How long the sign-in lasts

By default the token lives in **session storage**: it disappears when you close the tab. You can switch to **on this device** in the Sketchfab section to persist it across tab closes (the token still expires at whatever date Sketchfab set, usually ~30 days from sign-in).

Why session-by-default? The Sketchfab token is an OAuth Bearer; an attacker who exfiltrates one via XSS could browse and download anything you have read access to on Sketchfab. Session-only is the safer ceiling. The on-device option exists for authors who want the convenience and accept the trade.

## Supported licenses

Sketchfab models come with one of several Creative Commons licenses (or proprietary terms). Kukui only embeds models whose license permits redistribution within an educational SCORM package:

- **CC0**: public domain. Any use, no attribution required.
- **CC-BY**: any use with attribution.
- **CC-BY-SA**: any use with attribution; derivative works must use the same license.
- **CC-BY-NC**: non-commercial use only with attribution. Fine for educational use within a non-commercial institution.

Kukui **does not** embed models under:

- **CC-BY-ND** (no derivatives): embedding into an activity is arguably a derivative work; safer to skip.
- **CC-BY-NC-ND**: same reason.
- **Editorial** / **Standard** / proprietary Sketchfab licenses: terms vary; not safe to assume blanket redistribution.

When you try to import a model with an unsupported license, Studio shows a message explaining which license the model uses and links to Sketchfab's license documentation.

## Where the model lives after import

The `.glb` body is cached in your browser's IndexedDB so re-opening the activity doesn't re-download from Sketchfab. The cache survives tab close but can be cleared manually via the **Clear model cache** button in the Sketchfab section.

When you export the activity as a SCORM zip, the cached `.glb` is embedded into the package as a local asset, so learners using the activity never hit Sketchfab: the model loads directly from the SCORM zip.

## Signing out

The **Sign out of Sketchfab** button drops the cached token from your browser. The next time you try to import a model, Studio prompts you to sign in again. Signing out does **not** clear the model cache or any activities you've already created, only the token.

## Troubleshooting

**"Sketchfab integration isn't configured for this deployment."**
The deployment was built without the `VITE_SKETCHFAB_CLIENT_ID` environment variable. If you're self-hosting Kukui, set the variable to the Client ID Sketchfab issued for your OAuth app. If you're using kukuistudio.com, please file an issue.

**"State mismatch, possible CSRF. Sign-in aborted."**
Studio noticed a mismatch between the OAuth state nonce it generated and what came back from Sketchfab. Usually this means you opened the sign-in flow in one tab and completed it in another, or your browser blocks `sessionStorage`. Try the sign-in again in a single tab.

**Model loads in Sketchfab but won't import into Studio.**
Most often this is the license check rejecting an ND-licensed model. Check the license on the model's Sketchfab page; if it's CC-BY-ND or CC-BY-NC-ND, find a CC-BY or CC0 alternative.
