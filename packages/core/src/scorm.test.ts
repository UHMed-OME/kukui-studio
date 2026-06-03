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

describe("getScormDriver — web (LocalDriver) mode", () => {
  const KEY = "kukui:web:test";
  const clearStorage = () => {
    if (typeof window !== "undefined" && window?.localStorage) {
      window.localStorage.clear();
    }
  };
  beforeEach(() => {
    __setScormDriverForTest(undefined);
    clearStorage();
  });
  afterEach(() => {
    __setScormDriverForTest(undefined);
    // Restore any stubbed `window` (some tests set it to undefined) BEFORE
    // touching localStorage, and guard in case it's still absent.
    vi.unstubAllGlobals();
    clearStorage();
  });

  it("selects LocalDriver when mode is 'web' and no LMS API present", () => {
    const driver = getScormDriver({ mode: "web", storageKey: KEY });
    expect(driver.isLive()).toBe(false);
    expect(typeof driver.getWebResults).toBe("function");
  });

  it("persists score + suspend data to localStorage and survives a reload", () => {
    const driver = getScormDriver({ mode: "web", storageKey: KEY });
    driver.postScore(8, 10, true);
    driver.saveSuspendData("resume-state");

    // Simulate a reload: drop the singleton, re-create against the same key.
    __setScormDriverForTest(undefined);
    const reloaded = getScormDriver({ mode: "web", storageKey: KEY });
    expect(reloaded.loadSuspendData()).toBe("resume-state");
    const results = reloaded.getWebResults?.();
    expect(results?.score).toEqual({ raw: 8, max: 10, success: true });
    expect(results?.finishedAt).toBeTruthy();
  });

  it("accumulates interactions in the web results record", () => {
    const driver = getScormDriver({ mode: "web", storageKey: KEY });
    driver.recordInteraction({
      id: "q1",
      type: "choice",
      studentResponse: "a",
      result: { kind: "correct" },
    });
    driver.recordInteraction({
      id: "q2",
      type: "choice",
      studentResponse: "b",
      result: { kind: "wrong" },
    });
    expect(driver.getWebResults?.()?.interactions).toHaveLength(2);
  });

  it("falls back to MemoryDriver when mode is 'web' but window is absent", () => {
    vi.stubGlobal("window", undefined);
    const driver = getScormDriver({ mode: "web", storageKey: KEY });
    expect(driver.isLive()).toBe(false);
    expect(driver.getWebResults).toBeUndefined();
  });

  it("does not throw when localStorage access fails", () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    vi.stubGlobal("window", { ...globalThis.window, localStorage: throwingStorage });
    const driver = getScormDriver({ mode: "web", storageKey: KEY });
    expect(() => driver.postScore(5, 10, false)).not.toThrow();
    expect(driver.getWebResults?.()?.score).toEqual({ raw: 5, max: 10, success: false });
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

describe("PipwerksDriver.recordInteraction", () => {
  beforeEach(() => {
    __setScormDriverForTest(undefined);
  });
  afterEach(() => {
    __setScormDriverForTest(undefined);
    vi.unstubAllGlobals();
  });

  it("writes cmi.interactions.0.* fields and increments the index per call", () => {
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
    driver.recordInteraction({
      id: "multiple-choice:abc12345:q1",
      type: "choice",
      studentResponse: "{a,c}",
      correctResponse: "{a,b}",
      result: { kind: "wrong" },
      weighting: 2,
      latencySeconds: 12.5,
    });

    expect(set).toHaveBeenCalledWith("cmi.interactions.0.id", "multiple-choice:abc12345:q1");
    expect(set).toHaveBeenCalledWith("cmi.interactions.0.type", "choice");
    expect(set).toHaveBeenCalledWith("cmi.interactions.0.student_response", "{a,c}");
    expect(set).toHaveBeenCalledWith("cmi.interactions.0.correct_responses.0.pattern", "{a,b}");
    expect(set).toHaveBeenCalledWith("cmi.interactions.0.result", "wrong");
    expect(set).toHaveBeenCalledWith("cmi.interactions.0.weighting", "2");
    expect(set).toHaveBeenCalledWith("cmi.interactions.0.latency", "0000:00:12.50");
    expect(set).toHaveBeenCalledWith(
      "cmi.interactions.0.time",
      expect.stringMatching(/^\d{2}:\d{2}:\d{2}$/),
    );
    expect(save).toHaveBeenCalled();

    driver.recordInteraction({
      id: "multiple-choice:abc12345:q2",
      type: "choice",
      studentResponse: "a",
      result: { kind: "correct" },
    });
    expect(set).toHaveBeenCalledWith("cmi.interactions.1.id", "multiple-choice:abc12345:q2");
  });

  it("omits correct_responses and latency when not provided", () => {
    const set = vi.fn(() => true);
    const save = vi.fn(() => true);
    const init = vi.fn(() => true);
    const quit = vi.fn(() => true);
    vi.stubGlobal("window", {
      ...globalThis.window,
      pipwerks: { SCORM: { init, get: () => "", set, save, quit, status: () => "passed" } },
    });

    const driver = getScormDriver();
    driver.recordInteraction({
      id: "reflection-prompt:abc:r1",
      type: "fill-in",
      studentResponse: "I learned about pancreatic function.",
      result: { kind: "neutral" },
    });

    const writes = set.mock.calls.map((c) => c[0]);
    expect(writes).not.toContain("cmi.interactions.0.correct_responses.0.pattern");
    expect(writes).not.toContain("cmi.interactions.0.latency");
  });

  it("truncates over-length id and student_response", () => {
    const set = vi.fn(() => true);
    const save = vi.fn(() => true);
    const init = vi.fn(() => true);
    const quit = vi.fn(() => true);
    vi.stubGlobal("window", {
      ...globalThis.window,
      pipwerks: { SCORM: { init, get: () => "", set, save, quit, status: () => "passed" } },
    });
    const driver = getScormDriver();
    driver.recordInteraction({
      id: "x".repeat(300),
      type: "fill-in",
      studentResponse: "y".repeat(300),
      result: { kind: "neutral" },
    });
    const idCall = set.mock.calls.find((c) => c[0] === "cmi.interactions.0.id");
    const responseCall = set.mock.calls.find((c) => c[0] === "cmi.interactions.0.student_response");
    expect(idCall?.[1]).toHaveLength(255);
    expect(idCall?.[1]?.endsWith("…")).toBe(true);
    expect(responseCall?.[1]).toHaveLength(255);
    expect(responseCall?.[1]?.endsWith("…")).toBe(true);
  });
});
