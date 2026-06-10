import { useEffect, useState } from "react";
import type * as Y from "yjs";
import type { LiveRoomHandle } from "@kukui/live";

/**
 * Y.js binding for the Straw Poll.
 *
 * Vote state lives in a single Y.Map keyed by participantId →
 * choiceId. CRDT semantics give us "one vote per voter" for free —
 * if a student re-votes, their own entry is overwritten and the
 * latest write wins across the mesh. Total state size is O(voters),
 * not O(voters²), so a 300-student class produces ~15 KB of room
 * state at full attendance.
 *
 * Scale note: this hook is mesh-agnostic. The transport-layer mesh
 * (full-mesh Trystero in M1) is the real ceiling above ~100 peers
 * because browsers cap WebRTC connections per page. A star-topology
 * relay through the instructor's peer is the planned fix; it does
 * not require changes to this data layer.
 */
const VOTES_KEY = "straw-poll-votes";

export type Tally = {
  /** counts[choiceId] = vote count. */
  counts: Record<string, number>;
  total: number;
};

export function useStrawPoll(
  room: LiveRoomHandle,
  choiceIds: readonly string[],
  role: "instructor" | "student",
): {
  myVote: string | undefined;
  tally: Tally;
  vote(choiceId: string): void;
  clearAll(): void;
  voterCount: number;
} {
  const votesMap = room.doc.getMap<string>(VOTES_KEY);
  const [snapshot, setSnapshot] = useState(() => readSnapshot(votesMap, room.participantId));

  useEffect(() => {
    const handler = () => setSnapshot(readSnapshot(votesMap, room.participantId));
    votesMap.observe(handler);
    return () => votesMap.unobserve(handler);
  }, [votesMap, room.participantId]);

  const tally: Tally = {
    counts: Object.fromEntries(choiceIds.map((id) => [id, 0])),
    total: 0,
  };
  for (const choiceId of snapshot.values) {
    if (Object.prototype.hasOwnProperty.call(tally.counts, choiceId)) {
      tally.counts[choiceId] = (tally.counts[choiceId] ?? 0) + 1;
      tally.total += 1;
    }
  }

  const vote = (choiceId: string) => {
    room.doc.transact(() => {
      votesMap.set(room.participantId, choiceId);
    });
  };

  const clearAll = () => {
    // Instructor-only local speed-bump: integrity is advisory in P2P mode —
    // every client holds the shared doc, so a modified client can still write.
    if (role !== "instructor") return;
    room.doc.transact(() => {
      votesMap.clear();
    });
  };

  return {
    myVote: snapshot.myVote,
    tally,
    vote,
    clearAll,
    voterCount: snapshot.values.length,
  };
}

function readSnapshot(
  votesMap: Y.Map<string>,
  myId: string,
): { values: string[]; myVote: string | undefined } {
  const values: string[] = [];
  let myVote: string | undefined;
  votesMap.forEach((v: string, k: string) => {
    if (typeof v !== "string") return;
    values.push(v);
    if (k === myId) myVote = v;
  });
  return { values, myVote };
}
