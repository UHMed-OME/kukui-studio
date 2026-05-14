import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __setScormDriverForTest, getScormDriver } from "./scorm.js";
import type { InteractionRecord } from "./types.js";

describe("getScormDriver — fallback memory driver", () => {
  beforeEach(() => {
    __setScormDriverForTest(undefined);
  });
  afterEach(() => {
    __setScormDriverForTest(undefined);
    vi.unstubAllGlobals();
  });

  it("returns the in-memory driver when window.pipwerks is absent", () => {
    const driver = getScormDriver();
    expect(driver.isLive()).toBe(false);
  });

  it("memory driver round-trips suspend data without LMS", () => {
    const driver = getScormDriver();
    driver.saveSuspendData("hello");
    expect(driver.loadSuspendData()).toBe("hello");
  });

  it("memory driver postScore does not throw and logs", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const driver = getScormDriver();
    driver.postScore(8, 10, true);
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/score 8\/10 passed/));
    spy.mockRestore();
  });

  it("returns the same driver on repeated calls (singleton)", () => {
    const a = getScormDriver();
    const b = getScormDriver();
    expect(a).toBe(b);
  });
});

describe("getScormDriver — pipwerks driver", () => {
  beforeEach(() => {
    __setScormDriverForTest(undefined);
  });
  afterEach(() => {
    __setScormDriverForTest(undefined);
    vi.unstubAllGlobals();
  });

  it("uses pipwerks when window.pipwerks.SCORM exists", () => {
    const set = vi.fn(() => true);
    const get = vi.fn(() => "");
    const save = vi.fn(() => true);
    const init = vi.fn(() => true);
    const quit = vi.fn(() => true);
    const status = vi.fn(() => "passed");
    vi.stubGlobal("window", {
      ...globalThis.window,
      pipwerks: { SCORM: { init, get, set, save, quit, status } },
    });

    const driver = getScormDriver();
    expect(driver.isLive()).toBe(true);
    driver.postScore(8, 10, true);

    expect(set).toHaveBeenCalledWith("cmi.core.score.raw", "80");
    expect(set).toHaveBeenCalledWith("cmi.core.lesson_status", "passed");
    expect(save).toHaveBeenCalled();
  });
});

describe("MemoryDriver.recordInteraction", () => {
  beforeEach(() => {
    __setScormDriverForTest(undefined);
  });
  afterEach(() => {
    __setScormDriverForTest(undefined);
    vi.unstubAllGlobals();
  });

  it("logs an interaction summary in dev preview mode", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const driver = getScormDriver();
    const record: InteractionRecord = {
      id: "multiple-choice:abc12345:q1",
      type: "choice",
      studentResponse: "{a,c}",
      correctResponse: "{a,b}",
      result: { kind: "wrong" },
      weighting: 1,
      latencySeconds: 12.5,
    };
    driver.recordInteraction(record);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("multiple-choice:abc12345:q1"),
    );
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("wrong"));
    spy.mockRestore();
  });
});
