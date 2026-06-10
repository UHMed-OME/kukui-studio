import { useEffect, useState } from "react";
import * as Y from "yjs";
import type { LiveRoomHandle } from "@kukui/live";

const SUBMISSIONS_KEY = "word-cloud-submissions";

// Hard per-participant cap, well above any authored `submissionsPerStudent`
// limit (UI-enforced). Stops a misbehaving client from flooding the shared
// doc with unbounded entries.
const MAX_SUBMISSIONS_PER_PARTICIPANT = 50;

export type WordTally = Map<string, { count: number; rawSamples: string[] }>;

export type WordCloudSnapshot = {
  mySubmissions: string[];
  tally: WordTally;
  total: number;
};

/**
 * Y.js binding for Word Cloud. Each participant owns a Y.Array of
 * their submitted strings under the top-level `SUBMISSIONS_KEY` Y.Map
 * (keyed by participantId). We tally + normalize at read time so
 * `caseSensitive` can flip without rewriting state.
 *
 * At 300 students × 3 submissions each ≈ 900 short strings × ~20
 * bytes = ~18 KB total. Comfortable within the 9–15 KB envelope we
 * targeted for live activity state.
 */
export function useWordCloud(
  room: LiveRoomHandle,
  caseSensitive: boolean,
  role: "instructor" | "student",
): {
  snapshot: WordCloudSnapshot;
  submit(text: string): void;
  remove(text: string): void;
  clearAll(): void;
} {
  const root = room.doc.getMap<Y.Array<string>>(SUBMISSIONS_KEY);
  const [snapshot, setSnapshot] = useState(() => read(root, room.participantId, caseSensitive));

  useEffect(() => {
    const handler = () => setSnapshot(read(root, room.participantId, caseSensitive));
    root.observeDeep(handler);
    return () => root.unobserveDeep(handler);
  }, [root, room.participantId, caseSensitive]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    room.doc.transact(() => {
      let arr = root.get(room.participantId);
      if (!arr) {
        arr = new Y.Array<string>();
        root.set(room.participantId, arr);
      }
      if (arr.length >= MAX_SUBMISSIONS_PER_PARTICIPANT) return;
      arr.push([trimmed]);
    });
  };

  const remove = (text: string) => {
    room.doc.transact(() => {
      const arr = root.get(room.participantId);
      if (!arr) return;
      for (let i = arr.length - 1; i >= 0; i -= 1) {
        if (arr.get(i) === text) {
          arr.delete(i, 1);
          break;
        }
      }
    });
  };

  const clearAll = () => {
    // Instructor-only local speed-bump: integrity is advisory in P2P mode —
    // every client holds the shared doc, so a modified client can still write.
    if (role !== "instructor") return;
    room.doc.transact(() => root.clear());
  };

  return { snapshot, submit, remove, clearAll };
}

function read(
  root: Y.Map<Y.Array<string>>,
  myId: string,
  caseSensitive: boolean,
): WordCloudSnapshot {
  const tally: WordTally = new Map();
  const mySubmissions: string[] = [];
  let total = 0;
  root.forEach((arr: Y.Array<string>, k: string) => {
    if (!arr || typeof arr.forEach !== "function") return;
    arr.forEach((raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      const key = caseSensitive ? trimmed : trimmed.toLowerCase();
      const slot = tally.get(key) ?? { count: 0, rawSamples: [] };
      slot.count += 1;
      if (slot.rawSamples.length < 4) slot.rawSamples.push(trimmed);
      tally.set(key, slot);
      total += 1;
      if (k === myId) mySubmissions.push(trimmed);
    });
  });
  return { mySubmissions, tally, total };
}
