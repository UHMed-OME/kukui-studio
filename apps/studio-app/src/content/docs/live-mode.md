---
title: Live mode (alpha)
description: Synchronous in-class activities. Students join with a 6-digit code, instructor controls the pace.
order: 5
updated: 2026-05-29
---

# Live mode (alpha)

Kukui Live is a real-time synchronous mode for in-class activities. Instructors run a session from their device, students join with a 6-digit code, and the room state flows through a peer-to-peer connection, with no Kukui server in the middle.

> **Alpha.** Live mode is still in active development. The instructor and student flows work; some activities don't yet support Live; relay reliability varies by network.

## What it's for

Live mode shines when you want **everyone moving together**. Examples:

- A pre-class straw poll: "Before I start, how confident are you in last week's material?"
- Mid-lecture comprehension check: "Quick quiz: what's the most likely diagnosis?"
- Group word-cloud brainstorm: "What's the first word that comes to mind when I say 'sepsis'?"
- Backchannel Q&A: students submit questions during a long lecture, vote up the ones that matter

## How it works

1. **Instructor opens Live.** From Studio, switch to an activity that supports Live (Straw Poll, Confidence Meter, Word Cloud, Q&A Board, Quick Quiz). A 6-digit join code appears.
2. **Students join.** They open `kukuistudio.com/live` on their phones or laptops and enter the code. No login.
3. **Instructor controls the phase.** Reveal results, open polling, pause, advance: all from the instructor view.
4. **State syncs in real time** via WebRTC. There's no Kukui server holding the session; the room exists only as long as one peer (the instructor) is connected.

## Activities currently supported in Live

| Activity | What it does |
|---|---|
| Straw Poll | Single-question multiple choice with live histogram of responses |
| Confidence Meter | Slider from "no clue" to "got it"; live distribution |
| Word Cloud | Free-text short responses, aggregated into a live word cloud |
| Q&A Board | Students submit questions, others upvote; instructor can mark answered |
| Quick Quiz | Synchronized multiple-choice; instructor reveals the correct answer and the live response distribution |

More live-compatible activities are planned.

## When students can't connect

If Live works between tabs on your own computer but other devices just sit on **"waiting for the instructor,"** the network is blocking the direct device-to-device connection. This is common on eduroam, guest Wi-Fi with client isolation, and networks that block UDP.

Live always uses public STUN servers, which handle most home and single-LAN setups automatically. Restrictive networks need a **TURN relay** as a fallback: see **[Hosting a TURN server](/docs/turn-server)** for the full setup. Once a TURN server is configured (per-session via `?turn=` in the URL, in the lobby's **Advanced → connection** panel, or as a build-wide default), cross-network rooms connect reliably.

## Limitations (alpha)

- **One instructor per session.** No co-host yet.
- **Browser tab must stay open** on the instructor side. Closing the tab ends the session.
- **Best on 1–300 students.** WebRTC mesh stops being efficient at very large rooms; we're working on a hub fallback for larger classes.
- **No persistence.** When the session ends, results aren't saved by default. Use the Studio export from the instructor view if you want to keep data.

## Privacy

Live sessions transit through a peer-to-peer relay we don't operate (default: Nostr-based). No student data hits a server we run. Names are optional; students can join anonymously. If you configure a [TURN server](/docs/turn-server) for restrictive networks, session traffic that can't connect directly is relayed through *your* TURN server, so it stays on infrastructure you control, never a third party.

## What's next

- Persistent room IDs (rejoin a paused session)
- Result export per session
- Polling on the existing Multiple Choice and Fill-in-the-Blanks activities
- Larger classroom support via a hub fallback
