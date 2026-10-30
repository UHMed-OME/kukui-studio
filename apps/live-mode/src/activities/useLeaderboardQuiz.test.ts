import { describe, expect, it } from "vitest";
import { rankEntries, type LeaderboardEntry } from "./useLeaderboardQuiz.js";

const e = (score: number, elapsedMs: number, finishedAt: number | null): LeaderboardEntry => ({
  displayName: "x",
  score,
  elapsedMs,
  finishedAt,
});

describe("rankEntries", () => {
  it("orders by score, then earliest finish, then unfinished last", () => {
    const ranked = rankEntries([
      ["still-playing", e(30, 5000, null)],
      ["late", e(30, 9000, 2000)],
      ["early", e(30, 9000, 1000)],
      ["top", e(40, 20000, 3000)],
    ]);
    expect(ranked.map((r) => r.id)).toEqual(["top", "early", "late", "still-playing"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });
});
