---
title: Upload to your LMS
description: Drop a Kukui activity zip into Brightspace, Canvas, Moodle, or any SCORM 1.2 LMS.
order: 2
updated: 2026-05-12
---

# Upload to your LMS

Every Kukui activity downloads as a **SCORM 1.2 zip file**. SCORM is a standard that almost every LMS speaks: Brightspace (Lamakū), Canvas, Moodle, Blackboard, Sakai, OpenLMS, and most others.

The general flow is the same everywhere:

1. Create a new content item in your course
2. Choose "SCORM package" (the exact wording varies)
3. Upload the zip you got from Studio
4. Link the new item to a grade item so scores flow through

Below are step-by-step instructions for the most common LMS platforms.

## Brightspace (Lamakū)

1. In your course, go to **Content** → the unit or module where the activity should live.
2. Click **Upload / Create** → **SCORM Object**.
3. Choose the zip you downloaded from Studio. Brightspace unpacks the package and adds it as a new topic.
4. Open the new topic, click the **gear icon** → **Edit Properties In-place**, and link it to a numeric grade item. Pass percentage and points-out-of are configured on the grade item itself, not on the activity.

The Kukui activity reports `raw / max` (scaled to 0–100) and `passed` / `failed` to Brightspace. Completion-only activities (Reflection, Audio Recording, Image Comparison Slider, Flashcards) always submit `100% / passed` so the gradebook records full credit on completion; they're engagement activities, not assessment items.

## Canvas

1. In your course, go to **Settings** → **Navigation** and ensure **SCORM** is enabled. (Canvas hides this by default.)
2. Click **SCORM** in the course navigation.
3. Click **Upload** and choose your zip.
4. After upload, click the activity row's gear icon → **Edit**. Set "Import type" to **Import as a Graded Assignment** if you want scores to flow into the gradebook.
5. Open the resulting assignment, set points and grade display.

## Moodle

1. Go to your course and turn on **Edit mode**.
2. Click **Add an activity or resource** → choose **SCORM package**.
3. In **Package**, drag your zip into the upload area.
4. Set **Grade method** to "Highest grade" (or whatever fits your assessment).
5. Save and return to course.

## Blackboard

1. In your course, go to the content area where the activity should live.
2. Click **Build Content** → **Content Package (SCORM)**.
3. Upload the zip.
4. Set **Grading** options as needed; Blackboard creates a column in the Grade Center automatically.

## Generic SCORM 1.2 LMS

Any LMS that advertises SCORM 1.2 (or SCORM 2004) support will accept Kukui zips. The package contains an `imsmanifest.xml` that the LMS reads on upload; no special configuration is needed on your side.

## Scoring details

Kukui activities report two SCORM fields:

| Field | What it carries |
|---|---|
| `cmi.core.score.raw` | Score scaled to 0–100 (so the gradebook always sees a comparable percentage) |
| `cmi.core.lesson_status` | `"passed"` or `"failed"` |

For activities that are **completion-only** (Reflection, Audio Recording, Image Comparison Slider, Flashcards), the activity always reports `100 / passed` on submission; they record full credit for completing the activity rather than scoring against an answer key.

## Troubleshooting

**"The activity won't open in my LMS."**
Check that the zip is the **direct download** from Studio, not a zip-of-zip. Some operating systems wrap the download in another folder; unzip once and re-upload the inner `imsmanifest.xml`-containing zip.

**"Grades aren't appearing in the gradebook."**
The new activity needs to be **linked to a grade item** (Brightspace) or set as a **graded assignment** (Canvas) before scores propagate. Until that link exists, the activity reports a score but the LMS doesn't know where to put it.

**"The activity loads but the Submit button does nothing."**
Open your browser's developer console and check for SCORM API errors. The most common cause is the activity being opened **outside an LMS context** (e.g., directly opened from the desktop), where the SCORM bridge can't find the LMS's API window. Inside the LMS, this works automatically.
