import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LZString from "lz-string";
import { __setScormDriverForTest, getScormDriver, webStorageKey } from "./scorm.js";
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

  it("clamps the posted score to 0–100", () => {
    const set = vi.fn(() => true);
    vi.stubGlobal("window", {
      ...globalThis.window,
      pipwerks: {
        SCORM: { init: () => true, get: () => "", set, save: () => true, quit: () => true, status: () => "passed" },
      },
    });

    const driver = getScormDriver();
    driver.postScore(15, 10, true); // raw > max (bonus points)
    expect(set).toHaveBeenCalledWith("cmi.core.score.raw", "100");
    set.mockClear();
    driver.postScore(-5, 10, false); // negative scoring
    expect(set).toHaveBeenCalledWith("cmi.core.score.raw", "0");
  });

  it("falls through to LocalDriver when LMSInitialize fails and web mode was requested", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("window", {
      ...globalThis.window,
      localStorage: globalThis.window.localStorage,
      pipwerks: {
        SCORM: { init: () => false, get: () => "", set: () => true, save: () => true, quit: () => true, status: () => "passed" },
      },
    });

    const driver = getScormDriver({ mode: "web", storageKey: "kukui:web:init-fail" });
    expect(driver.isLive()).toBe(false);
    expect(typeof driver.getWebResults).toBe("function");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("LMSInitialize failed"));
    warn.mockRestore();
    window.localStorage.removeItem("kukui:web:init-fail");
  });

  it("falls through to MemoryDriver when LMSInitialize fails and no mode was requested", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("window", {
      ...globalThis.window,
      pipwerks: {
        SCORM: { init: () => false, get: () => "", set: () => true, save: () => true, quit: () => true, status: () => "passed" },
      },
    });

    const driver = getScormDriver();
    expect(driver.isLive()).toBe(false);
    expect(driver.getWebResults).toBeUndefined();
    warn.mockRestore();
  });
});

describe("PipwerksDriver suspend data", () => {
  beforeEach(() => {
    __setScormDriverForTest(undefined);
  });
  afterEach(() => {
    __setScormDriverForTest(undefined);
    vi.unstubAllGlobals();
  });

  const stubApi = (overrides: Partial<{ get: () => string }> = {}) => {
    const set = vi.fn(() => true);
    const save = vi.fn(() => true);
    vi.stubGlobal("window", {
      ...globalThis.window,
      pipwerks: {
        SCORM: {
          init: () => true,
          get: () => "",
          set,
          save,
          quit: () => true,
          status: () => "passed",
          ...overrides,
        },
      },
    });
    return { set, save };
  };

  it("round-trips suspend data through LZ compression", () => {
    const { set } = stubApi();
    const driver = getScormDriver();
    driver.saveSuspendData('{"answers":[1,2,3]}');
    const written = set.mock.calls.find((c) => c[0] === "cmi.suspend_data")?.[1] as string;
    expect(written).toBeTruthy();
    expect(LZString.decompressFromUTF16(written)).toBe('{"answers":[1,2,3]}');
  });

  it("refuses to write when the compressed payload exceeds the 4096-char cap", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { set, save } = stubApi();
    const driver = getScormDriver();
    // Deterministic pseudo-random noise — incompressible, so the LZ output
    // stays well above the cap.
    let seed = 1;
    const rand = () => (seed = (seed * 48271) % 0x7fffffff) / 0x7fffffff;
    const noisy = Array.from({ length: 20000 }, () =>
      String.fromCharCode(32 + Math.floor(rand() * 90)),
    ).join("");
    expect(LZString.compressToUTF16(noisy).length).toBeGreaterThan(4096);

    driver.saveSuspendData(noisy);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("cap"));
    expect(set.mock.calls.find((c) => c[0] === "cmi.suspend_data")).toBeUndefined();
    expect(save).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("treats an empty decompression result as undefined on load", () => {
    // compressToUTF16("") decompresses to "" — never valid resume JSON.
    stubApi({ get: () => LZString.compressToUTF16("") });
    const driver = getScormDriver();
    expect(driver.loadSuspendData()).toBeUndefined();
  });

  it("treats an empty stored value as undefined on load", () => {
    stubApi({ get: () => "" });
    const driver = getScormDriver();
    expect(driver.loadSuspendData()).toBeUndefined();
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

  it("de-dupes interactions by id — a re-answer replaces the prior record", () => {
    const driver = getScormDriver({ mode: "web", storageKey: KEY });
    driver.recordInteraction({
      id: "q1",
      type: "choice",
      studentResponse: "a",
      result: { kind: "wrong" },
    });
    driver.recordInteraction({
      id: "q1",
      type: "choice",
      studentResponse: "b",
      result: { kind: "correct" },
    });
    const interactions = driver.getWebResults?.()?.interactions;
    expect(interactions).toHaveLength(1);
    expect(interactions?.[0]?.studentResponse).toBe("b");
    expect(interactions?.[0]?.result).toEqual({ kind: "correct" });
  });

  it("falls back to MemoryDriver when mode is 'web' but window is absent", () => {
    vi.stubGlobal("window", undefined);
    const driver = getScormDriver({ mode: "web", storageKey: KEY });
    expect(driver.isLive()).toBe(false);
    expect(driver.getWebResults).toBeUndefined();
  });

  it("tolerates a legacy/tampered record with a non-array interactions field", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ results: { score: { raw: 1, max: 2, success: false }, interactions: null } }),
    );
    const driver = getScormDriver({ mode: "web", storageKey: KEY });
    expect(driver.getWebResults?.()?.interactions).toEqual([]);
    expect(() =>
      driver.recordInteraction({
        id: "q1",
        type: "choice",
        studentResponse: "a",
        result: { kind: "correct" },
      }),
    ).not.toThrow();
    expect(driver.getWebResults?.()?.interactions).toHaveLength(1);
  });

  it("drops tampered fields with wrong types from the stored record", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        suspend: 12345, // must be a string
        results: {
          score: { raw: "8", max: 10, success: true }, // raw must be a number
          name: 7, // must be a string
          finishedAt: ["2026-06-03"], // must be a string
          interactions: [],
        },
      }),
    );
    const driver = getScormDriver({ mode: "web", storageKey: KEY });
    expect(driver.loadSuspendData()).toBeUndefined();
    const results = driver.getWebResults?.();
    expect(results?.score).toBeUndefined();
    expect(results?.name).toBeUndefined();
    expect(results?.finishedAt).toBeUndefined();
    expect(driver.getStudentName()).toBeUndefined();
  });

  it("returns a fresh record when the stored value is not an object", () => {
    window.localStorage.setItem(KEY, '"just-a-string"');
    const driver = getScormDriver({ mode: "web", storageKey: KEY });
    expect(driver.loadSuspendData()).toBeUndefined();
    expect(driver.getWebResults?.()).toEqual({ interactions: [] });
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
    // id is a CMIIdentifier — plain slice, no ellipsis (U+2026 is outside
    // the identifier character set). Responses keep the marker.
    expect(idCall?.[1]).toBe("x".repeat(255));
    expect(responseCall?.[1]).toHaveLength(255);
    expect(responseCall?.[1]?.endsWith("…")).toBe(true);
  });
});

describe("webStorageKey", () => {
  it("includes kind, path, and config URL so co-located activities don't share state", () => {
    const a = webStorageKey("multiple-choice", "samples/multiple-choice/basic.json");
    const b = webStorageKey("multiple-choice", "samples/multiple-choice/full.json");
    expect(a).not.toBe(b);
    expect(a).toContain("multiple-choice");
    expect(a).toContain("samples/multiple-choice/basic.json");
    expect(a).toContain(window.location.pathname);
  });
});
