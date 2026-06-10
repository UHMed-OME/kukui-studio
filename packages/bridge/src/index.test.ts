import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetBridgeForTest, attachBridge } from "./index.js";

describe("kukuiBridge — preview / no-pipwerks fallback", () => {
  beforeEach(() => {
    __resetBridgeForTest();
    delete (window as unknown as { pipwerks?: unknown }).pipwerks;
  });
  afterEach(() => {
    __resetBridgeForTest();
  });

  it("attaches window.kukuiBridge", () => {
    attachBridge(window);
    expect(window.kukuiBridge).toBeDefined();
    expect(typeof window.kukuiBridge?.OnActivityComplete).toBe("function");
  });

  it("IsConnected() returns false when pipwerks is absent", () => {
    const b = attachBridge(window);
    expect(b.IsConnected()).toBe(false);
  });

  it("OnActivityComplete returns false in preview mode but doesn't throw", () => {
    const b = attachBridge(window);
    expect(b.OnActivityComplete(8, 10, true)).toBe(false);
  });

  it("SaveSuspendData / LoadSuspendData round-trip via in-memory shim", () => {
    const b = attachBridge(window);
    b.SaveSuspendData("hello");
    expect(b.LoadSuspendData()).toBe("hello");
  });

  it("SaveSuspendData refuses an over-cap payload in preview mode and keeps the previous value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const b = attachBridge(window);
    b.SaveSuspendData("hello");
    expect(b.SaveSuspendData("x".repeat(5000))).toBe(false);
    expect(warn).toHaveBeenCalled();
    expect(b.LoadSuspendData()).toBe("hello");
    warn.mockRestore();
  });

  it("GetUrlParam reads from window.location.search", () => {
    const original = window.location.href;
    window.history.replaceState(null, "", "/?config=samples/x.json&foo=bar");
    const b = attachBridge(window);
    expect(b.GetUrlParam("config")).toBe("samples/x.json");
    expect(b.GetUrlParam("missing")).toBe("");
    window.history.replaceState(null, "", original);
  });

  it("returns the same bridge object on repeated attachBridge calls", () => {
    const a = attachBridge(window);
    const b = attachBridge(window);
    expect(a).toBe(b);
  });
});

describe("kukuiBridge — pipwerks-connected mode", () => {
  beforeEach(() => {
    __resetBridgeForTest();
  });
  afterEach(() => {
    __resetBridgeForTest();
    delete (window as unknown as { pipwerks?: unknown }).pipwerks;
  });

  it("OnActivityComplete posts scaled score + lesson_status when connected", () => {
    const set = vi.fn(() => true);
    const get = vi.fn(() => "");
    const save = vi.fn(() => true);
    const init = vi.fn(() => true);
    const quit = vi.fn(() => true);
    (window as unknown as { pipwerks: { SCORM: typeof api } }).pipwerks = {
      SCORM: { init, get, set, save, quit },
    };
    const api = { init, get, set, save, quit };

    const b = attachBridge(window);
    expect(b.IsConnected()).toBe(true);
    expect(b.OnActivityComplete(8, 10, true)).toBe(true);
    expect(set).toHaveBeenCalledWith("cmi.core.score.raw", "80");
    expect(set).toHaveBeenCalledWith("cmi.core.lesson_status", "passed");
    expect(save).toHaveBeenCalled();
  });

  it("SaveSuspendData refuses to write above the 4096-char cap (no truncated JSON on the LMS)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const set = vi.fn(() => true);
    const save = vi.fn(() => true);
    (window as unknown as { pipwerks: { SCORM: unknown } }).pipwerks = {
      SCORM: {
        init: () => true,
        get: () => "",
        set,
        save,
        quit: () => true,
      },
    };
    const b = attachBridge(window);
    const huge = "x".repeat(5000);
    expect(b.SaveSuspendData(huge)).toBe(false);
    expect(warn).toHaveBeenCalled();
    expect(set.mock.calls.find((c) => c[0] === "cmi.suspend_data")).toBeUndefined();
    expect(save).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("OnActivityComplete clamps the posted score to 0–100", () => {
    const set = vi.fn(() => true);
    (window as unknown as { pipwerks: { SCORM: unknown } }).pipwerks = {
      SCORM: {
        init: () => true,
        get: () => "",
        set,
        save: () => true,
        quit: () => true,
      },
    };
    const b = attachBridge(window);
    expect(b.OnActivityComplete(15, 10, true)).toBe(true); // raw > max (bonus points)
    expect(set).toHaveBeenCalledWith("cmi.core.score.raw", "100");
    set.mockClear();
    expect(b.OnActivityComplete(-5, 10, false)).toBe(true); // negative scoring
    expect(set).toHaveBeenCalledWith("cmi.core.score.raw", "0");
  });
});

describe("KukuiBridge.RecordInteraction", () => {
  beforeEach(() => {
    __resetBridgeForTest(window);
  });
  afterEach(() => {
    __resetBridgeForTest(window);
  });

  it("returns false and logs in preview mode (no pipwerks)", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const bridge = attachBridge(window);
    const ok = bridge.RecordInteraction(
      JSON.stringify({
        id: "test:abc:q1",
        type: "choice",
        studentResponse: "a",
        result: { kind: "correct" },
      }),
    );
    expect(ok).toBe(false);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("RecordInteraction"));
    spy.mockRestore();
  });

  it("writes cmi.interactions.0.* via pipwerks when connected", () => {
    const set = vi.fn(() => true);
    const get = vi.fn(() => "");
    const save = vi.fn(() => true);
    const init = vi.fn(() => true);
    const quit = vi.fn(() => true);
    (window as unknown as { pipwerks: unknown }).pipwerks = {
      SCORM: { init, get, set, save, quit },
    };
    const bridge = attachBridge(window);
    const ok = bridge.RecordInteraction(
      JSON.stringify({
        id: "test:abc:q1",
        type: "choice",
        studentResponse: "a",
        correctResponse: "a",
        result: { kind: "correct" },
        weighting: 1,
        latencySeconds: 2.5,
      }),
    );
    expect(ok).toBe(true);
    expect(set).toHaveBeenCalledWith("cmi.interactions.0.id", "test:abc:q1");
    expect(set).toHaveBeenCalledWith("cmi.interactions.0.type", "choice");
    expect(set).toHaveBeenCalledWith("cmi.interactions.0.student_response", "a");
    expect(set).toHaveBeenCalledWith("cmi.interactions.0.result", "correct");
    expect(set).toHaveBeenCalledWith("cmi.interactions.0.latency", "0000:00:02.50");
    expect(save).toHaveBeenCalled();

    // Second call must increment to cmi.interactions.1.* — guards against an
    // accidental reset of `interactionIndex` inside the write block, which
    // would silently overwrite the prior interaction.
    const ok2 = bridge.RecordInteraction(
      JSON.stringify({
        id: "test:abc:q2",
        type: "choice",
        studentResponse: "b",
        result: { kind: "wrong" },
      }),
    );
    expect(ok2).toBe(true);
    expect(set).toHaveBeenCalledWith("cmi.interactions.1.id", "test:abc:q2");
  });

  it("returns false on invalid JSON without throwing", () => {
    (window as unknown as { pipwerks: unknown }).pipwerks = {
      SCORM: {
        init: () => true,
        get: () => "",
        set: () => true,
        save: () => true,
        quit: () => true,
      },
    };
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bridge = attachBridge(window);
    const ok = bridge.RecordInteraction("not-json");
    expect(ok).toBe(false);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("rejects malformed records before any cmi.* write", () => {
    const set = vi.fn(() => true);
    const save = vi.fn(() => true);
    (window as unknown as { pipwerks: unknown }).pipwerks = {
      SCORM: { init: () => true, get: () => "", set, save, quit: () => true },
    };
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bridge = attachBridge(window);

    const base = {
      id: "test:abc:q1",
      type: "choice",
      studentResponse: "a",
      result: { kind: "correct" },
    };
    const bad = [
      { ...base, id: 42 }, // id not a string
      { ...base, studentResponse: ["a"] }, // studentResponse not a string
      { ...base, result: { kind: "amazing" } }, // unknown result kind
      { ...base, result: "correct" }, // result not an object
      { ...base, result: { kind: "numeric" } }, // numeric without a value
      { ...base, weighting: "2" }, // weighting not a number
      "null", // not an object at all
    ];
    for (const record of bad) {
      const json = typeof record === "string" ? record : JSON.stringify(record);
      expect(bridge.RecordInteraction(json)).toBe(false);
    }
    expect(set).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();

    // The same base record without the bad field is accepted — the guard
    // rejects the malformed field, not the shape in general.
    expect(bridge.RecordInteraction(JSON.stringify(base))).toBe(true);
    expect(set).toHaveBeenCalledWith("cmi.interactions.0.id", "test:abc:q1");
    errSpy.mockRestore();
  });

  it("truncates an over-length id with a plain slice (no ellipsis — id is a CMIIdentifier)", () => {
    const set = vi.fn(() => true);
    (window as unknown as { pipwerks: unknown }).pipwerks = {
      SCORM: { init: () => true, get: () => "", set, save: () => true, quit: () => true },
    };
    const bridge = attachBridge(window);
    const ok = bridge.RecordInteraction(
      JSON.stringify({
        id: "x".repeat(300),
        type: "fill-in",
        studentResponse: "y".repeat(300),
        result: { kind: "neutral" },
      }),
    );
    expect(ok).toBe(true);
    const idCall = set.mock.calls.find((c) => c[0] === "cmi.interactions.0.id");
    const responseCall = set.mock.calls.find((c) => c[0] === "cmi.interactions.0.student_response");
    expect(idCall?.[1]).toBe("x".repeat(255));
    expect(responseCall?.[1]).toHaveLength(255);
    expect((responseCall?.[1] as string).endsWith("…")).toBe(true);
  });
});
