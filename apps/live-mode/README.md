# @kukui/live-mode

**Phase 3 placeholder.** The Kukui Live real-time classroom UI lives here.

Spec: [Kukui Live sub-page](https://www.notion.so/357ee4627a7481c39e30f625cfba1822) on the Notion canonical spec.

Phase 3 ships inside the same SCORM zips as Engine, with a "Join live session" mode. Trystero (P2P over WebRTC mesh) + Y.js (CRDT shared state). A configurable TURN endpoint is plumbed in from day one as an optional fallback for ~10% of users on symmetric NATs.

## Signaling backends

Peers discover each other through a signaling layer before WebRTC kicks in. Once connected, data flows direct P2P regardless of backend. Kukui Live supports:

- **Nostr** (default) — WebSocket connections to public Nostr relays. Federated, lightweight, not associated with file-sharing, so generally permitted on edu networks.
- **MQTT** — public MQTT brokers. Fallback if Nostr relays are blocked or flaky.

BitTorrent trackers (Trystero's library default) are deliberately **not** offered — they're commonly DPI-blocked on institutional networks, which is exactly where Kukui Live needs to work.

The active backend is picked in the lobby's "Advanced: signaling backend" disclosure, persisted to `localStorage`, and overridable via the URL param `?signal=nostr|mqtt`. Switching backends only affects peer discovery — the activity code, Y.js sync, and presence model don't change.
