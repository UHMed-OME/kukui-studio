---
title: Activity catalog
description: The activity types organized by Bloom's taxonomy, with pedagogical notes on when each one shines.
order: 4
updated: 2026-06-10
---

# Activity catalog

Kukui Studio ships with more than two dozen interactive activity types, organized by **Bloom's revised taxonomy** — six cognitive levels that climb from "recall" through "create." This guide covers the core catalog. Picking the right activity starts with knowing what cognitive work you want learners to do.

## Remember — recall facts and terminology

### Flashcards
Self-paced two-sided card deck with a spaced-style retry loop: cards the learner says they "didn't know" cycle back into the deck until mastered. Self-rating is honor-system, so flashcards are graded as completion-only.

**Best for:** memorizing terminology, drug names, anatomical structures, equations. Pre-class prep work.
**Skip if:** you need to verify the learner actually got the right answer — Flashcards trust self-rating.

### Matching Pairs
Click an item on the left, then its match on the right. Right column shuffles on load. On submit, wrong rows show "Correct match: X" so the learner sees the pairing.

**Best for:** vocabulary, term–definition, drug–mechanism, disease–presenting-symptom pairings.

### Crossword
Author provides a list of `{ term, definition }` entries; the runtime randomly lays out a connected crossword grid. Scoring is per-cell; "Reveal letter" / "Reveal word" affordances cost the revealed cells.

**Best for:** terminology review with a playful tone. Group activities, end-of-unit recap.

## Understand — identify, explain, classify

### Image Hotspots
Pick the correct region of an image. Single-correct (use 3D Hotspots for spatial work). Includes a keyboard fallback list of named regions for screen-reader users.

**Best for:** anatomical landmarks on flat images, radiology findings, identifying instruments on a tray.

### Anatomy Labeling
Drag named labels to anchor points on a diagram. Each target accepts exactly one label.

**Best for:** anatomy quizzes, parts-of-a-cell, parts-of-an-organ.

### Highlight Text Spans
Click words/phrases in a sentence; correct selections gain points, wrong ones lose them. After submit, dashed outlines appear on tokens the learner missed.

**Best for:** identifying grammar elements, picking out relevant clinical features in a vignette.

## Apply — use procedures in new contexts

### Drag and Drop
Drop labeled chips onto rectangles overlaid on a background image. Supports many-to-one (multiple chips on one zone).

**Best for:** procedural diagrams, placing items in a workspace, sequencing steps that are spatial rather than temporal.

### Sequence Steps
Arrange shuffled items in the correct order. Shuffle algorithm guarantees the start order isn't already correct.

**Best for:** procedural workflows, surgical step-orders, time-ordered events.

### Categorization
Sort items into named bins. No capacity limit per bin (vs. Drag and Drop).

**Best for:** classifying drugs by mechanism, organisms by kingdom, signs by body system.

### 3D Hotspots
Same as Image Hotspots but on a 3D model (glTF/glb), rendered with WebGL. Falls back to a button list when WebGL is unavailable.

**Best for:** 3D anatomy, identifying parts on a model, spatial reasoning on a structure that doesn't read well in 2D.

### Virtual Tour
A 3D scene with clickable info overlays. Two completion modes: `manual` (Submit when ready) or `visitAll` (auto-completes when every required overlay has been visited).

**Best for:** clinical environments, lab walkthroughs, "what would you do here" tours of a setting.

### Interactive Video
A video player that pauses at author-chosen timestamps and overlays a sub-activity (multiple-choice or fill-in-the-blanks).

**Best for:** lecture videos with comprehension checks, procedural videos with "what happens next?" pauses.

## Analyze — break apart, compare, infer

### Image Annotation
The learner draws on an image with rectangle, circle, arrow, or freehand tools. Optional `expectedAnnotations[]` lets authors set ground-truth regions; scoring uses Intersection-over-Union ≥ 0.5 per expected region.

**Best for:** "circle the abnormality" radiology, marking up histology slides, annotating ECGs.

### Image Comparison Slider
Before/after images with a draggable seam. Engagement-only scoring.

**Best for:** before-after surgical photos, treatment progression, normal-vs-abnormal comparisons.

### Concept Map
Free-form node + edge graph builder. Optional `expected.nodes[]` and `expected.edges[]` enable scoring against a target map.

**Best for:** showing relationships between concepts, building disease–symptom–treatment graphs.

### Lab Panel
A clinical lab values table where the learner flags abnormal results, then picks the best interpretation from a multiple-choice list.

**Best for:** clinical lab interpretation, CBC/CMP reasoning, recognizing patterns in blood work.

## Evaluate — judge, critique, decide

### Branching Scenario
Choose-your-own-adventure walk through author-defined steps. Each step has a prompt and either choices (with `nextNodeId`) or a terminal outcome.

**Best for:** clinical decision-making, ethics scenarios, "what would you do next" exercises.

### Differential Diagnosis Tree
Like Branching Scenario but specialized for clinical reasoning: each step can `addsToCase[]` accumulating findings into a persistent case panel, and terminal nodes carry a diagnosis.

**Best for:** medical/nursing differential reasoning practice, with the case panel mimicking real-world working diagnosis tracking.

### Reflection Prompt
Open-ended writing with optional minimum word count. Submission is success-only.

**Best for:** post-class reflections, journal-style entries, formative writing.

### OSCE Encounter
A multi-phase clinical encounter (e.g., History → Examination → Closure). Each phase exposes actions the learner can perform; correct actions add points.

**Best for:** clinical skills practice, simulated patient encounters, OSCE prep.

## Create — produce original work

### Audio Recording
Records mic audio in-browser. Optional reference audio plays alongside. `minSeconds`/`maxSeconds` enforce duration. Completion-only.

**Best for:** pronunciation practice, oral case presentations, language learning.

## Live activities (alpha)

Live mode adds five real-time synchronous activities that students join with a 6-digit code:

- **Straw Poll** — instructor question, students vote, live histogram
- **Confidence Meter** — students slide between "no clue" and "got it"
- **Word Cloud** — students submit short phrases, cloud aggregates live
- **Q&A Board** — students submit questions, others upvote
- **Quick Quiz** — synchronized multiple-choice with timer

See [Live mode](/docs/live-mode) for setup and limitations.

## Quiz primitives (used inside other activities, not surfaced directly)

**Multiple Choice**, **Fill in the Blanks**, and **Question Set** ship in the core engine but aren't in Studio's catalog — most LMSes already have good native quiz authoring, and Kukui exists to do what your LMS *can't*.
