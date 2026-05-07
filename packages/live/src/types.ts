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

export type TransportOptions = {
  /** Optional TURN endpoint; falls back to public STUN otherwise. */
  turn?: TurnConfig;
  /** App identifier — segregates rooms across deployments using the same trackers. */
  appId?: string;
};
