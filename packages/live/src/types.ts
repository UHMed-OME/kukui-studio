/**
 * Shared types for the Kukui Live transport + room layer.
 *
 * Live mode runs entirely client-side: each browser tab connects to a
 * mesh of peers via Trystero, shares state via Y.js CRDTs, and posts
 * SCORM scores at session end through @kukui/core's per-student SCORM
 * driver. There is no UH-operated backend — see
 * docs/superpowers/plans/2026-05-06-kukui-live-plan.md for context.
 */
import type { ActivityKind } from "@kukui/core";

/** Phases shared across the room. Drives instructor + student UIs. */
export type LivePhase =
  | "lobby"
  | "question"
  | "reveal"
  | "discussion"
  | "ended";

export type RoomCode = string; // hex-ish, derived from instructor's 6-digit code

export type ParticipantId = string; // SCORM cmi.core.student_id, or anonymous nanoid

/**
 * Per-student presence record. Shared via Y.js's awareness layer so all
 * peers see who's joined without polling.
 */
export type Presence = {
  id: ParticipantId;
  name: string;
  role: "instructor" | "student";
  joinedAt: number;
};

/**
 * The state a Live activity instance writes into the room. Each activity
 * kind extends this with kind-specific fields under `payload`.
 */
export type LiveRoomState<TPayload = unknown> = {
  activityKind: ActivityKind;
  phase: LivePhase;
  currentQuestionId: string | null;
  payload: TPayload;
};

export type TurnConfig = {
  /** TURN server URL (turns://… recommended). Empty string disables TURN. */
  url: string;
  username?: string;
  credential?: string;
};

/**
 * Which Trystero signaling backend to use. Determines how peers find
 * each other before WebRTC kicks in. After signaling, data flows
 * direct P2P regardless of which backend you picked.
 *
 *   - `nostr`: WebSocket connections to public Nostr relays. The
 *     default — federated, lightweight, not associated with file-
 *     sharing, so generally permitted on edu networks.
 *   - `mqtt`: public MQTT brokers. Use as a fallback if Nostr relays
 *     are blocked or flaky in a given network environment.
 *
 * BitTorrent trackers (Trystero's library default) are deliberately
 * not offered — they're commonly DPI-blocked on institutional networks.
 */
export type SignalingBackend = "nostr" | "mqtt";

export type TransportOptions = {
  /** Which signaling backend to use. Defaults to `"nostr"`. */
  backend?: SignalingBackend;
  /**
   * Optional explicit list of relay/broker URLs. When omitted, Trystero
   * picks sensible public defaults per backend. Useful for pinning to
   * an institution-friendly relay or testing a self-hosted one.
   */
  relayUrls?: string[];
  /** Optional TURN endpoint; falls back to public STUN otherwise. */
  turn?: TurnConfig;
  /** App identifier — segregates rooms across deployments using the same relays. */
  appId?: string;
};
