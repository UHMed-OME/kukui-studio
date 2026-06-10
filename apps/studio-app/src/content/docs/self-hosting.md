---
title: Self-hosting
description: Fork the repo and run your institution's own instance of Kukui Studio on GitHub Pages, free, in about five minutes.
order: 6
updated: 2026-06-10
---

# Self-hosting

You can run your institution's own instance of Kukui Studio for free on GitHub Pages. The whole process takes about five minutes if you already have a GitHub account.

## Why self-host

- **Trust and continuity**: even though kukuistudio.com is open-source and free, you might want a copy you control. If we ever sunset the public instance, your fork keeps working.
- **Customization**: change the brand wordmark, swap the color palette, add institution-specific defaults, ship a curated subset of activities.
- **Privacy posture**: Studio doesn't send your data anywhere, but some institutions prefer "the URL is on our infrastructure" as a security policy.

## What you need

- A GitHub account
- About 5 minutes

That's it. No servers, no Docker, no CI to configure.

## Steps

### 1. Fork the repo

Go to **[github.com/UHMed-OME/kukui-studio](https://github.com/UHMed-OME/kukui-studio)** and click **Fork**. You'll get your own copy at `github.com/<your-name>/kukui-studio`.

### 2. Enable GitHub Pages

In your fork:

1. Go to **Settings → Pages**.
2. Under **Source**, choose **GitHub Actions**.
3. Save.

### 3. Push to main

The repo ships with a pre-configured workflow (`.github/workflows/pages.yml`) that builds and deploys Studio on every push to `main`. The first push (which already happened when you forked) triggers a build automatically; check the **Actions** tab to watch it.

The workflow figures out the right URL paths on its own: a fork is built with `/<repo-name>/` as the base path, so once the workflow finishes your instance is live at:

```
https://<your-github-username>.github.io/<repo-name>/
```

(If you kept the default repo name, that's `https://<your-github-username>.github.io/kukui-studio/`.) Renaming the repo is fine: the base path follows the repo name automatically on the next deploy.

### 4. (Optional) Custom domain

If you want your own domain (e.g. `kukui.<your-institution>.edu`):

1. In **Settings → Pages**, add your custom domain.
2. Create a CNAME DNS record pointing your subdomain to `<your-github-username>.github.io`.
3. Add a `CNAME` file containing your domain to `apps/studio-app/public/` in your fork. This is what tells the build to use `/` as the base path instead of `/<repo-name>/`. Without it, the deploy still assumes it lives under the repo-name subpath and assets won't resolve on your domain.
4. Wait a few minutes for DNS to propagate and the cert to issue.

## Customization

The places to change in a fork:

| Want to change… | Edit… |
|---|---|
| Brand wordmark text | `apps/studio-app/src/App.tsx` (the header) and `apps/studio-app/src/pages/Landing.tsx` |
| Logo | Replace `apps/studio-app/public/kukui-logo.svg` |
| Color palette | `apps/studio-app/src/styles.css` (the `@theme {}` block at the top) |
| Which activities appear in the sidebar | `apps/studio-app/src/App.tsx` (the `STUDIO_SUPPRESSED` set: add a kind to hide it). Labels, descriptions, and Bloom placement come from each activity's `packages/activities/<slug>/meta.ts` |
| Footer copy | `apps/studio-app/src/pages/Landing.tsx` and the footer in `App.tsx` |

## Updating from upstream

Periodically pull in changes from the original repo:

```bash
git remote add upstream https://github.com/UHMed-OME/kukui-studio.git
git fetch upstream
git merge upstream/main
git push
```

The workflow will rebuild and redeploy automatically.

## Live mode and TURN

Self-hosting covers Studio (and Live, which is served the same static way). One thing GitHub Pages *can't* host is a **TURN server**: the relay Live needs for students on restrictive campus or guest Wi-Fi. That's a small always-on VPS, separate from your Pages deploy. If your classes hit "waiting for the instructor" across devices, see [Hosting a TURN server](/docs/turn-server).

## Contributing back

If you build something useful (a new activity type, a bug fix, a translation), please consider opening a pull request to the upstream repo. See [Contributing](/docs/contributing) for the architecture overview.
