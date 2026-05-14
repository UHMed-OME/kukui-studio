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

  it("SaveSuspendData warns and truncates above 4096-char cap", () => {
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
    b.SaveSuspendData(huge);
    expect(warn).toHaveBeenCalled();
    const written = (set.mock.calls.find((c) => c[0] === "cmi.suspend_data") ?? [])[1] as
      | string
      | undefined;
    expect(written?.length).toBe(4096);
    warn.mockRestore();
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
});
