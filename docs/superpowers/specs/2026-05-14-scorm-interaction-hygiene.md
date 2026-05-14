# SCORM Interaction Hygiene — Design Spec

**Date:** 2026-05-14
**Repo:** kukui-studio
**Status:** Design committed; bite-sized implementation plan to follow in `docs/superpowers/plans/`.
**Trigger:** Faculty currently see only an overall score per attempt in Brightspace. They have no way to identify which questions a cohort consistently misses — i.e. no path to "gap analysis." Adding rich `cmi.interactions.*` writes is the cheapest unlock: it does not change Kukui's deployment model, requires no LMS admin involvement, and remains LMS-agnostic across the SCORM 1.2 spec.

## Goal

Every Kukui activity writes thorough, well-structured `cmi.interactions.N.*` data to the LMS on every check / submit / hotspot-resolved event, with a stable interaction ID per question and a documented SCORM-type-to-response-encoding mapping per activity kind. Faculty using Brightspace's existing SCORM reports (Course Admin → SCORM → CSV export) can then drill from "the class averaged 72%" down to "78% of the cohort missed question 4 of the diabetic ketoacidosis activity."

This spec covers only the production side — the data being written into the LMS. A later kukuistudio.com browser-only CSV analyzer is **explicitly out of scope** and will follow in its own spec.

## Why this matters

Today's `packages/core/src/scorm.ts` writes:

```
cmi.core.score.raw / .min / .max
cmi.core.lesson_status
cmi.suspend_data           (LZ-compressed activity state, learner-private)
```

…and nothing else. The overall score per attempt is the only signal that survives into Brightspace's reporting. SCORM 1.2 supports per-question detail through the `cmi.interactions.N.*` family, but Kukui never writes it.

After this spec lands:

- Brightspace's per-attempt SCORM report shows a row per question, with the learner's response, the correct response, and a correct/wrong verdict.
- The interaction-data CSV export from Course Admin → SCORM contains every interaction across every learner — sufficient to pivot for cohort gap analysis in Excel / Google Sheets.
- Stable interaction IDs let the same question be tracked across re-attempts and across cohorts.
- A future static CSV analyzer hosted at kukuistudio.com will consume this schema directly.

## Constraints (re-stated for the record)

These are the hard constraints that narrowed the design space; they are not up for debate inside this spec.

| # | Constraint | Implication |
|---|---|---|
| 1 | LMS-agnostic | No Brightspace Valence API, no LTI registration, no D2L-specific column conventions in the schema. SCORM 1.2's standard `cmi.interactions.*` only. |
| 2 | No admin help required | Faculty deploys exactly the way they do today (upload SCORM zip). No institutional configuration step. |
| 3 | Kukui stays a static site | No new backend, no Kukui-hosted LRS, no analytics endpoint. Data flows learner → LMS only. |
| 4 | Phase 6+ deferral of xAPI / cmi5 still stands | Per `CLAUDE.md` stack pin. xAPI is not in scope; this spec produces SCORM 1.2 interaction data only. |
| 5 | Backward-compatible | Existing SCORM zips and activities continue to work. Adding interaction writes must not break overall-score reporting. |

## Locked decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Where the API lives | New `recordInteraction(record: InteractionRecord)` method on the `ScormDriver` interface (`packages/core/src/scorm.ts`). Mirrors the existing `postScore` / `saveSuspendData` style. |
| 2 | How activities access it | New `onInteraction?: (r: InteractionRecord) => void` callback prop on `ActivityProps<TConfig>`. Wired by `ActivityHost` to `scorm.recordInteraction(...)`. Activities that don't yet emit interactions just don't call it — fully additive. |
| 3 | Bridge parity | `@kukui/bridge` (`packages/bridge/src/index.ts`) gains a matching `RecordInteraction(json)` method so Unity / Godot / Articulate integrations have the same surface. JSON-flat call to stay friendly to non-TS consumers. |
| 4 | Interaction ID format | `<activityKind>:<configIdent>:<itemRef>` — stable across re-attempts and across learners, so the same question appears under the same ID in CSV exports. `configIdent` is `config.id` if present, else a short content hash. `itemRef` is the activity-defined sub-key (e.g. answer index, blank index, hotspot id). |
| 5 | SCORM 1.2 interaction types used | Only the eight types defined by SCORM 1.2 §3.4.7: `true-false`, `choice`, `fill-in`, `matching`, `performance`, `sequencing`, `likert`, `numeric`. Per-activity-kind mapping in the [Per-activity vocabulary](#per-activity-vocabulary) section below. |
| 6 | Response encoding | Follow SCORM 1.2 §3.4.7.5 strictly. `choice` → `{a,b,c}` for multi, `a` for single. `matching` → `1.a,2.b,3.c`. `sequencing` → `a,b,c`. `fill-in` → free text capped at 255 chars per spec. `performance` → free text (used as the escape hatch when nothing else fits, e.g. 3D hotspot picks). |
| 7 | Latency tracking | Each activity records a `displayedAt` timestamp when the question is first visible (mount, or sub-slide reveal in Course Presentation). Latency = `Date.now() - displayedAt`, formatted as `HHHH:MM:SS.SS` per SCORM 1.2 §3.4.7.10. |
| 8 | Granularity | One `cmi.interactions.N` write per gradable element, not per activity. Multiple Choice → 1 interaction. Fill in the Blanks (3 blanks) → 3 interactions. Drag and Drop → 1 `matching` interaction summarising all chip→zone pairings. Question Set / Course Presentation → recursive: sub-activities record their own interactions through the same callback. |
| 9 | Suspend data unchanged | `cmi.suspend_data` keeps its current role (learner-private resume state). Interactions are write-only from Kukui's perspective; we never read them back. |
| 10 | Truncation policy | Responses longer than 255 chars are truncated with a trailing `…` so faculty CSV exports show what happened. A `console.warn` fires in dev. |
| 11 | Re-attempts | When the learner retries (per `behaviour.enableRetry`), each new attempt writes new interactions with the **same IDs**. SCORM 1.2 stores them as the latest values, which is the behavior we want — gradebook reflects the most recent attempt. |
| 12 | Non-gradable activities | Reflection Prompt, Q&A Board, Straw Poll, Word Cloud, etc. — activities with no correct answer — still record interactions with `result: "neutral"` so faculty can see participation rates and free-text responses. |
| 13 | Privacy | No new PII collected. Interactions are scoped to the SCORM session; the LMS already attributes them to a learner via `cmi.core.student_id`. FERPA posture unchanged from today. |

## Architectural shape

```
packages/core/src/
  scorm.ts                         # MODIFY: ScormDriver gains recordInteraction(); both Pipwerks + Memory drivers implement
  types.ts                         # MODIFY: add InteractionRecord, extend ActivityProps with onInteraction
  activity-host.tsx                # MODIFY: pass onInteraction down; wire to scorm.recordInteraction
  interaction-encoding.ts          # CREATE: pure helpers — encodeChoice, encodeMatching, encodeSequencing, encodeLatency, truncateResponse
  interaction-encoding.test.ts     # CREATE: unit tests for every encoder + edge case (255-char fill-in, special chars)
  scorm.test.ts                    # MODIFY: assert cmi.interactions.* writes for a representative call

packages/bridge/src/
  index.ts                         # MODIFY: KukuiBridge gains RecordInteraction(json: string): boolean
  index.test.ts                    # MODIFY: assert bridge write goes through

packages/core/src/components/<activity>/
  <Activity>.tsx                   # MODIFY each: call props.onInteraction(...) at submit / check / hotspot-resolve time
  <Activity>.test.tsx              # MODIFY each: assert interaction is emitted with the right shape
```

### New types (`packages/core/src/types.ts`)

```ts
export type InteractionType =
  | "true-false"
  | "choice"
  | "fill-in"
  | "matching"
  | "performance"
  | "sequencing"
  | "likert"
  | "numeric";

export type InteractionResult =
  | { kind: "correct" }
  | { kind: "wrong" }
  | { kind: "unanticipated" }   // learner did something the question didn't model
  | { kind: "neutral" }          // ungraded — reflection, poll, free response
  | { kind: "numeric"; value: number };  // numeric grade between 0 and 1

export type InteractionRecord = {
  /** Stable cross-attempt id, format `<kind>:<configIdent>:<itemRef>`. */
  id: string;
  type: InteractionType;
  /** Human label for the question — written to .description for CSV legibility. */
  description?: string;
  /** SCORM 1.2 student_response, already encoded per type. */
  studentResponse: string;
  /** SCORM 1.2 correct_response.0.pattern, already encoded per type. */
  correctResponse?: string;
  result: InteractionResult;
  /** Point weight; default 1. */
  weighting?: number;
  /** Seconds since the question was first displayed. */
  latencySeconds?: number;
};
```

### `ScormDriver` extension (`packages/core/src/scorm.ts`)

```ts
export interface ScormDriver {
  initialize(): boolean;
  finish(): boolean;
  postScore(raw: number, max: number, success: boolean): void;
  saveSuspendData(json: string): void;
  loadSuspendData(): string | undefined;
  getStudentName(): string | undefined;
  getStudentId(): string | undefined;
  isLive(): boolean;

  /** NEW. Writes one cmi.interactions.N.* block and bumps the index. */
  recordInteraction(record: InteractionRecord): void;
}
```

`PipwerksDriver.recordInteraction()` writes:

```
cmi.interactions.N.id                       record.id (truncated to 255)
cmi.interactions.N.type                     record.type
cmi.interactions.N.time                     HH:MM:SS (current wall clock)
cmi.interactions.N.student_response         record.studentResponse (truncated to 255)
cmi.interactions.N.correct_responses.0.pattern   record.correctResponse (if present)
cmi.interactions.N.result                   "correct" | "wrong" | "unanticipated" | "neutral" | numeric
cmi.interactions.N.weighting                record.weighting ?? 1
cmi.interactions.N.latency                  HHHH:MM:SS.SS from record.latencySeconds
```

…then calls `LMSCommit`. `N` is an instance counter (private to the driver), incremented per call.

**On `description`:** SCORM 1.2 has no per-interaction description field. The `objectives.N.id` family is for learning-objective linkage, not question text, so we don't repurpose it. `InteractionRecord.description` exists in our internal type for two reasons — Memory-driver dev logging (authors see human labels in Studio Preview console) and future xAPI / cmi5 work — but it is **not written to SCORM**. The interaction `id` itself is the only human-decodable hook in the LMS report; that's why decision 4's `<kind>:<configIdent>:<itemRef>` format is human-parseable rather than opaque.

`MemoryDriver.recordInteraction()` `console.info`s the record for dev preview, no other state. Studio Preview already runs against MemoryDriver, so authors see emitted interactions in the browser console — useful for sanity-checking activity wiring without a SCORM round-trip.

### `ActivityProps` extension (`packages/core/src/types.ts`)

```ts
export type ActivityProps<TConfig> = {
  config: TConfig;
  onSubmit: (s: ScoreState) => void;
  onResume?: () => Partial<TConfig> | undefined;
  suspendData?: string;
  onPersist?: (suspendData: string) => void;
  /** NEW. Optional — activities not yet wired simply don't call it. */
  onInteraction?: (record: InteractionRecord) => void;
  headingLevel?: 1 | 2 | 3;
};
```

`ActivityHost.tsx` provides it:

```ts
const handleInteraction = (r: InteractionRecord) => scorm.recordInteraction(r);
const callbackProps = {
  onSubmit: handleSubmit,
  onPersist: handlePersist,
  onInteraction: handleInteraction,
  suspendData: scorm.loadSuspendData(),
};
```

## SCORM 1.2 interaction schema reference

For implementers; sourced from ADL SCORM 1.2 Runtime Environment §3.4.7.

| Field | Type | Limit | Notes |
|---|---|---|---|
| `cmi.interactions.N.id` | CMIIdentifier | ≤255 chars, no spaces in formal spec (we'll use `:` separators) | Required for LMSSetValue calls |
| `cmi.interactions.N.objectives.0.id` | CMIIdentifier | ≤255 chars | Mirror the id; Brightspace surfaces this as the "objective" column |
| `cmi.interactions.N.time` | CMITime | `HH:MM:SS[.SS]` | When the interaction was committed, wall clock |
| `cmi.interactions.N.type` | enum | 8 values (see decision 5) | |
| `cmi.interactions.N.correct_responses.0.pattern` | CMIFeedback | ≤255 chars | Encoded per type |
| `cmi.interactions.N.weighting` | CMIDecimal | -∞..+∞ | Default 1 |
| `cmi.interactions.N.student_response` | CMIFeedback | ≤255 chars | Encoded per type |
| `cmi.interactions.N.result` | CMIResult | `correct` \| `wrong` \| `unanticipated` \| `neutral` \| decimal 0..1 | |
| `cmi.interactions.N.latency` | CMITimespan | `HHHH:MM:SS.SS` | Time from display to commit |

## Per-activity vocabulary

This table is the canonical mapping. Adding a new activity kind requires extending this table in the same PR.

| Activity kind | SCORM type | Granularity | Response encoding | Result mapping |
|---|---|---|---|---|
| `multiple-choice` | `choice` | 1 interaction | Selected indices as `{a,b,c}` (multi) or `a` (single); letters map to display order index | `correct` if selected == correctSet else `wrong` |
| `fill-in-the-blanks` | `fill-in` | 1 per blank | Trimmed text per blank, truncated to 255 chars | `correct` if matches any accepted answer (case rules per `behaviour.caseSensitive`) else `wrong` |
| `drag-and-drop` | `matching` | 1 interaction | `chipId.zoneId,chipId.zoneId,…` — unplaced chips emitted as `chipId.` | `correct` if all chips in their correct zones, else `wrong` |
| `question-set` | recursive | per sub-question | Sub-activity emits its own interactions through the same callback | Sub-activity decides |
| `course-presentation` | recursive | per slide interaction | Sub-activity emits its own | Sub-activity decides |
| `hotspot-2d` | `choice` | 1 per question | Selected hotspot IDs as `{a,b,…}`; lettering follows hotspot config order | `correct` if selected matches target set |
| `hotspot-3d` | `performance` | 1 per question | Free-text list of hotspot IDs clicked (`hotspotA,hotspotC`) | `correct` if clicked-set == target-set |
| `virtual-tour` | `performance` | 1 per pinned task | Tour task id + completion marker | `correct` / `neutral` per task spec |
| `sequence-steps` | `sequencing` | 1 interaction | Learner order as `a,b,c,d` | `correct` if matches expected order |
| `matching-pairs` | `matching` | 1 interaction | `leftId.rightId,…` | `correct` if all pairs match |
| `categorization` | `matching` | 1 interaction | `itemId.categoryId,…` | `correct` if all items in correct categories |
| `image-comparison-slider` | `performance` | 1 interaction | Final slider position 0..100, plus any reveal events | `neutral` (exploratory) |
| `anatomy-labeling` | `matching` | 1 interaction | `labelId.regionId,…` | `correct` if all labels on correct regions |
| `highlight-text` | `performance` | 1 interaction | List of highlighted span IDs | `correct` if matches target spans |
| `flashcards` | `performance` | 1 interaction per card flip | Card id + self-rated familiarity (if confidence-meter mode) | `neutral` |
| `reflection-prompt` | `fill-in` | 1 interaction | Truncated free text | `neutral` |
| `branching-scenario` | `choice` | 1 per decision node | Selected branch id as `a` (single) | `correct` / `wrong` / `neutral` per node config |
| `image-annotation` | `performance` | 1 interaction | JSON-flat list of annotation `{x,y,label}` truncated to 255 | `neutral` |
| `concept-map` | `matching` | 1 interaction | `nodeId.connectedNodeId,…` | `correct` if matches target graph |
| `interactive-video` | recursive | per embedded question | Sub-questions emit their own | Sub-question decides |
| `audio-recording` | `performance` | 1 interaction | Recording duration in seconds | `neutral` |
| `lab-panel` | `matching` | 1 interaction | `analyteId.bucketId` per result | `correct` if all classified correctly |
| `ddx-tree` | `sequencing` | 1 interaction | Selected diagnosis path as `a,b,c` | `correct` if matches target path |
| `osce` | recursive | per checklist item | Each rubric item emits its own | Sub-item decides |
| `crossword` | `fill-in` | 1 per clue | Filled letters per clue | `correct` if matches solution |
| `straw-poll` | `choice` | 1 interaction | Selected option `a` | `neutral` |
| `confidence-meter` | `likert` | 1 interaction | Numeric 1..5 | `neutral` |
| `word-cloud` | `fill-in` | 1 interaction per submitted word | Truncated text | `neutral` |
| `qa-board` | `fill-in` | 1 per posted question | Truncated text | `neutral` |
| `quick-quiz` | recursive | per sub-question | Like Question Set | Sub-question decides |
| `isometric-chatroom` | `performance` | 1 per scripted prompt | Selected response id | `correct` / `wrong` / `neutral` per prompt config |

## Interaction ID format

Pattern: `<activityKind>:<configIdent>:<itemRef>`

- `activityKind` is the literal `BuiltActivityKind` string (`multiple-choice`, `hotspot-3d`, etc.)
- `configIdent` is `config.id` when the config defines one (preferred — author-controlled, human-readable); otherwise a short content hash (first 8 chars of SHA-1 of the canonical JSON). The hash is deterministic for the same content but changes if the author edits the question, which is the right behaviour — a substantively different question becomes a new interaction in the analytics.
- `itemRef` is activity-defined: `q1` for single-question activities, `blank-2` for fill-in, `chip-glucose` for drag-and-drop entries, etc. Documented per activity in the codebase next to the call site.

Total ID length capped at 255; if the combined string exceeds that, `configIdent` is truncated to a 16-char hash regardless of whether an author id was set, and a `console.warn` fires in dev.

## Latency tracking

Every activity component sets `displayedAt = Date.now()` in its mount effect. For sub-slides (Course Presentation) or per-question reveal (Question Set with single-question pacing), `displayedAt` is set on the reveal effect of each sub-element.

At record time:

```ts
const latencySeconds = (Date.now() - displayedAt) / 1000;
```

Encoded in `packages/core/src/interaction-encoding.ts`:

```ts
export function encodeLatency(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds * 100));
  const hundredths = total % 100;
  const totalSec = Math.floor(total / 100);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const pad4 = (n: number) => String(n).padStart(4, "0");
  return `${pad4(h)}:${pad2(m)}:${pad2(s)}.${pad2(hundredths)}`;
}
```

## Response encoding helpers

All in `packages/core/src/interaction-encoding.ts` — pure functions, unit-tested:

```ts
export function encodeChoice(indices: readonly number[]): string {
  // indices are zero-based; SCORM 1.2 expects letters a..z.
  // Single → "a"; multi → "{a,b,c}".
  // Indices >= 26 fall through to "aa", "ab", … (rare; safe).
}

export function encodeMatching(pairs: readonly { left: string; right: string }[]): string {
  // "leftId.rightId,leftId.rightId" — unplaced left items use "leftId."
}

export function encodeSequencing(orderedIds: readonly string[]): string {
  // "a,b,c"
}

export function encodeFillIn(text: string): string {
  // Trim, truncate to 255 chars, append "…" if truncated.
}

export function encodePerformance(payload: unknown): string {
  // JSON-flatten; truncate to 255 with trailing "…".
}

export function encodeLatency(seconds: number): string { /* see above */ }
```

## Brightspace CSV export — expected columns

This section is **forward-looking documentation** for the future static CSV analyzer. Lamakū's SCORM interaction export is reachable from **Course Admin → SCORM Reports → [package name] → Export to CSV**. Empirically the columns Brightspace emits (subject to D2L's reporting layer; verify against a real export before building the analyzer):

| Column | Source field | Notes |
|---|---|---|
| `Username` | `cmi.core.student_name` | Faculty-recognizable name; FERPA-relevant |
| `Org Defined ID` | `cmi.core.student_id` | Stable per-learner ID |
| `Attempt #` | LMS-tracked | Incremented per LMSInitialize call |
| `Interaction ID` | `cmi.interactions.N.id` | Our `<kind>:<configIdent>:<itemRef>` |
| `Type` | `cmi.interactions.N.type` | SCORM 1.2 type enum |
| `Student Response` | `cmi.interactions.N.student_response` | |
| `Correct Response` | `cmi.interactions.N.correct_responses.0.pattern` | |
| `Result` | `cmi.interactions.N.result` | |
| `Weight` | `cmi.interactions.N.weighting` | |
| `Latency` | `cmi.interactions.N.latency` | `HHHH:MM:SS.SS` |
| `Timestamp` | `cmi.interactions.N.time` | Wall clock |

The future analyzer will accept this CSV directly (drag-and-drop into a kukuistudio.com page) and aggregate by `Interaction ID` to produce gap-analysis views. Building the analyzer is deferred to its own spec; this spec only ensures the data exists in a known shape.

## Non-goals (explicit)

- **xAPI / cmi5 emission.** Still deferred per `CLAUDE.md` Phase 6+. No xAPI statements, no LRS endpoint config, no cmi5 launch protocol. Authoring UX and packaging do not change.
- **Kukui-hosted analytics endpoint.** Out of scope. All data flows learner → LMS only.
- **Bring-your-own webhook.** Discussed and parked. May revisit as a separate spec for technical-faculty users; not this work.
- **Static CSV analyzer tool.** Future spec; the *data* this spec produces is its dependency, not its delivery.
- **Reading interactions back from the LMS.** SCORM 1.2 doesn't expose read-after-write on interactions from the runtime, and we don't need it — the LMS is the source of truth for reporting.
- **Schema migration for existing SCORM zips already deployed.** Old zips simply won't have rich interactions; the moment faculty re-export from Studio after this lands, they get the new data. No retroactive migration.

## Phasing

The implementation plan (`docs/superpowers/plans/2026-05-14-scorm-interaction-hygiene-plan.md`, to be written next) will break this into four PR-sized phases.

| Phase | Scope | Validates |
|---|---|---|
| **A** | Driver API + plumbing | `recordInteraction()` on `ScormDriver`, encoding helpers + unit tests, `ActivityProps.onInteraction`, host wiring, bridge parity (`KukuiBridge.RecordInteraction`). No activity wires up yet. |
| **B** | First three activities | Multiple Choice, Fill in the Blanks, Drag and Drop. Each one wires `onInteraction` calls at submit time with the right encoding. End-to-end SCORM export → upload to Lamakū → verify Course Admin → SCORM report shows per-question rows. |
| **C** | Remaining activities | Hotspot 2D/3D, Question Set (recursive), Course Presentation (recursive), and the rest of `BuiltActivityKind`. Per-activity tests assert the right SCORM type + encoding. |
| **D** | Author + faculty docs | README addition: "Pulling analytics from Brightspace" (how to navigate to Course Admin → SCORM, what the CSV columns mean, what an interaction ID looks like). Sets up the future analyzer's user onboarding. |

Phase A must land before B or C. B and C can run in parallel.

## Open questions

1. **`config.id` field.** Several activity configs don't currently have a stable id field. Adding one is a Zod schema change per activity. Plan A: opportunistically add `id?: string` to each schema as Phase C touches it. Plan B: rely on content-hash exclusively and skip the schema work. **Recommendation:** Plan B for v1; revisit if faculty want human-readable IDs in the CSV later.

2. **Lamakū version drift.** D2L periodically renames columns in their CSV export. The "expected columns" table above must be empirically verified against a real Lamakū SCORM export before the future analyzer is built. **Action:** during Phase B, export a real CSV from Lamakū and pin a sample to `docs/scorm-csv-sample.csv`.

3. **`isometric-chatroom`.** The activity is mid-design (`docs/superpowers/specs/2026-05-14-isometric-chatroom-design.md`). Its interaction vocabulary entry above is a placeholder; the isometric-chatroom spec should converge with this one before implementation.

4. **Course Presentation recursion semantics.** When a Course Presentation contains a Multiple Choice sub-activity, the MC's interaction id should embed the slide ref so the same question appearing on slide 3 vs slide 7 is distinguishable. Format proposal: `multiple-choice:<configIdent>:slide-3:q1`. Confirm with Phase C lead before implementing.

## References

- ADL SCORM 1.2 Runtime Environment §3.4.7: <https://adlnet.gov/projects/scorm-1-2/>
- pipwerks SCORM API (already in the bundle): `apps/engine-web/public/pipwerks.SCORM.min.js`
- Existing SCORM driver: `packages/core/src/scorm.ts`
- Existing bridge: `packages/bridge/src/index.ts`
- Activity host: `packages/core/src/activity-host.tsx`
- Related (deferred) work: xAPI / cmi5 — see Phase 6 in `CLAUDE.md`
