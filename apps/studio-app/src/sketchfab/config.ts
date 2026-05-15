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
