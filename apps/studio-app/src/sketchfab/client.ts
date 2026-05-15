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
 * collaborators by parameter. SKETCHFAB_CLIENT_ID is intentionally NOT
 * imported here; callers pass the Client ID explicitly via
 * AuthorizeUrlOptions, which keeps this module trivially testable.
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
