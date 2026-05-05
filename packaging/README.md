# Packaging — SCORM 1.2 zips

Wraps a Vite build of one Kukui activity into a SCORM 1.2 zip ready for upload to D2L Brightspace (Lamakū).

## Usage

```bash
# Build the apps first
pnpm build

# Pack one activity
node packaging/pack-scorm.js --activity multiple-choice

# Pack all seven Phase 1 activities
node packaging/pack-scorm.js --all

# Or in one shot
pnpm build:scorm:all
```

Output zips land in `packaging/build/kukui-<activity>.scorm.zip`.

## What's in the zip

```
imsmanifest.xml         # SCORM 1.2 manifest, 70-mastery threshold
index.html              # The activity entry (renamed from <activity>.html)
pipwerks.SCORM.min.js   # SCORM 1.2 wrapper, loaded before the entry script
assets/main-*.js        # Bundled React + activity component
assets/main-*.css       # Tailwind-built styles
samples/<activity>/     # JSON fixtures (default ?config= points at basic.json)
```

The Vite build emits with `base: "./"` so all asset URLs are relative — that lets D2L serve the zip from any sub-path without 404s.

## Flags

| Flag | Default | Notes |
|---|---|---|
| `--activity <slug>` | — | One activity. Required unless `--all`. |
| `--all` | — | Pack every Phase-1 activity at once. |
| `--build <dir>` | `apps/engine-web/dist` | Vite build directory. |
| `--samples <dir>` | `apps/engine-web/public/samples` | Sample fixtures root. |
| `--out <dir>` | `packaging/build` | Where the zips land. |
| `--title <s>` | titleized slug | Manifest title. |
| `--default-config <path>` | `samples/<activity>/basic.json` | Baked into manifest `?config=`. |
| `--identifier <s>` | derived from slug | Manifest `<manifest identifier>`. |
| `--mastery <n>` | `70` | SCORM mastery score (0–100). |
| `--engine [react\|unity\|godot\|articulate\|raw]` | `react` | Phase 1.5 hook. Currently only `react` is wired up. |

## Testing the zip without Lamakū

Use [SCORM Cloud](https://cloud.scorm.com/) free tier — drop the zip into a course, launch as a student, watch the run-time API logs. Sufficient to validate manifest, init, score commit, suspend_data, and terminate before paying for an LMS slot.

## Mastery score & D2L

`70` (the SCORM-scaled 0–100 score, not raw points) maps to `cmi.core.lesson_status = passed` when `cmi.core.score.raw / cmi.core.score.max * 100 >= 70`. D2L's gradebook reads `cmi.core.score.raw` directly. Override with `--mastery 50` for low-stakes formative use.
