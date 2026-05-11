import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  clearSettings,
  getCachedMode,
  hasUsableSettings,
  loadSettings,
  maskKey,
  saveSettings,
  setCachedMode,
} from "./settings.js";

describe("ai/settings", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    clearSettings();
  });

  it("returns DEFAULT_SETTINGS when nothing is stored", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips settings through localStorage", () => {
    const s = {
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      apiKey: "sk-test-1234",
      storage: "local" as const,
      outputModeCache: {},
    };
    saveSettings(s);
    expect(loadSettings()).toEqual(s);
  });

  it("uses sessionStorage when storage is 'session' and wipes localStorage", () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      apiKey: "leaked-into-local",
      storage: "local",
    });
    // Now switch to session storage — old local copy must be wiped.
    saveSettings({
      baseUrl: "https://x/v1",
      model: "m",
      apiKey: "sess-key",
      storage: "session",
      outputModeCache: {},
    });
    expect(window.localStorage.getItem("kukui:studio:ai-settings")).toBeNull();
    expect(window.sessionStorage.getItem("kukui:studio:ai-settings")).not.toBeNull();
    expect(loadSettings().apiKey).toBe("sess-key");
  });

  it("clearSettings wipes both storages", () => {
    saveSettings({ ...DEFAULT_SETTINGS, apiKey: "k", baseUrl: "u", model: "m" });
    clearSettings();
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("hasUsableSettings is true only when key + baseUrl + model are set", () => {
    expect(hasUsableSettings(DEFAULT_SETTINGS)).toBe(false);
    expect(
      hasUsableSettings({ ...DEFAULT_SETTINGS, apiKey: "k", baseUrl: "u", model: "" }),
    ).toBe(false);
    expect(
      hasUsableSettings({ ...DEFAULT_SETTINGS, apiKey: "k", baseUrl: "u", model: "m" }),
    ).toBe(true);
  });

  it("maskKey only reveals last 4 chars", () => {
    expect(maskKey("")).toBe("");
    expect(maskKey("sk-abcdef1234")).toBe("••••1234");
    expect(maskKey("xy")).toBe("••");
  });

  it("output-mode cache keys on (baseUrl, model)", () => {
    const base = { ...DEFAULT_SETTINGS };
    expect(getCachedMode(base, "u", "m")).toBeNull();
    const next = setCachedMode(base, "u", "m", "json_schema");
    expect(getCachedMode(next, "u", "m")).toBe("json_schema");
    // Different model = no cache hit.
    expect(getCachedMode(next, "u", "other")).toBeNull();
  });

  it("ignores corrupted JSON without throwing", () => {
    window.localStorage.setItem("kukui:studio:ai-settings", "not-json-{");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
