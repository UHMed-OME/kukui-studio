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
