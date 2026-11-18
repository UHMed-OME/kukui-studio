# Timed Recall Quiz: New Activity Design

> **Status:** Design pass (kukui scaffold S1–S3), revised after FERPA / data-compliance review.
> Items changed or added by the review are marked **[Review]**. A summary is in the [Change log](#change-log).

---

## Learning objective

Recall and examine medical terms, disease names, and anatomical structures accurately, under time pressure, across a set of instructor-defined topics.

**Bloom's level:** *remember* (recall of a term/fact), with a secondary *understand* component ("examine": recognizing why the answer fits). This sits lower on the taxonomy than any existing activity tagged *evaluate* (Straw Poll, Quick Quiz). It is similar to flashcards but timed, scored, and comparative rather than self-paced and private.

**Proposed name for this activity type:** `leaderboard-quiz`.

Checked against names already in use: `quick-quiz` looks similar but isn't close enough to be a typo or near-duplicate, and it is a different activity anyway (one Live multiple-choice question, no timer, no topics, no leaderboard, and deliberately staying single-question rather than growing into this). So this is a new activity, not a change to that one.

---

## Problem

The brief calls for:

- a topic-select menu
- a timer
- points per correct typed answer
- questions drawn from topics (or randomized)
- a personal-record tracker keyed to a unique student ID
- a leaderboard showing other students' scores

In other words, a Kahoot/Sporcle-style drilling game for disease names, medical terms, and anatomy.

The last piece, showing other students' live scores, doesn't fit the Engine product as architected. Kukui Engine is async, single-learner, SCORM-packaged, with no backend. Two SCORM packages running in two students' browsers have no channel to each other; there is nothing to poll and nowhere to store a cross-student table. Faking it (e.g. a static "sample leaderboard" baked into the JSON) would mislead learners with scores that aren't real.

Kukui Live is the one product with a real-time channel between students (Trystero P2P + Y.js CRDT, the same mechanism Straw Poll and Quick Quiz already use). So this activity is designed **dual-mode** from the start, matching the pattern those two already establish:

| | Engine (async) | Live (classroom) |
|---|---|---|
| **Timer** | per-attempt, self-paced | shared round, instructor-started |
| **"Personal record"** | real: local best score/time, persisted per attempt **[Review: see privacy notes]** | real: same, plus this round's rank |
| **"Leaderboard"** | not shown: nothing to compare against | real: live-ranked against connected peers |

This isn't a workaround; it's the same tiering the product already uses for grading (SCORM `cmi.core.score` persists per-student per-attempt) versus live comparison (resets, session-scoped, peer-to-peer). No backend is added in either mode. **[Review: the network-reachability finding below may challenge the "no backend" claim for Live.]**

---

## Goals

1. **Topics and questions.** Author picks one or more topics, each a named pool of recall questions (disease names, medical terms, anatomical structures). Each question has a free-text answer, not multiple choice ("input the correct answer," per the brief).
2. **Rounds.** A round draws *N* questions from the selected topic(s), either in authored order or shuffled, under a **total** timer (not per-question: simpler to reason about, matches the "timed activity" framing in the brief, and avoids a second timer UI competing for the same 44×44 reserved space).
3. **Scoring.** Points per correct answer, configurable by the author (flat per-item, matching the `ScoringSchema` "points" mode already used across the codebase; no new scoring discriminator).
4. **Personal record.** Tracking on the learner's device. Works in Engine today with no new LMS integration. **[Review: keying on the SCORM student ID is changed; see FERPA section.]**
5. **Live leaderboard.** Live-only comparative leaderboard: real other-student scores, ranked, during a live round. Reuses the exact Y.Map-per-participant pattern `useStrawPoll.ts` already established.
6. **[Review] Visual authoring.** Instructors can customize the activity title and all instructor-facing strings (labels, prompts, feedback text) through a visual editor in Studio, with no JSON editing.

---

## Non-goals

- **A persistent, cross-session, cross-device leaderboard** ("all-time top scores across the whole course"). That needs a backend or an LRS; both are explicitly deferred/out of scope per the stack pin. If UH JABSOM wants this later, it's a Phase 6+ xAPI/LRS conversation, not a Kukui Studio one. **[Review: this would also bring a much larger FERPA surface, since it creates a durable cross-student record.]**
- ~~Fuzzy/semantic answer grading.~~ **[Review: partially reversed.]** *Semantic* grading (e.g. accepting "heart attack" for "myocardial infarction" via NLP or AI) remains out of scope. *Deterministic typo tolerance* is now an open option; see [Answer matching](#answer-matching).
- Per-question timers, lifelines, power-ups, or other game-show mechanics not in the brief.
- Showing names on the Live leaderboard by default. See the privacy note below.

---

## Data model

```ts
TimedQuizConfig {
  version: string                 // "1.0" (existing pattern)
  title: string
  author?: string
  topics: Topic[]                 // >= 1
  questions: Question[]           // flat pool; each tagged with a topicId
  round: {
    questionCount: number         // questions drawn per attempt/round
    shuffle: boolean              // pull order randomized if true
    topicSelection: "all-topics" | "learner-picks"   // menu shown or not
    timeLimitSeconds: number      // single countdown for the whole round
  }
  pointsPerCorrect: number        // flat award; no partial credit
  scoring: ScoringSchema          // reuse existing discriminated union (mode: "points")
  appearance?: AppearanceSchema   // existing token-based theme, nothing new
  strings?: Record<string, string> // [Review] instructor-editable UI strings (see Studio authoring)
}

Topic {
  id: string       // kebab-case, referenced by Question.topicId
  label: string    // "Cardiovascular", "Neuroanatomy", etc.
}

Question {
  id: string
  topicId: string               // must match a Topic.id (hand-checked, Zod won't catch it)
  prompt: string                // "What is the medical term for a heart attack?"
  acceptedAnswers: string[]     // ["myocardial infarction", "MI"]: exact strings, author-supplied synonyms
  feedbackCorrect?: string
  feedbackIncorrect?: string
}
```

### Answer matching

**Baseline (unchanged): plain text match.** Both the learner's typed input and every entry in `acceptedAnswers` are normalized the same way before comparing: lowercased, leading/trailing whitespace trimmed, internal whitespace collapsed to a single space, punctuation stripped. The raw `acceptedAnswers` strings (not the normalized form) are what the author edits in Studio and what's shown in feedback/solution review; normalization is a runtime-only comparison step, never persisted back into the config.

**[Review] Proposed extension: bounded fuzzy matching.** The review recommended exploring fuzzy answer systems so fill-in-the-blank style questions are not failed over small spelling slips, which are common with long medical terms ("myocardial infarcton"). A design that stays within the existing constraints (no backend, no AI, deterministic, runs in the browser):

- Optional per-quiz setting, e.g. `round.typoTolerance: "off" | "lenient"` (default `"off"`).
- `"lenient"` accepts an answer within a small edit distance (Damerau-Levenshtein) of any accepted answer, scaled by length (e.g. 0 edits for ≤4 characters, 1 for 5–9, 2 for 10+). Short answers and abbreviations like "MI" must stay exact, or "MS" and "MI" collide.
- **Collision guard in Studio:** warn the author when two *different* questions' accepted answers within the same topic fall within tolerance of each other (e.g. "ileum" / "ilium", "hypo-" / "hyper-" terms), since fuzzy matching would mark a wrong anatomical term correct.
- Show the learner the canonical spelling in feedback when a fuzzy match was used, so the near-miss isn't silently reinforced.
- Still no semantic synonym matching; synonyms stay author-supplied.

> Open decision: this is an educational-quality tradeoff. Spelling accuracy is arguably part of learning medical terminology, so the default should stay `"off"`, with instructors opting in per quiz.

### Personal record

Engine only, stored client-side, and not part of the activity config (it's learner-generated state, not authored content).

**[Review] Revised record shape.** The original keyed the record by `cmi.core.student_id` and stored it inside the record. The review flagged the FERPA and shared-device implications of this (see below), so the record no longer stores the student ID:

```ts
// localStorage, scoped per activity instance.
// Key: "timedquiz:" + configHash   (no student ID or name in the key)
PersonalRecord {
  bestScore: number
  bestTimeMs: number
  attempts: number
  lastAttemptAt: string    // ISO timestamp
}
```

This is a cache, not the source of truth. SCORM's own `cmi.core.score.raw` history in the LMS gradebook is authoritative. The local record exists so Engine can show "your best: 8/10 in 42s" without round-tripping through the LMS's SCORM API on every render, and degrades gracefully (just shows nothing "previous" yet) if localStorage is unavailable (private browsing, cleared storage). It's a nice-to-have, not a grading mechanism.

**[Review] Shared-device caveat.** Without a student identifier in the key, two learners using the same browser profile (a lab or library machine) would see each other's records. Mitigations, in order of preference:

1. Show the record only when the LMS-supplied identity matches an opaque, one-way hash stored with the record (a salted hash of the student ID, never the ID itself), and treat a mismatch as "no previous attempt".
2. Or accept the caveat and add a visible "Reset my record on this device" control.

### Leaderboard

Live only, and resets after the instructor starts a new round. One Y.Map, same shape as Straw Poll's vote map:

```ts
// Y.Map<string, LeaderboardEntry>, keyed by Live participantId: "live-quiz-scores"
LeaderboardEntry {
  displayName: string    // [Review] session alias by default; real name only on instructor opt-in
  score: number
  elapsedMs: number
  finishedAt: number     // epoch ms, tiebreaker (first to finish wins ties)
}
```

**[Review] `studentId` removed from the broadcast entry.** The original included each peer's SCORM `studentId` in the shared map, which would transmit a persistent institutional identifier to every classmate's browser. The leaderboard only needs a stable per-session key, which the Live `participantId` already provides. The instructor view can map `participantId` to identity locally if needed, without broadcasting it.

State is O(participants), with the same scaling note as Straw Poll (~50 bytes/entry, trivial at 300 students; the real ceiling is Trystero's full-mesh WebRTC limit, a transport concern, not a data one). The map is cleared when the instructor starts a new round. No history is kept across rounds beyond what each learner's own SCORM attempt records for themselves.

---

## Studio authoring

- Topic list and question pool are both repeatable-array RJSF widgets, the same pattern as Question Set's item list.
- `acceptedAnswers` is authored as a **tag-input** (comma-or-enter-to-add), not a single text field. This is the one field worth hand-tuning in `ui-schema.ts` rather than leaving the generated default, since a bare `string[]` text-array widget is clunky for "type a synonym, press enter."
- **Scoring tab:** nothing new. `pointsPerCorrect` lives in this activity's own schema (it's a per-item award amount, not a scoring mode), while pass/fail and retry behavior stay on the shared `ScoringSchema` surface Studio's Scoring tab already renders for every activity.
- **[Review] Visual editor requirement (replaces "no new Studio editor chrome").** The review specified that instructors must be able to customize titles and strings through a visual editor. Scope for v1:
  - Editable title, plus every learner-facing string the activity renders (start button, timer label, "Time's up", personal-record text, leaderboard heading, correct/incorrect fallbacks), stored in the optional `strings` map with built-in English defaults.
  - A form-based editor with live preview of the quiz screen, so authors never see raw JSON.
  - Per-question `feedbackCorrect` / `feedbackIncorrect` edited inline beside the prompt.
  - Studio-side validation surfaced visually: the `topicId` cross-reference check (currently "hand-checked, Zod won't catch it") becomes a topic dropdown instead of a free-text field, which removes that failure mode entirely.
  - Fuzzy-match collision warnings (if `typoTolerance` is adopted).

---

## Accessibility & design-system fit

- Input field focus/correct/incorrect states follow the existing layout-stable rule: border width constant, only fill color shifts between `surface`, `success-soft`, `error-soft`. These are the same states Fill in the Blanks already uses, reused rather than inventing new ones.
- Submit button and topic-menu choice chips are ≥ 44×44 px, same as every other activity.
- **Leaderboard privacy:** showing a learner's real name next to a score to the whole class is a classroom-dynamics call, not just a UX one. Getting last on a named list is a worse experience for a struggling student than an anonymized one. Default `displayName` to a stable per-session alias ("Student 7") unless the instructor opts into real names, mirroring Quick Quiz's existing `showNamesAtReveal` opt-in flag rather than defaulting to exposed. **[Review: now also a FERPA recommendation; see below.]**
- **[Review]** Timed typed-answer rounds disadvantage learners who use assistive technology or need more time. Provide an instructor-set time multiplier (e.g. 1.5×, 2×) for accommodations in Engine, and note that rank comparisons in Live are not equitable for those learners, so allow them to opt out of the leaderboard while still playing.

---

## FERPA and data compliance review

> This is a design-level review, not legal advice. Because the audience is a university (UH JABSOM), the final determination should come from the institution's privacy/registrar office and IT security.

### Summary of findings

| # | Area | Finding | Severity | Recommendation |
|---|---|---|---|---|
| 1 | Student ID tracking | Original design keys local storage by SCORM `student_id` and broadcasts it to peers in the Live map. | **High** | Use nicknames/aliases for anything peer-visible; never broadcast the student ID; do not store it in localStorage. |
| 2 | Peer-visible scores | Scores shown to classmates, particularly with real names, may be a disclosure of information from an education record. | **High** | Alias by default; real names only by instructor opt-in with institutional sign-off. |
| 3 | Local data storage | Personal record in localStorage persists on the device, readable by the next user of a shared machine. | Medium | No identifiers in the stored record; reset control; document what is stored. |
| 4 | Network reachability | University networks may block real-time (WebRTC/P2P) channels, so Live may not work. | Medium (functional) | Plan for a relay; this affects the "no backend" stance (see below). |
| 5 | Transport metadata | WebRTC exposes participants' IP addresses to peers and to signaling/STUN infrastructure. | Medium | Disclose; prefer an institution-controlled signaling/relay endpoint. |
| 6 | Durable records | Any future cross-session leaderboard would create a persistent cross-student record. | Medium (future) | Keep deferred; requires a separate FERPA/data-governance review. |

### 1. Student ID tracking → use nicknames

**What FERPA concerns here.** FERPA protects personally identifiable information (PII) from education records, and a student ID, a name, or a score linked to either is PII. Quiz results maintained by the institution and tied to an identifiable student generally fall in scope. Disclosing one student's score to other students, without consent or an exception, is the kind of exposure to avoid.

**Where the original design exposed PII:**

- `LeaderboardEntry.studentId` and `displayName` (from `cmi.core.student_name`) were broadcast to every peer in the room.
- `PersonalRecord.studentId` persisted an institutional identifier in the browser.

**Recommended design (adopted above):**

- **Nicknames by default.** Peer-visible identity is a per-session alias ("Student 7"), or a learner-chosen nickname validated against a profanity/impersonation filter. Nicknames are not persisted and not linked to the student ID in any shared data.
- **Real names require instructor opt-in** (mirroring `showNamesAtReveal`), and the opt-in UI should state that this displays student names to classmates and that the instructor is responsible for confirming this is permitted for their course.
- **Student ID stays inside the SCORM boundary.** It may be read from `cmi.core.student_id` for the LMS's own tracking (the LMS already holds it), but it is not copied into Live state, localStorage keys, or logs.
- **Grades remain in the LMS.** Authoritative scoring flows only through SCORM `cmi.core.score`, where the institution's existing FERPA controls apply.

### 2. Local data storage requirements

- **Store the minimum.** Only score, time, attempt count, and timestamp (see revised `PersonalRecord`). No name, ID, or email.
- **Disclose it.** Add a short notice in the activity ("Your best score is saved on this device only") so storage is not hidden.
- **Provide control.** A "Clear my saved record" action.
- **Treat it as non-authoritative.** Losing it must never affect grades or completion.
- **Shared devices.** See the hashed-identity or reset-control options in [Personal record](#personal-record).
- **No analytics or third-party calls.** The activity must not send results anywhere except the SCORM API (Engine) and peer channel (Live). State this explicitly so it can be cited in a privacy review.
- **Retention.** Live leaderboard data lives only in memory/CRDT for the session and is cleared on new round or room close. Confirm Y.js persistence providers (e.g. IndexedDB) are **not** enabled for this map, since they would silently persist peer data locally.

### 3. Network restrictions → possible relay server

University networks often block or degrade WebRTC (UDP restrictions, firewalls, managed Wi-Fi isolation, client isolation between devices), and Trystero depends on third-party signaling plus STUN/TURN for connectivity. Consequences and options:

| Option | Effect | Tradeoff |
|---|---|---|
| Keep P2P only | No new infrastructure | Live leaderboard may silently fail on restrictive networks; needs a clear "can't connect" state. |
| Institution-hosted TURN/signaling relay | Restores connectivity; keeps traffic under university control | Adds a service to run and secure. |
| Fallback to an alternate Trystero strategy | May bypass some blocks | Still third-party infrastructure; inconsistent. |

**Impact on the design.** The doc's claim that "no backend is added in either mode" holds only if P2P works on the target network. A relay would be transport infrastructure rather than a data store (it should forward, not persist, messages), but it is still a new component and should be called out as such in the decision log. **Recommendation:** validate on the real JABSOM network before committing, and ship a graceful degraded mode where the quiz and personal score work with the leaderboard unavailable.

Related transport notes for a privacy review:

- WebRTC reveals participants' IP addresses to other peers and to STUN servers.
- Public signaling relays see room identifiers and connection metadata, not answers or scores.
- Room IDs should be unguessable and the instructor should be able to lock a room, so outsiders cannot join a class leaderboard.

### 4. Other compliance considerations

- **Accommodations and equity.** See time-multiplier and leaderboard opt-out above.
- **Authoring data.** Question content is instructor-authored and non-PII; no concern.
- **Accessibility law.** Timed activities should meet the institution's accessibility policy (extendable time limits are a WCAG 2.2.1 consideration).
- **Vendor/LMS terms.** Because the LMS holds the student record, confirm the SCORM package's data use is covered by the university's existing agreements.

---

## Open questions for the instructor-facing design (before writing code)

1. **Topic menu.** Does `topicSelection: "learner-picks"` matter for v1, or is "author fixes the topic mix per quiz, make three quizzes for three units" good enough? Cuts a whole menu screen if so.
2. **Scoring.** Flat `pointsPerCorrect` only, or does speed matter (bonus for a fast correct answer)? The brief says "points given per correct answer," so plain and flat is the literal read; a speed bonus is a v2 note, not blocking.
3. **Leaderboard scope.** Confirm the Live leaderboard is acceptable as session-scoped only (resets every live round). This is the hard ceiling imposed by "no backend," not a cut corner that can be upgraded later without adding one.
4. **[Review] Identity.** Confirm nicknames/aliases as the default and whether real names should be available at all in v1.
5. **[Review] Network.** Will the Live mode be tested on the JABSOM network, and is an institution-hosted relay acceptable if P2P is blocked?
6. **[Review] Fuzzy matching.** Adopt bounded typo tolerance in v1 (default off), or keep exact-match only?
7. **[Review] Editor scope.** Is the string/title visual editor required for v1 launch, or can strings ship with defaults first?

---

## Change log

| Section | Original | Revised |
|---|---|---|
| `LeaderboardEntry` | included `studentId` | `studentId` removed; alias default |
| `PersonalRecord` | keyed by and stored `studentId` | no identifier; hashed-identity or reset-control options |
| Non-goals | fuzzy grading out of scope | semantic grading still out; bounded typo tolerance proposed |
| Studio authoring | "no new editor chrome" | visual editor for title and strings required |
| Live transport | "no backend" | P2P may be blocked; relay evaluated |
| New | n/a | FERPA / data-compliance section, accommodations, retention notes |

---

## Next step

This is the design pass (kukui scaffold S1–S3). Once the open questions above are answered, running `/kukui` → `scaffold` → `leaderboard-quiz` writes the actual folder from this spec:

- `packages/activities/leaderboard-quiz/{schema,Component,manifest,meta,...}.ts`
- `apps/live-mode/src/activities/TimedQuizLive.tsx`