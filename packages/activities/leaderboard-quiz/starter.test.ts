import { describe, it, expect } from "vitest";
import { LeaderboardQuizConfigSchema } from "./schema.js";
import starter from "./starter.js";

describe("leaderboard-quiz starter", () => {
  it("parses against the schema", () => {
    expect(LeaderboardQuizConfigSchema.safeParse(starter).success).toBe(true);
  });
});
