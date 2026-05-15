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
