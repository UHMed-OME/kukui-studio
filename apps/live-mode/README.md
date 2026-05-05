# @kukui/live-mode

**Phase 3 placeholder.** The Kukui Live real-time classroom UI lives here.

Spec: [Kukui Live sub-page](https://www.notion.so/357ee4627a7481c39e30f625cfba1822) on the Notion canonical spec.

Phase 3 ships inside the same SCORM zips as Engine, with a "Join live session" mode. Trystero (P2P signaling over public BitTorrent trackers) + Y.js (CRDT shared state) over WebRTC mesh. A configurable TURN endpoint is plumbed in from day one as an optional fallback for ~10% of users on symmetric NATs.
