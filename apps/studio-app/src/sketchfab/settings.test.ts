import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadSketchfabToken,
  saveSketchfabToken,
  clearSketchfabToken,
  type SketchfabToken,
} from "./settings.js";

const TOKEN_FIXTURE: SketchfabToken = {
  accessToken: "fake-token-abc123",
  expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  scope: "read",
  storage: "session",
};

describe("Sketchfab token storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("returns null when nothing has been saved", () => {
    expect(loadSketchfabToken()).toBeNull();
  });

  it("round-trips a session token through sessionStorage", () => {
    saveSketchfabToken(TOKEN_FIXTURE);
    expect(loadSketchfabToken()).toEqual(TOKEN_FIXTURE);
    expect(window.sessionStorage.getItem("kukui:studio:sketchfab-token")).not.toBeNull();
    expect(window.localStorage.getItem("kukui:studio:sketchfab-token")).toBeNull();
  });

  it("round-trips a local token through localStorage", () => {
    const local: SketchfabToken = { ...TOKEN_FIXTURE, storage: "local" };
    saveSketchfabToken(local);
    expect(loadSketchfabToken()).toEqual(local);
    expect(window.localStorage.getItem("kukui:studio:sketchfab-token")).not.toBeNull();
    expect(window.sessionStorage.getItem("kukui:studio:sketchfab-token")).toBeNull();
  });

  it("switching from local to session wipes the local copy", () => {
    saveSketchfabToken({ ...TOKEN_FIXTURE, storage: "local" });
    saveSketchfabToken({ ...TOKEN_FIXTURE, storage: "session" });
    expect(window.localStorage.getItem("kukui:studio:sketchfab-token")).toBeNull();
    expect(window.sessionStorage.getItem("kukui:studio:sketchfab-token")).not.toBeNull();
  });

  it("clearSketchfabToken wipes both storages", () => {
    saveSketchfabToken({ ...TOKEN_FIXTURE, storage: "local" });
    saveSketchfabToken({ ...TOKEN_FIXTURE, storage: "session" });
    clearSketchfabToken();
    expect(loadSketchfabToken()).toBeNull();
    expect(window.localStorage.getItem("kukui:studio:sketchfab-token")).toBeNull();
    expect(window.sessionStorage.getItem("kukui:studio:sketchfab-token")).toBeNull();
  });

  it("returns null for an expired token without writing anything", () => {
    const expired: SketchfabToken = { ...TOKEN_FIXTURE, expiresAt: Date.now() - 1000 };
    saveSketchfabToken(expired);
    expect(loadSketchfabToken()).toBeNull();
  });

  it("ignores corrupted JSON gracefully", () => {
    window.sessionStorage.setItem("kukui:studio:sketchfab-token", "{not-json");
    expect(loadSketchfabToken()).toBeNull();
  });
});
