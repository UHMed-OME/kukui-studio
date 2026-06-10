---
title: Kukui Studio is here
excerpt: An open-source toolkit for building interactive learning activities that drop directly into any SCORM-compatible LMS.
date: 2026-05-12
---

# Kukui Studio is here

Today we're launching **Kukui Studio**: an open-source toolkit for authoring interactive learning activities that drop directly into Lamakū (D2L Brightspace), or Canvas, Moodle, Blackboard, or any LMS that speaks SCORM 1.2.

It's free, it runs entirely in your browser, and it ships with **24 activity types** at launch.

## Why we built this

Kukui started as a tool for medical education at the University of Hawaiʻi John A. Burns School of Medicine. The incumbent options for interactive content authoring didn't fit:

- The big-name SaaS authoring tools wanted per-seat fees we couldn't sustain across faculty.
- The free options either weren't WCAG-conformant or required hosting an external service.
- We needed activities that go beyond what an LMS natively offers: drag-and-drop on a clinical image, 3D anatomy hotspots, OSCE-style multi-phase encounters, branching diagnostic-reasoning trees.

So we built it. And because we couldn't find a good free option, we open-sourced ours.

## What's in the box

24 activity types organized by **Bloom's revised taxonomy**: pick the cognitive level you want to exercise, and the activity follows:

- **Remember:** Flashcards, Matching Pairs, Crossword
- **Understand:** Image Hotspots, Anatomy Labeling, Highlight Text
- **Apply:** Drag and Drop, Sequence Steps, Categorization, 3D Hotspots, Virtual Tour, Interactive Video
- **Analyze:** Image Annotation, Image Comparison Slider, Concept Map, Lab Panel
- **Evaluate:** Branching Scenario, Differential Diagnosis Tree, Reflection Prompt, OSCE Encounter
- **Create:** Audio Recording

Plus five **Live mode (alpha)** activities for in-class synchronous use: Straw Poll, Confidence Meter, Word Cloud, Q&A Board, Quick Quiz.

See the [activity catalog](/docs/activity-guide) for what each one is for.

## AI-assisted authoring

Don't want to fill in 20 form fields? Describe what you want in plain English:

> "Make a flashcard set for the cranial nerves: front shows the nerve number, back has the name and main function."

The **AI Assist** tab uses your API key (Anthropic or OpenAI, your choice) and drafts the activity for you. You can apply the result, tweak it, or undo. Studio doesn't proxy your keys; the request goes directly from your browser to the model provider.

## Free, open-source, no server

Every Kukui activity is a Zod-validated JSON config. The whole tool runs in your browser: drafts auto-save to local storage, nothing is sent to a server we operate. Want full control? Fork the repo, push to your own GitHub account, and your institution has its own free instance in five minutes. See [Self-hosting](/docs/self-hosting).

The code is **MIT-licensed**. Use it, fork it, sell consulting on top of it. If you build something cool with Kukui, we'd love to hear about it.

## What's next

The launch backlog, in roughly the order we're working on it:

- **More activity types**: especially clinical-reasoning-flavored ones (algorithm walkthroughs, simulated rounds)
- **Live mode → beta**: persistent room IDs, result export, larger-classroom support
- **Internationalization**: all strings are currently inline; pulling them into a translation layer
- **Better author-side analytics**: "how long did learners spend?" without sending data to us

## Try it

- **[Open Studio](/studio)**: start authoring
- **[Getting started guide](/docs/getting-started)**: five minutes from "open the URL" to "SCORM zip in hand"
- **[GitHub](https://github.com/UHMed-OME/kukui-studio)**: source, issues, contributing
