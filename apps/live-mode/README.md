# @kukui/live-mode

**Phase 3 placeholder.** The Kukui Live real-time classroom UI lives here.

Spec: [Kukui Live sub-page](https://www.notion.so/357ee4627a7481c39e30f625cfba1822) on the Notion canonical spec.

Phase 3 ships inside the same SCORM zips as Engine, with a "Join live session" mode. Trystero (P2P over WebRTC mesh) + Y.js (CRDT shared state). A configurable TURN endpoint is plumbed in from day one as an optional fallback for ~10% of users on symmetric NATs.

## Signaling backends

Peers discover each other through a signaling layer before WebRTC kicks in. Once connected, data flows direct P2P regardless of backend. Kukui Live supports:

- **Nostr** (default) — WebSocket connections to public Nostr relays. Federated, lightweight, not associated with file-sharing, so generally permitted on edu networks.
- **MQTT** — public MQTT brokers. Fallback if Nostr relays are blocked or flaky.

BitTorrent trackers (Trystero's library default) are deliberately **not** offered — they're commonly DPI-blocked on institutional networks, which is exactly where Kukui Live needs to work.

The active backend is picked in the lobby's "Advanced: connection" disclosure, persisted to `localStorage`, and overridable via the URL param `?signal=nostr|mqtt`. Switching backends only affects peer discovery — the activity code, Y.js sync, and presence model don't change.

## NAT traversal: STUN and TURN

Signaling only gets two peers introduced; the actual WebRTC connection still has to punch through each peer's NAT. A short list of public STUN servers is always configured, which is enough for peers on the same LAN and many home networks. But **restrictive networks — symmetric NATs, UDP-blocking firewalls, and Wi‑Fi with client/AP isolation (common on campus and guest networks) — block direct P2P entirely**. On those, the only way two devices connect is by relaying through a **TURN** server. This is the usual cause of "everyone is stuck waiting for the instructor" when it works on one machine but not across devices.

There is no public TURN baked in (a TURN relay carries all session traffic, so it shouldn't be an uncurated third party). Provide one of your own, resolved most- to least-specific:

1. **`?turn=` URL param** — `?turn=<url>&turnUser=<u>&turnCred=<c>`. Per-session override; handy for testing.
2. **Lobby setting** — "Advanced: connection" → "Use a custom TURN server" (URL + optional username/credential). Persisted to `localStorage`.
3. **Authored config** — `config.live.turn = { url, username?, credential? }` baked into the activity JSON.
4. **Build-time default ("ours")** — set in CI so every deployed build uses your relay with zero per-instructor setup:
   - `VITE_KUKUI_TURN_URL` (e.g. `turns:turn.kukui.example.edu:5349`)
   - `VITE_KUKUI_TURN_USER` (optional)
   - `VITE_KUKUI_TURN_CRED` (optional)

### Hosting the TURN server

A TURN server is a long-running daemon (e.g. [coturn](https://github.com/coturn/coturn)) that needs a public IP and open relay ports — so it can't run on GitHub Pages (static only) or GitHub Actions (ephemeral CI runners). It belongs on a small always-on VPS (Fly.io, Hetzner, DigitalOcean, AWS Lightsail, Oracle Cloud free tier, etc.). Use `turns:` (TLS, port 5349) so it survives networks that only allow outbound 443/TLS, and prefer short-lived credentials over a static username/password. Once it's up, point the build at it via the `VITE_KUKUI_TURN_*` vars above.
