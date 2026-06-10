import { useEffect, useState } from "react";
import type * as Y from "yjs";
import type { LiveRoomHandle } from "@kukui/live";

const RATINGS_KEY = "confidence-meter-ratings";

export type RatingSnapshot = {
  values: number[];
  myRating: number | undefined;
  mean: number;
};

/**
 * Y.js binding for Confidence Meter. Single number per participant
 * (their current rating). CRDT semantics give one entry per
 * participantId; re-rating overwrites. Total state at 300 voters
 * = ~8 bytes × 300 = tiny.
 */
export function useConfidenceMeter(
  room: LiveRoomHandle,
  role: "instructor" | "student",
): {
  snapshot: RatingSnapshot;
  rate(value: number): void;
  clearAll(): void;
} {
  const ratings = room.doc.getMap<number>(RATINGS_KEY);
  const [snapshot, setSnapshot] = useState(() => read(ratings, room.participantId));

  useEffect(() => {
    const handler = () => setSnapshot(read(ratings, room.participantId));
    ratings.observe(handler);
    return () => ratings.unobserve(handler);
  }, [ratings, room.participantId]);

  const rate = (value: number) => {
    room.doc.transact(() => {
      ratings.set(room.participantId, value);
    });
  };

  const clearAll = () => {
    // Instructor-only local speed-bump: integrity is advisory in P2P mode —
    // every client holds the shared doc, so a modified client can still write.
    if (role !== "instructor") return;
    room.doc.transact(() => ratings.clear());
  };

  return { snapshot, rate, clearAll };
}

function read(map: Y.Map<number>, myId: string): RatingSnapshot {
  const values: number[] = [];
  let myRating: number | undefined;
  map.forEach((v: number, k: string) => {
    if (typeof v !== "number") return;
    values.push(v);
    if (k === myId) myRating = v;
  });
  const mean =
    values.length === 0
      ? 0
      : values.reduce((a, b) => a + b, 0) / values.length;
  return { values, myRating, mean };
}
