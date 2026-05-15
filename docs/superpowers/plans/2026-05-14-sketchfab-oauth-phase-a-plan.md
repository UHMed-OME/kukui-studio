# Sketchfab OAuth — Phase A Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-05-13-sketchfab-oauth-registration.md`](../specs/2026-05-13-sketchfab-oauth-registration.md)

**Goal:** Stand up the Sketchfab OAuth integration scaffolding (config, token storage, OAuth client, IndexedDB model cache, React hook, callback route, ConnectionsPane settings wiring, dev-mode mock). No Hotspot 3D Editor wiring — that's Phase B.

**Architecture:** Mirrors the Google Drive integration's pattern:
- Public Client ID injected at build time via `VITE_SKETCHFAB_CLIENT_ID` (sourced from `SKETCHFAB_CLIENT_ID` GHA secret); ships in the bundle, protected by Sketchfab's server-side redirect URI binding.
- Implicit OAuth grant: browser redirects to Sketchfab → user authorizes → Sketchfab redirects to `/auth/sketchfab/callback#access_token=...` → callback page parses the fragment, stores the token via settings module, redirects back to the pre-auth URL.
- Token storage mirrors `apps/studio-app/src/ai/settings.ts` shape — author picks `local` (localStorage) or `session` (sessionStorage). Default session, given Sketchfab tokens are OAuth Bearers.
- Model cache: IndexedDB blob store keyed by Sketchfab UID. Signed download URLs expire in minutes, but the `.glb` body persists.
- **No Client Secret anywhere in the build pipeline.** Implicit grant doesn't use it; Secret stays offline (1Password) as a contingency artifact.

**Tech Stack:** TypeScript 5.7 strict, React 19, React Router 7, Vitest 3, pnpm workspaces. Vite 6 for build-time env var inlining.

**Branch:** `feat/sketchfab-oauth-phase-a` — single PR.

**Non-code parallel ask (do alongside the work, not blocking):** Reply to the Sketchfab support ticket asking for `http://localhost:5174/auth/sketchfab/callback` as a second authorized redirect URI for local development. The dev-mode mock (Task 10) is a fallback that lets us proceed without it, but having both gives a smoother dev workflow.

---

### Task 1: Add `VITE_SKETCHFAB_CLIENT_ID` to build pipeline + env example

**Files:**
- Modify: `.github/workflows/pages.yml`
- Modify: `apps/studio-app/.env.example`

- [ ] **Step 1: Add the env var to the Pages workflow**

In `.github/workflows/pages.yml`, find the "Build Studio" step's `env:` block (currently has `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY`, `VITE_GOOGLE_APP_ID`). Add:

```yaml
          # Sketchfab integration. Optional — when the secret isn't set,
          # the Sketchfab UI hides itself client-side. Public OAuth Client
          # ID, safe to ship in the bundle; protected by Sketchfab's
          # redirect URI binding (configured at
          # https://kukuistudio.com/auth/sketchfab/callback). The Sketchfab
          # Client Secret is intentionally NOT injected — Implicit grant
          # doesn't use it, and shipping it would defeat the purpose.
          VITE_SKETCHFAB_CLIENT_ID: ${{ secrets.SKETCHFAB_CLIENT_ID }}
```

Place it after `VITE_GOOGLE_APP_ID` and before `run: pnpm --filter @kukui/studio-app build`.

- [ ] **Step 2: Document in `.env.example`**

Append to `apps/studio-app/.env.example`:

```
# Sketchfab integration (optional).
#
# When set, the Studio shows OAuth-aware Sketchfab controls in the 3D
# Hotspot editor's AttributionPanel. When unset, the legacy manual URL
# input is shown (or hidden entirely; TBD in Phase B).
#
# Local dev: copy this file to `.env.local` (gitignored) and fill in.
# Production (GitHub Pages): SKETCHFAB_CLIENT_ID is set as a repository
# secret; the Pages workflow exports it with the VITE_ prefix at build
# time so Vite inlines the value into the bundle.
#
# Setup (one-time):
#   1. File a support ticket at https://support.fab.com/s/ to register
#      an OAuth app. Use grant type "Implicit", application name "Kukui
#      Studio", redirect URI "https://kukuistudio.com/auth/sketchfab/callback".
#   2. Sketchfab returns a Client ID and Client Secret. Only the Client
#      ID is used. The Secret stays offline (1Password) — Implicit grant
#      doesn't use it, and shipping it would be a security regression.
#   3. Copy the Client ID below (or add as a repo secret named
#      SKETCHFAB_CLIENT_ID in production).

VITE_SKETCHFAB_CLIENT_ID=
```

- [ ] **Step 3: Verify Drive section above is untouched**

Run: `git diff apps/studio-app/.env.example .github/workflows/pages.yml`
Confirm only additions, no modifications to existing Drive section.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/pages.yml apps/studio-app/.env.example
git commit -m "feat(sketchfab): wire VITE_SKETCHFAB_CLIENT_ID into Pages build"
```

---

### Task 2: Create `apps/studio-app/src/sketchfab/config.ts`

**Files:**
- Create: `apps/studio-app/src/sketchfab/config.ts`

- [ ] **Step 1: Create the config module**

```ts
/**
 * Sketchfab integration config.
 *
 * Values come from Vite env vars at build time:
 *   - VITE_SKETCHFAB_CLIENT_ID — OAuth Client ID from the Sketchfab
 *     developer portal. Public; safe to ship in the bundle. Required
 *     for any Sketchfab feature; if absent, the UI hides the controls.
 *
 * The Sketchfab Client Secret is deliberately NOT a Vite env var.
 * Implicit grant doesn't use it, and any value ending up in the bundle
 * would be a security regression. Server-side flows (Authorization
 * Code) would need a Cloudflare Worker BFF — see the spec.
 */

const env = (import.meta as unknown as { env?: Record<string, string | undefined> })
  .env ?? {};

export const SKETCHFAB_CLIENT_ID =
  typeof env.VITE_SKETCHFAB_CLIENT_ID === "string"
    ? env.VITE_SKETCHFAB_CLIENT_ID
    : "";

/**
 * Sketchfab's authorize endpoint for Implicit grant. Includes
 * `response_type=token` so the access token comes back in the redirect
 * URL fragment rather than as a code requiring a server-side exchange.
 */
export const SKETCHFAB_AUTHORIZE_URL = "https://sketchfab.com/oauth2/authorize/";

/**
 * Sketchfab's v3 API base. Used by client.ts for model metadata and
 * download endpoint calls once a token is in hand.
 */
export const SKETCHFAB_API_BASE = "https://api.sketchfab.com/v3";

/**
 * The single redirect URI registered with Sketchfab. Build the URL
 * relative to the current origin so dev (localhost), prod (kukuistudio.com),
 * and any future self-hosted institution mirror can each use their own
 * origin without code changes — Sketchfab only enforces an exact match
 * for the registered URI, so production is what matters for security.
 */
export const sketchfabRedirectUri = (): string =>
  `${window.location.origin}/auth/sketchfab/callback`;

/**
 * True when SKETCHFAB_CLIENT_ID is set — the only state in which the
 * Sketchfab UI should appear. Dev environments without a configured
 * Client ID just don't see the feature, same as Drive.
 */
export const sketchfabEnabled = (): boolean =>
  SKETCHFAB_CLIENT_ID.length > 0;
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/studio-app/src/sketchfab/config.ts
git commit -m "feat(sketchfab): config module reading VITE_SKETCHFAB_CLIENT_ID"
```

---

### Task 3: Create `apps/studio-app/src/sketchfab/settings.ts` (token storage) + tests

**Files:**
- Create: `apps/studio-app/src/sketchfab/settings.ts`
- Create: `apps/studio-app/src/sketchfab/settings.test.ts`

Token storage mirrors the AI Assist pattern (`local` / `session` choice). Default is `session` because Sketchfab tokens are OAuth Bearers — the Drive precedent (in-memory only) is the stricter ceiling, but Sketchfab tokens have a 30-day TTL and forcing re-auth every tab close is too painful for the UX. Session-by-default lands between the two; users opting into `local` get persistence with the XSS risk acknowledged.

- [ ] **Step 1: Write the failing tests**

Create `apps/studio-app/src/sketchfab/settings.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test apps/studio-app/src/sketchfab/settings.test.ts`
Expected: FAIL — `Cannot find module './settings.js'`.

- [ ] **Step 3: Implement `settings.ts`**

```ts
/**
 * Typed read/write of `kukui:studio:sketchfab-token`.
 *
 * The Sketchfab OAuth access token (Implicit grant, ~30 day TTL) lives
 * either in sessionStorage (this-session-only, the default and
 * conservative choice) or localStorage (persists across tab close, user
 * opt-in). The author picks via the Sketchfab section in the
 * ConnectionsPane.
 *
 * The token never leaves the browser — there is no backend to send it
 * to. Sketchfab's per-Bearer scope is read-only metadata + signed
 * download URLs, so the XSS blast radius is "attacker can browse the
 * user's Sketchfab library" rather than full-Drive-level data exposure
 * (which is why Drive deliberately doesn't persist its token at all).
 */

const KEY = "kukui:studio:sketchfab-token";
const MAX_BYTES = 8 * 1024;

export type SketchfabStorage = "local" | "session";

export type SketchfabToken = {
  /** OAuth Implicit grant access token. */
  accessToken: string;
  /** Unix ms when Sketchfab says this token expires. */
  expiresAt: number;
  /** Space-separated OAuth scopes, as returned by Sketchfab. */
  scope: string;
  /** Which browser storage this token lives in. */
  storage: SketchfabStorage;
};

function isSketchfabToken(v: unknown): v is SketchfabToken {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.accessToken === "string" &&
    typeof o.expiresAt === "number" &&
    typeof o.scope === "string" &&
    (o.storage === "local" || o.storage === "session")
  );
}

function pickStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    if (window.sessionStorage.getItem(KEY) != null) return window.sessionStorage;
    if (window.localStorage.getItem(KEY) != null) return window.localStorage;
    return null;
  } catch {
    return null;
  }
}

/**
 * Load the current token, returning null if absent, malformed, or
 * expired. Does NOT clear expired tokens — that's a separate concern
 * the caller can handle via `clearSketchfabToken()`.
 */
export function loadSketchfabToken(): SketchfabToken | null {
  const storage = pickStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    if (raw.length > MAX_BYTES) {
      console.warn(`[kukui:studio:sketchfab] token record > ${MAX_BYTES} bytes; ignoring.`);
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isSketchfabToken(parsed)) return null;
    if (Date.now() >= parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Save the token to whichever storage `next.storage` names, wiping the
 * other storage first to avoid stale copies. Mirrors AI settings'
 * "user explicitly chose session, don't leak to local" hygiene.
 */
export function saveSketchfabToken(next: SketchfabToken): void {
  if (typeof window === "undefined") return;
  try {
    const target = next.storage === "session" ? window.sessionStorage : window.localStorage;
    const other = next.storage === "session" ? window.localStorage : window.sessionStorage;
    other.removeItem(KEY);
    target.setItem(KEY, JSON.stringify(next));
  } catch (err) {
    const name = err instanceof Error ? err.name : "Error";
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[kukui:studio:sketchfab] failed to save token: ${name}: ${message}`);
  }
}

/** Drop the token from both storages. Used by sign-out. */
export function clearSketchfabToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test apps/studio-app/src/sketchfab/settings.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/studio-app/src/sketchfab/settings.ts apps/studio-app/src/sketchfab/settings.test.ts
git commit -m "feat(sketchfab): token storage with local/session opt-in"
```

---

### Task 4: Create `apps/studio-app/src/sketchfab/client.ts` (OAuth + API) + tests

**Files:**
- Create: `apps/studio-app/src/sketchfab/client.ts`
- Create: `apps/studio-app/src/sketchfab/client.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/studio-app/src/sketchfab/client.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test apps/studio-app/src/sketchfab/client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `client.ts`**

```ts
/**
 * Sketchfab OAuth client (Implicit grant) and v3 API surface.
 *
 * - `buildAuthorizeUrl` constructs the redirect URL that kicks off the
 *   OAuth flow. The browser navigates to this URL; Sketchfab handles
 *   user consent and redirects back to our `/auth/sketchfab/callback`
 *   page with the access token in the URL fragment.
 * - `parseAuthCallback` decodes the fragment into a typed result.
 * - `extractModelUid` normalises various Sketchfab model URLs to the
 *   32-char hex UID the API expects.
 * - `fetchModelMetadata` / `fetchModelDownloadUrls` are thin wrappers
 *   around v3 endpoints; tested via integration once a token exists.
 *
 * No global side effects — every function is pure or takes its
 * collaborators by parameter.
 */

import { SKETCHFAB_API_BASE, SKETCHFAB_AUTHORIZE_URL } from "./config.js";

export type AuthorizeUrlOptions = {
  clientId: string;
  redirectUri: string;
  /** Random nonce for CSRF protection; verified on callback. */
  state: string;
};

export function buildAuthorizeUrl(opts: AuthorizeUrlOptions): string {
  const url = new URL(SKETCHFAB_AUTHORIZE_URL);
  url.searchParams.set("response_type", "token");
  url.searchParams.set("client_id", opts.clientId);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("state", opts.state);
  return url.toString();
}

export type AuthCallbackOk = {
  kind: "ok";
  accessToken: string;
  expiresInSeconds: number;
  scope: string;
  state: string;
};

export type AuthCallbackError = {
  kind: "error";
  message: string;
};

export type AuthCallbackResult = AuthCallbackOk | AuthCallbackError;

/**
 * Parse the URL fragment that Sketchfab includes on its redirect back
 * to our callback page. Implicit grant puts the token in the fragment
 * (not query string) so it never hits a server log.
 */
export function parseAuthCallback(fragment: string): AuthCallbackResult {
  if (!fragment) return { kind: "error", message: "empty callback fragment" };
  const cleaned = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  if (!cleaned) return { kind: "error", message: "empty callback fragment" };
  const params = new URLSearchParams(cleaned);
  const error = params.get("error");
  if (error) {
    const desc = params.get("error_description") ?? "";
    return { kind: "error", message: `${error}${desc ? `: ${desc}` : ""}` };
  }
  const accessToken = params.get("access_token");
  if (!accessToken) {
    return { kind: "error", message: "no access_token in callback fragment" };
  }
  const expiresInRaw = params.get("expires_in");
  const expiresInSeconds = expiresInRaw ? Number.parseInt(expiresInRaw, 10) : 0;
  const scope = params.get("scope") ?? "";
  const state = params.get("state") ?? "";
  return {
    kind: "ok",
    accessToken,
    expiresInSeconds: Number.isFinite(expiresInSeconds) ? expiresInSeconds : 0,
    scope,
    state,
  };
}

const UID_REGEX = /[a-f0-9]{32}/i;

/**
 * Coerce a Sketchfab URL or bare UID to the 32-char hex UID used by
 * the v3 API. Returns null if no UID-shaped substring is present.
 */
export function extractModelUid(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Bare 32-char hex.
  if (/^[a-f0-9]{32}$/i.test(trimmed)) return trimmed.toLowerCase();
  // Anything containing a 32-char hex substring (URLs of any form).
  const m = trimmed.match(UID_REGEX);
  if (m) return m[0].toLowerCase();
  return null;
}

export type SketchfabLicense = {
  slug: string;
  label: string;
  url: string;
};

export type SketchfabModelMetadata = {
  uid: string;
  name: string;
  author: { username: string; profileUrl: string };
  viewerUrl: string;
  license: SketchfabLicense | null;
  isDownloadable: boolean;
};

/** GET /v3/models/{uid} */
export async function fetchModelMetadata(
  uid: string,
  accessToken: string,
): Promise<SketchfabModelMetadata> {
  const res = await fetch(`${SKETCHFAB_API_BASE}/models/${uid}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Sketchfab metadata fetch failed: ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as unknown;
  return parseMetadata(body);
}

/** GET /v3/models/{uid}/download */
export async function fetchModelDownloadUrls(
  uid: string,
  accessToken: string,
): Promise<{ glb?: string; gltf?: string }> {
  const res = await fetch(`${SKETCHFAB_API_BASE}/models/${uid}/download`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Sketchfab download fetch failed: ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as unknown;
  if (!body || typeof body !== "object") {
    throw new Error("Sketchfab download response was not an object");
  }
  const obj = body as Record<string, unknown>;
  const glbUrl = (obj.glb as { url?: string } | undefined)?.url;
  const gltfUrl = (obj.gltf as { url?: string } | undefined)?.url;
  return { glb: glbUrl, gltf: gltfUrl };
}

function parseMetadata(body: unknown): SketchfabModelMetadata {
  if (!body || typeof body !== "object") {
    throw new Error("Sketchfab metadata response was not an object");
  }
  const o = body as Record<string, unknown>;
  const uid = typeof o.uid === "string" ? o.uid : "";
  const name = typeof o.name === "string" ? o.name : "(untitled)";
  const userObj = (o.user ?? {}) as Record<string, unknown>;
  const author = {
    username: typeof userObj.username === "string" ? userObj.username : "",
    profileUrl: typeof userObj.profileUrl === "string" ? userObj.profileUrl : "",
  };
  const viewerUrl = typeof o.viewerUrl === "string" ? o.viewerUrl : "";
  const isDownloadable = Boolean(o.isDownloadable);
  const licenseObj = o.license as Record<string, unknown> | null | undefined;
  const license: SketchfabLicense | null = licenseObj
    ? {
        slug: typeof licenseObj.slug === "string" ? licenseObj.slug : "",
        label: typeof licenseObj.label === "string" ? licenseObj.label : "",
        url: typeof licenseObj.url === "string" ? licenseObj.url : "",
      }
    : null;
  return { uid, name, author, viewerUrl, license, isDownloadable };
}
```

Note: `SKETCHFAB_CLIENT_ID` is intentionally NOT imported here — `client.ts` is value-neutral and takes the Client ID as a parameter (`AuthorizeUrlOptions.clientId`). The hook (`useSketchfabAuth`) is where `SKETCHFAB_CLIENT_ID` gets read and passed through. Keeps `client.ts` testable without needing to stub the env var.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test apps/studio-app/src/sketchfab/client.test.ts`
Expected: PASS, all `buildAuthorizeUrl`, `parseAuthCallback`, `extractModelUid` tests green. (The `fetchModel*` functions are integration-only and aren't unit-tested here — they get smoke-tested in Phase B against the real Sketchfab API.)

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/studio-app/src/sketchfab/client.ts apps/studio-app/src/sketchfab/client.test.ts
git commit -m "feat(sketchfab): OAuth Implicit grant client + v3 API wrappers"
```

---

### Task 5: Create `apps/studio-app/src/sketchfab/modelCache.ts` (IndexedDB) + tests

**Files:**
- Create: `apps/studio-app/src/sketchfab/modelCache.ts`
- Create: `apps/studio-app/src/sketchfab/modelCache.test.ts`

IndexedDB-backed blob store for `.glb` bodies, keyed by Sketchfab UID. The signed download URLs Sketchfab issues are short-lived (~minutes); the `.glb` body itself doesn't change, so we cache it after the first download. Cache persists across sessions and is cleared via the Sketchfab section in ConnectionsPane.

- [ ] **Step 1: Write the failing tests**

Create `apps/studio-app/src/sketchfab/modelCache.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import {
  cacheModelBlob,
  loadCachedModelBlob,
  clearAllCachedModels,
  cachedModelCount,
} from "./modelCache.js";

const UID = "a1b2c3d4e5f67890abcdef1234567890";
const UID_TWO = "0000111122223333444455556666777";

function makeBlob(): Blob {
  return new Blob([new Uint8Array([0x67, 0x6c, 0x54, 0x46])], {
    type: "model/gltf-binary",
  });
}

describe("Sketchfab model cache", () => {
  beforeEach(async () => {
    await clearAllCachedModels();
  });
  afterEach(async () => {
    await clearAllCachedModels();
  });

  it("returns null for an uncached UID", async () => {
    expect(await loadCachedModelBlob(UID)).toBeNull();
  });

  it("round-trips a blob through cacheModelBlob → loadCachedModelBlob", async () => {
    const blob = makeBlob();
    await cacheModelBlob(UID, blob);
    const out = await loadCachedModelBlob(UID);
    expect(out).not.toBeNull();
    expect(out?.size).toBe(blob.size);
    expect(out?.type).toBe("model/gltf-binary");
  });

  it("overwrites an existing cached blob for the same UID", async () => {
    await cacheModelBlob(UID, new Blob(["small"]));
    await cacheModelBlob(UID, new Blob(["replaced with longer body"]));
    const out = await loadCachedModelBlob(UID);
    expect(out?.size).toBe("replaced with longer body".length);
  });

  it("tracks count across multiple UIDs", async () => {
    expect(await cachedModelCount()).toBe(0);
    await cacheModelBlob(UID, makeBlob());
    await cacheModelBlob(UID_TWO, makeBlob());
    expect(await cachedModelCount()).toBe(2);
  });

  it("clearAllCachedModels empties the store", async () => {
    await cacheModelBlob(UID, makeBlob());
    await cacheModelBlob(UID_TWO, makeBlob());
    await clearAllCachedModels();
    expect(await cachedModelCount()).toBe(0);
    expect(await loadCachedModelBlob(UID)).toBeNull();
  });
});
```

Note: the tests use `fake-indexeddb/auto` which polyfills IndexedDB in the Node/jsdom test environment. Confirm `fake-indexeddb` is in `package.json` devDependencies; if not, install it before running:

```bash
pnpm add -D -w fake-indexeddb
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test apps/studio-app/src/sketchfab/modelCache.test.ts`
Expected: FAIL — module not found (or `fake-indexeddb` missing if not installed).

- [ ] **Step 3: Implement `modelCache.ts`**

```ts
/**
 * IndexedDB blob store for Sketchfab `.glb` model bodies.
 *
 * Sketchfab signed download URLs expire in minutes; the binary body
 * doesn't. After the first download we stash the Blob keyed by
 * Sketchfab UID so subsequent loads of the same activity don't hit
 * Sketchfab again. Cache survives tab close (IndexedDB is persistent);
 * users can clear it via the Sketchfab section in ConnectionsPane.
 *
 * Single object store, no indexes — UID → Blob. Schema upgrades from
 * here should add a new store version, not mutate the existing one.
 */

const DB_NAME = "kukui-sketchfab";
const DB_VERSION = 1;
const STORE = "models";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const out = fn(store);
      tx.oncomplete = () => Promise.resolve(out).then(resolve, reject);
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB tx failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB tx aborted"));
    });
  } finally {
    db.close();
  }
}

export async function cacheModelBlob(uid: string, blob: Blob): Promise<void> {
  await withStore("readwrite", (store) => {
    store.put(blob, uid);
  });
}

export function loadCachedModelBlob(uid: string): Promise<Blob | null> {
  return withStore("readonly", (store) => {
    return new Promise<Blob | null>((resolve, reject) => {
      const req = store.get(uid);
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB get failed"));
    });
  });
}

export function cachedModelCount(): Promise<number> {
  return withStore("readonly", (store) => {
    return new Promise<number>((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB count failed"));
    });
  });
}

export function clearAllCachedModels(): Promise<void> {
  return withStore("readwrite", (store) => {
    return new Promise<void>((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error("IndexedDB clear failed"));
    });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test apps/studio-app/src/sketchfab/modelCache.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/studio-app/src/sketchfab/modelCache.ts apps/studio-app/src/sketchfab/modelCache.test.ts
git commit -m "feat(sketchfab): IndexedDB blob cache for downloaded .glb bodies"
```

(If `fake-indexeddb` had to be added in Step 1, include the lockfile and `package.json` changes in the same commit.)

---

### Task 6: Create `apps/studio-app/src/sketchfab/useSketchfabAuth.ts` (React hook)

**Files:**
- Create: `apps/studio-app/src/sketchfab/useSketchfabAuth.ts`

- [ ] **Step 1: Implement the hook**

```ts
import { useCallback, useEffect, useState } from "react";
import { sketchfabEnabled, sketchfabRedirectUri, SKETCHFAB_CLIENT_ID } from "./config.js";
import { buildAuthorizeUrl } from "./client.js";
import {
  clearSketchfabToken,
  loadSketchfabToken,
  type SketchfabToken,
} from "./settings.js";

export type SketchfabAuthStatus =
  | "disabled" // SKETCHFAB_CLIENT_ID not set (env var missing)
  | "signed-out"
  | "signed-in";

export type UseSketchfabAuth = {
  status: SketchfabAuthStatus;
  token: SketchfabToken | null;
  /** Kick off the OAuth flow. `returnTo` is where to land after callback. */
  signIn: (returnTo?: string) => void;
  signOut: () => void;
};

const STATE_KEY = "kukui:sketchfab:oauth-state";
const RETURN_TO_KEY = "kukui:sketchfab:return-to";

function generateState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function useSketchfabAuth(): UseSketchfabAuth {
  const [token, setToken] = useState<SketchfabToken | null>(() => loadSketchfabToken());

  // Refresh when another tab signs in/out — storage event fires
  // cross-tab on localStorage writes, and on focus catches the within-
  // tab callback round-trip after `/auth/sketchfab/callback` saves.
  useEffect(() => {
    const refresh = () => setToken(loadSketchfabToken());
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const signIn = useCallback((returnTo?: string) => {
    if (!sketchfabEnabled()) return;
    const state = generateState();
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(RETURN_TO_KEY, returnTo ?? window.location.pathname + window.location.search);
    window.location.assign(
      buildAuthorizeUrl({
        clientId: SKETCHFAB_CLIENT_ID,
        redirectUri: sketchfabRedirectUri(),
        state,
      }),
    );
  }, []);

  const signOut = useCallback(() => {
    clearSketchfabToken();
    setToken(null);
  }, []);

  const status: SketchfabAuthStatus = !sketchfabEnabled()
    ? "disabled"
    : token
    ? "signed-in"
    : "signed-out";

  return { status, token, signIn, signOut };
}

export { STATE_KEY as __SKETCHFAB_STATE_KEY, RETURN_TO_KEY as __SKETCHFAB_RETURN_TO_KEY };
```

The trailing `__SKETCHFAB_*` re-exports let the callback page read the same storage keys without us redefining them.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/studio-app/src/sketchfab/useSketchfabAuth.ts
git commit -m "feat(sketchfab): useSketchfabAuth hook (signIn/signOut/status)"
```

---

### Task 7: Create `apps/studio-app/src/pages/AuthCallback.tsx`

**Files:**
- Create: `apps/studio-app/src/pages/AuthCallback.tsx`

- [ ] **Step 1: Implement the callback page**

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseAuthCallback } from "../sketchfab/client.js";
import { saveSketchfabToken } from "../sketchfab/settings.js";
import {
  __SKETCHFAB_STATE_KEY,
  __SKETCHFAB_RETURN_TO_KEY,
} from "../sketchfab/useSketchfabAuth.js";

type Status =
  | { kind: "processing" }
  | { kind: "error"; message: string };

/**
 * Sketchfab Implicit grant callback handler.
 *
 * Sketchfab redirects here with the access token in the URL fragment:
 *   /auth/sketchfab/callback#access_token=...&expires_in=...&state=...
 *
 * We:
 *   1. Parse the fragment.
 *   2. Verify the state nonce matches what we stashed before redirect
 *      (CSRF defence).
 *   3. Save the token via the settings module.
 *   4. Strip the fragment from history (so a back-navigation doesn't
 *      re-parse stale state).
 *   5. Redirect to whatever URL the user was on before signing in.
 */
export function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>({ kind: "processing" });

  useEffect(() => {
    const result = parseAuthCallback(window.location.hash);
    if (result.kind === "error") {
      setStatus({ kind: "error", message: result.message });
      return;
    }
    const expectedState = sessionStorage.getItem(__SKETCHFAB_STATE_KEY);
    sessionStorage.removeItem(__SKETCHFAB_STATE_KEY);
    if (!expectedState || result.state !== expectedState) {
      setStatus({
        kind: "error",
        message: "State mismatch — possible CSRF. Sign-in aborted.",
      });
      return;
    }
    // Default storage choice: session (more conservative than local).
    // The ConnectionsPane offers a "remember on this device" toggle that
    // re-saves with `storage: "local"` once the user is signed in.
    saveSketchfabToken({
      accessToken: result.accessToken,
      expiresAt: Date.now() + result.expiresInSeconds * 1000,
      scope: result.scope,
      storage: "session",
    });
    // Strip the fragment so it doesn't linger in history / bookmarks.
    window.history.replaceState(null, "", window.location.pathname);
    const returnTo = sessionStorage.getItem(__SKETCHFAB_RETURN_TO_KEY) ?? "/studio";
    sessionStorage.removeItem(__SKETCHFAB_RETURN_TO_KEY);
    navigate(returnTo, { replace: true });
  }, [navigate]);

  if (status.kind === "error") {
    return (
      <div role="alert" style={{ maxWidth: 480, margin: "80px auto", padding: 24 }}>
        <h1 style={{ marginTop: 0 }}>Sketchfab sign-in failed</h1>
        <p>{status.message}</p>
        <p>
          <a href="/studio">Return to Studio</a>
        </p>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" style={{ maxWidth: 480, margin: "80px auto", padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Finishing Sketchfab sign-in…</h1>
      <p>This usually takes less than a second.</p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/studio-app/src/pages/AuthCallback.tsx
git commit -m "feat(sketchfab): /auth/sketchfab/callback route handler"
```

---

### Task 8: Register the callback route in `main.tsx`

**Files:**
- Modify: `apps/studio-app/src/main.tsx`

- [ ] **Step 1: Add the import**

In `apps/studio-app/src/main.tsx`, near the other page imports, add:

```tsx
import { AuthCallback } from "./pages/AuthCallback.js";
```

- [ ] **Step 2: Add the route**

Inside the `<Routes>` block, add the new route between `/privacy` and the wildcard `*`:

```tsx
          <Route path="/auth/sketchfab/callback" element={<AuthCallback />} />
```

So the routes block becomes:

```tsx
          <Route path="/" element={<Landing />} />
          <Route path="/studio" element={<App />} />
          <Route path="/docs" element={<DocsLayout />}>
            <Route index element={<DocsIndex />} />
            <Route path=":slug" element={<DocPage />} />
          </Route>
          <Route path="/blog" element={<BlogIndex />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/auth/sketchfab/callback" element={<AuthCallback />} />
          <Route path="*" element={<Navigate to="/" replace />} />
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Run the full test suite**

Run: `pnpm test`
Expected: PASS — no regressions.

- [ ] **Step 5: Commit**

```bash
git add apps/studio-app/src/main.tsx
git commit -m "feat(sketchfab): register /auth/sketchfab/callback route"
```

---

### Task 9: Add Sketchfab section to `ConnectionsPane.tsx`

**Files:**
- Modify: `apps/studio-app/src/settings/panes/ConnectionsPane.tsx`

The existing pane already groups AI Assist + Google Drive. Add a Sketchfab section after Drive with sign-in/sign-out, storage preference, and cache-clear affordances.

- [ ] **Step 1: Add imports + new section**

Read the existing `ConnectionsPane.tsx` to confirm structure. Add the new section after the Drive `<section>`, following the same shape:

```tsx
import { useSketchfabAuth } from "../../sketchfab/useSketchfabAuth.js";
import { sketchfabEnabled } from "../../sketchfab/config.js";
import {
  clearAllCachedModels,
  cachedModelCount,
} from "../../sketchfab/modelCache.js";
import {
  loadSketchfabToken,
  saveSketchfabToken,
  type SketchfabStorage,
} from "../../sketchfab/settings.js";
```

Add a new `<section>` to the returned JSX after the Drive section:

```tsx
      <section className="ks-connections-section">
        <h3 className="ks-connections-section__title">Sketchfab</h3>
        <SketchfabSection />
      </section>
```

Then implement `SketchfabSection` below `DriveSection`:

```tsx
function SketchfabSection() {
  const { status, token, signIn, signOut } = useSketchfabAuth();
  const [cacheCount, setCacheCount] = useState<number | null>(null);
  const [storage, setStorage] = useState<SketchfabStorage>(token?.storage ?? "session");

  useEffect(() => {
    cachedModelCount().then(setCacheCount).catch(() => setCacheCount(null));
  }, [token]);

  useEffect(() => {
    setStorage(token?.storage ?? "session");
  }, [token]);

  if (status === "disabled") {
    return (
      <p className="ks-dialog__message">
        Sketchfab integration isn't configured for this deployment. Ask
        your administrator to set the{" "}
        <code className="ks-ai-form__code">VITE_SKETCHFAB_CLIENT_ID</code>{" "}
        build-time variable.
      </p>
    );
  }

  const handleStorageChange = (next: SketchfabStorage) => {
    setStorage(next);
    const current = loadSketchfabToken();
    if (current) {
      saveSketchfabToken({ ...current, storage: next });
    }
  };

  const handleClearCache = async () => {
    await clearAllCachedModels();
    setCacheCount(0);
  };

  return (
    <>
      <p className="ks-dialog__message">
        Sign in to Sketchfab to import your Creative Commons–licensed 3D
        models into 3D Hotspot activities. Kukui only requests the
        minimum-scope read token; we never upload anything to Sketchfab
        and never see your private library.
      </p>
      <dl className="ks-connections-status">
        <dt>Status</dt>
        <dd>
          {status === "signed-in"
            ? `Signed in (token expires ${token ? new Date(token.expiresAt).toLocaleDateString() : "—"})`
            : "Not signed in"}
        </dd>
        <dt>Cached models</dt>
        <dd>{cacheCount ?? "—"}</dd>
      </dl>
      {status === "signed-in" ? (
        <fieldset className="ks-connections-fieldset">
          <legend>Remember sign-in</legend>
          <label>
            <input
              type="radio"
              name="sketchfab-storage"
              value="session"
              checked={storage === "session"}
              onChange={() => handleStorageChange("session")}
            />{" "}
            This session only (cleared on tab close)
          </label>
          <label>
            <input
              type="radio"
              name="sketchfab-storage"
              value="local"
              checked={storage === "local"}
              onChange={() => handleStorageChange("local")}
            />{" "}
            On this device (persists until token expires or you sign out)
          </label>
        </fieldset>
      ) : null}
      <div className="ks-settings-pane__actions">
        {status === "signed-in" ? (
          <>
            <button
              type="button"
              className="kukui-studio-btn kukui-studio-btn--ghost"
              onClick={handleClearCache}
              disabled={(cacheCount ?? 0) === 0}
              title="Drop every cached .glb body. Models will re-download on next use."
            >
              Clear model cache
            </button>
            <button
              type="button"
              className="kukui-studio-btn kukui-studio-btn--ghost"
              onClick={signOut}
            >
              Sign out of Sketchfab
            </button>
          </>
        ) : (
          <button
            type="button"
            className="kukui-studio-btn kukui-studio-btn--primary"
            onClick={() => signIn()}
            disabled={!sketchfabEnabled()}
          >
            Sign in to Sketchfab
          </button>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Manual smoke (no test) — open Settings dialog**

Run: `pnpm dev:studio`
Open the Studio in a browser, open Settings → Connections, confirm:
- "Sketchfab" section appears below Google Drive
- When `VITE_SKETCHFAB_CLIENT_ID` is unset, the "isn't configured" message shows
- When it's set (use `.env.local` for dev), the "Sign in to Sketchfab" button appears
- Clicking "Sign in" navigates away to Sketchfab (in production / with a registered redirect URI; will 400 in dev unless Task 10's mock is wired or you've registered a localhost redirect URI)

- [ ] **Step 4: Commit**

```bash
git add apps/studio-app/src/settings/panes/ConnectionsPane.tsx
git commit -m "feat(sketchfab): Sketchfab section in Connections settings pane"
```

---

### Task 10: Dev-mode mock — paste-token affordance when `import.meta.env.DEV`

**Files:**
- Modify: `apps/studio-app/src/settings/panes/ConnectionsPane.tsx`

The single registered redirect URI is production-only, so local development can't complete a real OAuth flow until Sketchfab adds a localhost redirect URI. As a fallback, expose a dev-only "Paste token" affordance that bypasses the redirect and writes a token directly. Guarded by `import.meta.env.DEV` so it never ships to production.

- [ ] **Step 1: Add the dev-only paste-token block**

Inside `SketchfabSection`, after the `<div className="ks-settings-pane__actions">` block but inside the outer `<>`, add:

```tsx
      {import.meta.env.DEV && status !== "signed-in" ? (
        <details className="ks-connections-dev-affordance" style={{ marginTop: 12 }}>
          <summary>Dev only — paste a token manually</summary>
          <p className="ks-dialog__message">
            Local dev can't complete a real OAuth flow until Sketchfab
            adds <code>http://localhost:5174/auth/sketchfab/callback</code> as
            a second redirect URI. In the meantime, generate a token
            against production (sign in at kukuistudio.com once, copy
            the token from sessionStorage) and paste it here to test the
            signed-in code paths without leaving localhost.
          </p>
          <DevPasteToken />
        </details>
      ) : null}
```

Then define `DevPasteToken` outside the main component:

```tsx
function DevPasteToken() {
  const [value, setValue] = useState("");
  const [days, setDays] = useState("30");

  const handleSave = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const dayCount = Math.max(1, Math.min(60, Number.parseInt(days, 10) || 30));
    saveSketchfabToken({
      accessToken: trimmed,
      expiresAt: Date.now() + dayCount * 24 * 60 * 60 * 1000,
      scope: "read",
      storage: "session",
    });
    setValue("");
    window.dispatchEvent(new Event("storage")); // nudge useSketchfabAuth
  };

  return (
    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
      <label>
        Access token
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          style={{ display: "block", width: "100%", fontFamily: "monospace" }}
        />
      </label>
      <label>
        Expires in (days)
        <input
          type="number"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          min={1}
          max={60}
          style={{ width: 80 }}
        />
      </label>
      <button
        type="button"
        className="kukui-studio-btn kukui-studio-btn--primary"
        onClick={handleSave}
        disabled={!value.trim()}
      >
        Save dev token
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Verify production guard**

Run: `pnpm build` and grep the built bundle:

```bash
pnpm --filter @kukui/studio-app build && \
grep -c "Paste a token manually" apps/studio-app/dist/assets/*.js
```

Expected: `0` (zero matches). Vite's dead-code elimination drops the `import.meta.env.DEV` branch in production builds, so the dev affordance string shouldn't appear in the production bundle. If it does, that's a real concern — the gate isn't working.

- [ ] **Step 4: Commit**

```bash
git add apps/studio-app/src/settings/panes/ConnectionsPane.tsx
git commit -m "feat(sketchfab): dev-mode paste-token affordance for local testing"
```

---

### Task 11: Add docs page — `/docs/sketchfab`

**Files:**
- Create: `apps/studio-app/src/pages/docs/content/sketchfab.md` (or wherever existing docs content lives — verify with `ls apps/studio-app/src/pages/docs/`)
- Modify: the docs index/registry (TBD by Task 11 implementer based on existing pattern — look at how `privacy` docs are registered, or the existing DocsIndex.tsx for the list shape)

- [ ] **Step 1: Look at the existing docs structure**

Run: `ls apps/studio-app/src/pages/docs/ && cat apps/studio-app/src/pages/docs/DocsIndex.tsx | head -40`

Confirm the existing pattern for adding a doc page. The implementer should match it exactly — don't invent a new pattern.

- [ ] **Step 2: Add the Sketchfab docs page**

Following the existing pattern, create a markdown / TSX doc covering:

- What the Sketchfab integration does (sign in, paste a model URL, import into 3D Hotspot activities)
- Which Creative Commons licenses are supported (CC-BY, CC-BY-SA, CC-BY-NC, CC0; not CC-BY-ND or proprietary)
- How the token is stored (session vs local) and what XSS risks each implies
- How to sign out + clear the model cache
- Privacy note: the Sketchfab Bearer never leaves the browser; Kukui has no backend

- [ ] **Step 3: Manual smoke**

`pnpm dev:studio`, navigate to `/docs/sketchfab`, confirm the page renders.

- [ ] **Step 4: Commit**

```bash
git add <doc files>
git commit -m "docs(sketchfab): explain sign-in flow + supported CC licenses"
```

---

### Task 12: Final integration smoke + PR

**Files:** none — verification only.

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: PASS. Note the test count delta from baseline (Phase A SCORM left it at 443 / 46 files; this Phase A adds roughly 7 settings + 4 client + 5 modelCache = 16 new unit tests, plus possibly some indirect deltas).

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: SUCCESS. Confirm no new chunk-size warnings introduced by the Sketchfab module (`pnpm build` output for `apps/studio-app/build` should mention a new chunk or growth in the studio entry).

- [ ] **Step 4: Verify production bundle excludes the dev affordance**

```bash
grep -c "Paste a token manually" apps/studio-app/dist/assets/*.js
```

Expected: `0`. (Same as Task 10 Step 3, run again post-build to catch any regression.)

- [ ] **Step 5: Verify production bundle DOES contain the Client ID string**

```bash
grep -c "VITE_SKETCHFAB_CLIENT_ID" apps/studio-app/dist/assets/*.js
```

Expected: `0` (the env var name isn't in the bundle; the value replaces it). And:

```bash
# Confirm the actual value is present — replace XXXX with the prefix of
# your SKETCHFAB_CLIENT_ID. Don't paste the full ID into shell history.
grep -c '"<first-6-chars-of-client-id>' apps/studio-app/dist/assets/*.js
```

Expected: ≥ 1. (If the GHA secret isn't set in local dev, this will be 0 — that's expected; just confirm it's >0 in a CI build.)

- [ ] **Step 6: Manual end-to-end (production-like)**

Easiest path: push the branch, let GitHub Pages deploy to a preview (or to kukuistudio.com after merge), then:

1. Open https://kukuistudio.com/studio
2. Settings → Connections → Sign in to Sketchfab
3. Confirm the redirect goes to `https://sketchfab.com/oauth2/authorize/?response_type=token&client_id=…&redirect_uri=https%3A%2F%2Fkukuistudio.com%2Fauth%2Fsketchfab%2Fcallback&state=…`
4. After authorizing, confirm you land back on `/auth/sketchfab/callback`, the fragment is stripped, and you're redirected to `/studio`
5. Settings → Connections shows "Signed in"
6. Sign out → confirm the token is cleared

Don't merge before this manual smoke succeeds — Phase B (Hotspot editor wiring) assumes a working auth flow.

- [ ] **Step 7: Open PR**

```bash
git push -u origin feat/sketchfab-oauth-phase-a
/Users/Jesse/bin/gh pr create --title "feat: Sketchfab OAuth — Phase A scaffolding" \
  --body "$(cat <<'EOF'
## Summary
- Sketchfab OAuth Implicit grant scaffolding — config, token storage (session/local opt-in), v3 API client, IndexedDB blob cache, React hook, `/auth/sketchfab/callback` route, Sketchfab section in Connections settings pane, dev-mode paste-token affordance for local testing
- Wires `VITE_SKETCHFAB_CLIENT_ID` through GHA secrets → Pages workflow → bundle. **No** Client Secret in the build pipeline (Implicit grant doesn't need it; stored offline only)
- No Hotspot 3D Editor changes — that's Phase B

Spec: docs/superpowers/specs/2026-05-13-sketchfab-oauth-registration.md
Plan: docs/superpowers/plans/2026-05-14-sketchfab-oauth-phase-a-plan.md

## Behavioural impact
- New Sketchfab section in Settings → Connections (shows "not configured" until the deployment has the env var)
- New `/auth/sketchfab/callback` page (the only one users will hit during real flows)
- Zero change to existing editor / activity behaviour

## Test plan
- [ ] `pnpm test` clean (16 new unit tests)
- [ ] `pnpm typecheck` clean
- [ ] `pnpm build` clean; dev affordance excluded from prod bundle
- [ ] Manual: end-to-end OAuth round-trip against production after merge
- [ ] Manual: dev-mode paste-token works on localhost

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Phase B preview (scope only — gets its own plan)

After Phase A merges:

1. Replace `Hotspot3DEditor.tsx`'s `AttributionPanel` manual "Sketchfab URL" field with the OAuth-aware flow:
   - Not signed in → "Sign in to Sketchfab" button (calls `signIn(/* current editor URL */)`)
   - Signed in → URL input + "Load model" button
2. On Load: `extractModelUid(url)` → `fetchModelMetadata(uid, token)` → license check (reject ND-licensed models, warn on NC for non-medical-ed use) → `fetchModelDownloadUrls(uid, token)` → `fetch(glbUrl)` → `cacheModelBlob(uid, blob)` → `URL.createObjectURL(blob)` → set `model.src` to the blob URL + fill `model.attribution` from metadata
3. Persist the blob URL into the activity config? No — blob URLs are per-page-load. The config stores the Sketchfab UID + attribution; the runtime re-loads from cache (or re-fetches if cache miss) on activity load. This means the SCORM-packaged activity needs to either ship the `.glb` body or fetch on load; the SCORM packaging step needs a new hook to embed cached blobs.
4. SCORM packaging: when an activity references a Sketchfab UID, the pack step pulls the cached blob from IndexedDB (or refuses to pack if not cached) and embeds it as `assets/<uid>.glb`. The activity config's `model.src` rewrites to the local path at pack time.

Phase B is approximately 1 day of focused work plus an iteration cycle on license-handling edge cases. The plan doc will follow this one once Phase A is in.
