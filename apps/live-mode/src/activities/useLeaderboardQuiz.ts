import { useEffect, useState } from "react";
import type * as Y from "yjs";
import type { LiveRoomHandle } from "@kukui/live";

/**
 * Y.js binding for the Leaderboard Quiz.
 *
 * One Y.Map keyed by participantId → LeaderboardEntry. Each student only
 * ever writes their own key, so there are no write conflicts. State is
 * O(participants) and lives in memory only: the map is cleared when the
 * instructor resets, and no Y.js persistence provider is attached (see the
 * retention note in the design spec). No student ID is broadcast; the
 * participantId is the Live session key.
 */
const SCORES_KEY = "leaderboard-quiz-scores";
/**
 * Instructor-owned round settings, read by students: `shuffle`, `showBoard`, `pace`
 * ("auto" = students race the clock; "manual" = the instructor steps everyone
 * through the same questions), and in manual mode `deck` (indices into
 * config.questions) + `index` (the current question).
 */
const SETTINGS_KEY = "leaderboard-quiz-settings";

export type LeaderboardEntry = {
  displayName: string;
  score: number;
  elapsedMs: number;
  /** Epoch ms when the student finished, or null while still playing. */
  finishedAt: number | null;
};

export type Pace = "auto" | "manual";
export type ManualState = { deck: number[]; index: number };

export type RankedEntry = LeaderboardEntry & { id: string; rank: number };

/** Score desc, then earliest finisher (unfinished last), then fastest time. */
export function rankEntries(entries: Iterable<[string, LeaderboardEntry]>): RankedEntry[] {
  return [...entries]
    .sort(
      ([, a], [, b]) =>
        b.score - a.score ||
        (a.finishedAt ?? Infinity) - (b.finishedAt ?? Infinity) ||
        a.elapsedMs - b.elapsedMs,
    )
    .map(([id, e], i) => ({ ...e, id, rank: i + 1 }));
}

/** Peers can send anything; accept only well-formed entries. */
function parse(v: unknown): LeaderboardEntry | null {
  if (!v || typeof v !== "object") return null;
  const e = v as Record<string, unknown>;
  if (
    typeof e.displayName !== "string" ||
    typeof e.score !== "number" || !Number.isFinite(e.score) ||
    typeof e.elapsedMs !== "number" || !Number.isFinite(e.elapsedMs) ||
    !(e.finishedAt === null || typeof e.finishedAt === "number")
  ) {
    return null;
  }
  return {
    displayName: e.displayName.slice(0, 40),
    score: e.score,
    elapsedMs: e.elapsedMs,
    finishedAt: e.finishedAt as number | null,
  };
}

function read(map: Y.Map<LeaderboardEntry>): RankedEntry[] {
  const out: [string, LeaderboardEntry][] = [];
  map.forEach((v, k) => {
    const e = parse(v);
    if (e) out.push([k, e]);
  });
  return rankEntries(out);
}

export function useLeaderboardQuiz(
  room: LiveRoomHandle,
  role: "instructor" | "student",
  defaultShuffle: boolean,
  defaultTimeLimit = 60,
): {
  ranked: RankedEntry[];
  shuffle: boolean;
  setShuffle(next: boolean): void;
  /** Whether students see the leaderboard (the instructor always does). Default true. */
  showBoard: boolean;
  setShowBoard(next: boolean): void;
  pace: Pace;
  setPace(next: Pace): void;
  /** Automatic-pace countdown in seconds; the instructor's override, else the config default. */
  timeLimit: number;
  setTimeLimit(next: number): void;
  manual: ManualState;
  /** Instructor: publish the question order and reset to the first question. */
  startManual(deck: number[]): void;
  setManualIndex(next: number): void;
  report(entry: LeaderboardEntry): void;
  clearAll(): void;
} {
  const map = room.doc.getMap<LeaderboardEntry>(SCORES_KEY);
  const [ranked, setRanked] = useState(() => read(map));
  const settings = room.doc.getMap<unknown>(SETTINGS_KEY);
  const readSettings = () => {
    const sh = settings.get("shuffle");
    const deck = settings.get("deck");
    const index = settings.get("index");
    const tl = settings.get("timeLimit");
    return {
      shuffle: typeof sh === "boolean" ? sh : defaultShuffle,
      showBoard: settings.get("showBoard") !== false,
      timeLimit: typeof tl === "number" && tl >= 1 ? Math.floor(tl) : defaultTimeLimit,
      pace: (settings.get("pace") === "manual" ? "manual" : "auto") as Pace,
      manual: {
        // Peers can send anything: keep only integers.
        deck: Array.isArray(deck) ? deck.filter((n): n is number => Number.isInteger(n)) : [],
        index: typeof index === "number" && index >= 0 ? Math.floor(index) : 0,
      },
    };
  };
  const [{ shuffle, showBoard, pace, timeLimit, manual }, setSettingsState] = useState(readSettings);

  useEffect(() => {
    const handler = () => setSettingsState(readSettings());
    settings.observe(handler);
    return () => settings.unobserve(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, defaultShuffle]);

  useEffect(() => {
    const handler = () => setRanked(read(map));
    map.observe(handler);
    return () => map.unobserve(handler);
  }, [map]);

  return {
    ranked,
    shuffle,
    // Local speed-bumps only, same as clearAll.
    setShuffle: (next) => {
      if (role !== "instructor") return;
      room.doc.transact(() => settings.set("shuffle", next));
    },
    showBoard,
    setShowBoard: (next) => {
      if (role !== "instructor") return;
      room.doc.transact(() => settings.set("showBoard", next));
    },
    pace,
    setPace: (next) => {
      if (role !== "instructor") return;
      room.doc.transact(() => settings.set("pace", next));
    },
    timeLimit,
    setTimeLimit: (next) => {
      if (role !== "instructor" || !(next >= 1)) return;
      room.doc.transact(() => settings.set("timeLimit", Math.floor(next)));
    },
    manual,
    startManual: (deck) => {
      if (role !== "instructor") return;
      room.doc.transact(() => {
        settings.set("deck", deck);
        settings.set("index", 0);
      });
    },
    setManualIndex: (next) => {
      if (role !== "instructor") return;
      room.doc.transact(() => settings.set("index", next));
    },
    report: (entry) => {
      room.doc.transact(() => map.set(room.participantId, entry));
    },
    clearAll: () => {
      // Local speed-bump only: in P2P mode a modified client can still write.
      if (role !== "instructor") return;
      room.doc.transact(() => map.clear());
    },
  };
}
