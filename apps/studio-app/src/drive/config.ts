/**
 * Google Drive integration config.
 *
 * Values come from Vite env vars at build time:
 *   - VITE_GOOGLE_CLIENT_ID — OAuth 2.0 Web client ID from Google Cloud
 *     Console. Public; safe to ship in the bundle. Required for any
 *     Drive feature; if absent, the UI hides the Drive buttons.
 *   - VITE_GOOGLE_API_KEY — Browser API key from the same project.
 *     Required for the Google Picker library (it authenticates via API
 *     key, not the user token, to load its own assets).
 *
 * Scope is fixed at `drive.file` — minimum privilege. The app can only
 * read files it created OR files the user explicitly selected through
 * Google Picker. The user's broader Drive is invisible to us.
 */

const env = (import.meta as unknown as { env?: Record<string, string | undefined> })
  .env ?? {};

export const GOOGLE_CLIENT_ID =
  typeof env.VITE_GOOGLE_CLIENT_ID === "string" ? env.VITE_GOOGLE_CLIENT_ID : "";

export const GOOGLE_API_KEY =
  typeof env.VITE_GOOGLE_API_KEY === "string" ? env.VITE_GOOGLE_API_KEY : "";

/**
 * Google Cloud project number (12-digit numeric ID, NOT the project
 * ID slug). Passed to Picker via `setAppId`. With `drive.file` scope,
 * the Picker uses this to filter to files our app created — without
 * it, the dialog opens empty because Drive has no way to know which
 * app's files to surface.
 */
export const GOOGLE_APP_ID =
  typeof env.VITE_GOOGLE_APP_ID === "string" ? env.VITE_GOOGLE_APP_ID : "";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

/**
 * True when both env vars are set — the only state in which the Drive
 * buttons should appear in the UI. Dev environments without Google
 * Cloud setup just don't see the feature.
 */
export const driveEnabled = (): boolean =>
  GOOGLE_CLIENT_ID.length > 0 && GOOGLE_API_KEY.length > 0;
