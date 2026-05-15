import { describe, expect, it } from "vitest";
import {
  buildAuthorizeUrl,
  parseAuthCallback,
  extractModelUid,
} from "./client.js";

describe("buildAuthorizeUrl", () => {
  it("builds the Sketchfab authorize URL with token response_type", () => {
    const url = buildAuthorizeUrl({
      clientId: "test-client-id",
      redirectUri: "https://example.com/auth/sketchfab/callback",
      state: "abc123",
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://sketchfab.com/oauth2/authorize/");
    expect(parsed.searchParams.get("response_type")).toBe("token");
    expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "https://example.com/auth/sketchfab/callback",
    );
    expect(parsed.searchParams.get("state")).toBe("abc123");
  });
});

describe("parseAuthCallback", () => {
  it("extracts access_token, expires_in, scope, state from a valid fragment", () => {
    const result = parseAuthCallback(
      "#access_token=tok-xyz&expires_in=2592000&scope=read&state=abc123",
    );
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.accessToken).toBe("tok-xyz");
    expect(result.expiresInSeconds).toBe(2592000);
    expect(result.scope).toBe("read");
    expect(result.state).toBe("abc123");
  });

  it("returns error for an empty fragment", () => {
    expect(parseAuthCallback("").kind).toBe("error");
    expect(parseAuthCallback("#").kind).toBe("error");
  });

  it("returns error when Sketchfab returns ?error=access_denied", () => {
    const result = parseAuthCallback("#error=access_denied&error_description=user+cancelled");
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.message.toLowerCase()).toContain("access_denied");
  });

  it("returns error when access_token is missing", () => {
    expect(parseAuthCallback("#scope=read&state=abc").kind).toBe("error");
  });
});

describe("extractModelUid", () => {
  it("pulls the UID from a standard sketchfab.com model URL", () => {
    expect(
      extractModelUid("https://sketchfab.com/3d-models/heart-anatomy-a1b2c3d4e5f67890abcdef1234567890"),
    ).toBe("a1b2c3d4e5f67890abcdef1234567890");
  });

  it("pulls the UID from an embed URL", () => {
    expect(
      extractModelUid("https://sketchfab.com/models/a1b2c3d4e5f67890abcdef1234567890/embed"),
    ).toBe("a1b2c3d4e5f67890abcdef1234567890");
  });

  it("accepts a bare UID", () => {
    expect(extractModelUid("a1b2c3d4e5f67890abcdef1234567890")).toBe(
      "a1b2c3d4e5f67890abcdef1234567890",
    );
  });

  it("returns null for non-Sketchfab URLs", () => {
    expect(extractModelUid("https://example.com/foo")).toBeNull();
    expect(extractModelUid("not a url")).toBeNull();
    expect(extractModelUid("")).toBeNull();
  });
});
