# Kukui Live — Phase 3 build plan

**Date:** 2026-05-06
**Spec:** [Kukui Live (Phase 3)](https://www.notion.so/357ee4627a7481c39e30f625cfba1822) (Notion, canonical)
**Depends on:** Phase 1 (`@kukui/core` + Engine SCORM packaging) shipped; Phase 2 (Studio) authoring path established.

## Goal

Synchronous, multi-learner classroom activities running entirely client-side. Same SCORM zip as Engine, with a "Live mode" entry surfaced when the activity has live-eligible config. Real-time UI over P2P (WebRTC mesh signaled via public BitTorrent trackers); persistence still flows through each student's individual D2L SCORM session, so **no UH-operated backend services**.

## Architectural shape (no rewrite — reuse @kukui/core)

```
apps/live-mode/                                    # the Live UI (already a placeholder package)
  src/
    LiveHost.tsx                                   # mirrors Engine's ActivityHost — picks live activity, joins room
    transport/                                     # P2P + state-sync layer
      trystero.ts                                  # signaling + mesh
      yjs-room.ts                                  # CRDT-backed shared room state
      presence.ts                                  # who's in the room
    activities/
      live-multiple-choice/                        # composes @kukui/core MultipleChoice + room state
      live-poll/
      live-tbl-round/
      live-ddx-tree/                               # ←  composes branching-scenario when that ships
      live-timeline-annotation/
      sync-clinical-encounter/
    InstructorConsole.tsx                          # progression control, live aggregation, reveal
    StudentLobby.tsx                               # join flow, room code, anonymous identity
  public/samples/                                  # fixtures
packages/live/                                     # new shared package — extracted as needed
  room.ts                                          # Y.js doc shape + helpers
  scoring.ts                                       # per-room aggregation (histograms, word clouds)
```

The `LiveHost` is a parallel surface to `ActivityHost` — it loads the same JSON, validates against the same schemas, but renders Live components instead of the static Engine ones. **The schema is shared**: a Multiple Choice config that runs as Engine in async also runs as Live MC in synchronous mode without any author rewrite.

## Locked decisions (carry-overs from the platform-level plan)

| # | Decision | Choice |
|---|---|---|
| 1 | Real-time transport | Trystero (signaling over public BitTorrent trackers) + Y.js (CRDT shared state) over WebRTC mesh |
| 2 | NAT traversal | Public STUN by default; **configurable TURN endpoint** plumbed in from day one (deployment of an actual TURN service is empirical, in M5 of this plan) |
| 3 | Room model | 6-digit instructor code → SHA-256 → Trystero room name. No discoverability, no listing API. |
| 4 | Identity | SCORM `cmi.core.student_name` + `student_id` when present (D2L launch); otherwise anonymous handle the learner picks. **No auth code shipped.** |
| 5 | Persistence | Each student's individual SCORM session writes their own `cmi.core.score.raw` + `cmi.suspend_data` at session end. The instructor sees aggregates via D2L's gradebook + a one-click "Save class results JSON" download. |
| 6 | Hosting | Zero UH-operated services for MVP. Public trackers + STUN. Optional self-hosted TURN if connection-failure rate exceeds 5% in Phase 5 hardening. |
| 7 | Class size target | Stable to 50; degrade gracefully beyond. (P2P mesh O(n²) — viable up to ~50, brittle past 100.) |

## MVP scope (3 live activity types — keeping the strategic non-quiz lean)

Per the 2026-05-06 scope shift, Live also drops the pure-quiz formats. The MVP three:

1. **TBL Round** — individual answer → team consensus → discussion → final team answer. Mirrors the JABSOM TBL workflow. Composes the Branching-Scenario component (when it ships) for the discussion phase.
2. **Live Poll / Word Cloud** — instructor-prompted free-text or 1-of-N pick. Aggregate visualization (histogram + word cloud) updates in real time.
3. **Live Timeline Annotation** — class jointly adds events to a shared timeline. CRDT-backed (Y.js array of timestamped notes). Single canvas every learner sees and edits.

Live versions of MC / FIB / Question Set are **not** part of the MVP — Lamakū's native quiz tools cover that ground.

Phase 4 expansion (after MVP validates the architecture):

4. **Live DDx** — case unfolds; class collectively narrows the differential. Composes the DDx Tree (which composes Branching Scenario).
5. **Synchronous Clinical Encounter** — instructor advances the case; class votes on next action. Specialization of Branching Scenario.
6. **Live ECG / Lab Reading** — instructor shares a strip; class diagnoses; histogram of guesses revealed.
7. **Collaborative Concept Map** — class jointly builds nodes/edges. CRDT-heavy.
8. **Audio Pronunciation Round** — each learner records, instructor reviews. Audio uploaded as suspend data.

## Milestones

### M0 — Live transport plumbing *(~2 days, foundational)*

- `packages/live/transport.ts`: Trystero + Y.js wrapper. Exposes `joinRoom(code, options)` returning a room handle with shared state, presence map, and broadcast/RPC helpers.
- TURN endpoint config from `?turn=` URL param + a build-time fallback (`VITE_TURN_URL`).
- Connection failure monitoring (latency to the mesh, percent of peers we can reach).
- Vitest mocks for the room handle (Trystero is real-time / WebRTC — not unit-testable directly; mock it).

### M1 — `LiveHost` + `StudentLobby` + `InstructorConsole` shell *(~3 days)*

- Mirror of `ActivityHost`: loads JSON, picks Live component for `kind`, wires SCORM driver per-student.
- Lobby: room-code input, anonymous handle (or D2L-supplied name), "I'm the instructor" toggle.
- Console: instructor-only view inside the same Canvas — progression control, presence list, aggregate visualization.
- Phase / state machine: `lobby → question → reveal → discussion → ended`. Shared via Y.js so all clients see the same phase.

### M2 — TBL Round *(~3 days; flagship)*

- Schema: extends Multiple Choice / Branching Scenario with team grouping and per-phase prompts.
- Component: orchestrates individual → team → discussion → final-answer phases. Live-aggregates per-team responses.
- TBL is the highest-value Live activity for JABSOM; pilots here.

### M3 — Live Poll / Word Cloud *(~2 days)*

- Schema: prompt + answer mode (`pick-one` | `free-text` | `numeric`).
- Free-text mode renders a word cloud (Y.js array → frequency map → canvas render).
- Pick-one renders a live histogram.
- Anonymous-by-default (no per-student attribution to votes).

### M4 — Live Timeline Annotation *(~2 days)*

- Shared Y.js array of `{author, timestamp, label, position}` notes.
- Each learner can add a note; class sees all notes on the same horizontal timeline.
- Instructor can pin / archive notes during discussion.
- Persistence: end-of-session, each student's contribution count → SCORM score; class export → JSON.

### M5 — Hardening *(~3 days, blocking)*

- UH ITS firewall test: Trystero's BitTorrent-tracker URLs must be reachable from JABSOM campus network. If blocked, swap to a self-hosted matrix-server signaling fallback (Trystero supports it).
- Stress test: 50-peer mesh, watch CPU/network on a mid-range laptop.
- TURN-deployment decision: measure connection failure rate. If > 5%, deploy a $5/mo VPS TURN server. Configurable endpoint stays.
- Mobile: iPad / iPhone real-device testing for touch input + WebRTC reliability.

### M6 — Engine ↔ Live integration *(~1 day)*

- The same SCORM zip ships both surfaces: Engine HTML at `/` and Live HTML at `/live.html`. Authors decide per-activity whether Live is enabled (`liveMode: true` in the config); if so, learners see a "Join live session" button alongside "Start activity".
- The Engine's SCORM driver and the Live's SCORM driver are the same `@kukui/core/scorm` instance — each tab is an independent SCORM session anyway.

### Total: ~16 working days. Reasonable as a 3-week sprint after Phase 2 (Studio) ships.

## Decisions still open (need answers before M0)

| # | Decision | Recommendation |
|---|---|---|
| L1 | Anonymous-or-named identity in TBL specifically | Default anonymous for individual phase, instructor can flip to named. |
| L2 | Should the instructor's view also score them? (gradebook implication) | No — instructor's tab posts `cmi.core.lesson_status = browsed`, not `passed`. |
| L3 | What happens when a student joins late mid-phase? | Y.js late-join: replay state up to `currentPhase`, show "joined late" indicator. |
| L4 | Save-as-instructor JSON: per-student rows or per-question aggregates? | Both — single JSON with two top-level arrays. |

## What blocks M0 starting

- Phase 2 (Studio) doesn't have to be feature-complete, but the schema-first architecture has to be stable. ✅ already true.
- Branching Scenario activity needs at least a stub — TBL Round and DDx Tree compose it. ✅ stubbed in this push.
- A network where Trystero's tracker URLs aren't blocked. **TBD — needs a UH ITS check.**

## What this plan deliberately defers

- Recording / playback of a Live session for absent students (Phase 4+).
- Custom RTC server — public trackers + STUN are sufficient for MVP. Self-hosted matrix-server is an M5 fallback if trackers are blocked.
- Hand-rolled chat — Y.js + a tiny chat-widget gives this for free if needed; not MVP.
- Analytics dashboards beyond the per-class CSV/JSON download.

## References

- Notion canonical spec: <https://www.notion.so/357ee4627a7481c68ad9eb5b50628e4a>
- Live sub-page: <https://www.notion.so/357ee4627a7481c39e30f625cfba1822>
- Engine Phase 1 plan: [`./2026-05-05-engine-phase-1-plan.md`](./2026-05-05-engine-phase-1-plan.md)
- Trystero docs: <https://oxism.com/trystero/>
- Y.js docs: <https://docs.yjs.dev/>
- Research foundations (TBL, synchronous virtual classroom, CRS): [`docs/research-foundations.md`](../../research-foundations.md)
