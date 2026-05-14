import { GOOGLE_API_KEY } from "./config.js";
import { requestDriveToken } from "./auth.js";

/**
 * Open a Kukui activity JSON from the user's Google Drive via Google
 * Picker.
 *
 * Picker is the right tool here because:
 *   1. It only exposes files the user explicitly selects — drive.file
 *      scope then lets us read them. We never see the user's broader
 *      Drive contents.
 *   2. It's a UI Google maintains: search, breadcrumbs, recent files,
 *      shared-with-me. We'd be reinventing that poorly.
 *
 * The Picker JS API is loaded on demand via the gapi loader script.
 * Once the user picks a JSON, we download its content via the Drive
 * v3 `files/{id}?alt=media` endpoint with the Bearer token.
 */

const GAPI_SCRIPT = "https://apis.google.com/js/api.js";

let gapiScriptPromise: Promise<void> | null = null;
let pickerLoaded = false;

function loadGapi(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.gapi) return Promise.resolve();
  if (gapiScriptPromise) return gapiScriptPromise;
  gapiScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GAPI_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gapiScriptPromise = null;
      reject(new Error("Failed to load Google API loader"));
    };
    document.head.appendChild(script);
  });
  return gapiScriptPromise;
}

function loadPicker(): Promise<void> {
  return loadGapi().then(
    () =>
      new Promise<void>((resolve, reject) => {
        if (pickerLoaded) {
          resolve();
          return;
        }
        if (!window.gapi) {
          reject(new Error("gapi missing after load"));
          return;
        }
        window.gapi.load("picker", {
          callback: () => {
            pickerLoaded = true;
            resolve();
          },
          onerror: () => reject(new Error("Picker library failed to load.")),
        });
      }),
  );
}

export interface PickedFile {
  id: string;
  name: string;
}

/**
 * Show the Google Picker filtered to JSON files. Resolves with the
 * picked file metadata, or null if the user cancelled.
 */
async function showPicker(token: string): Promise<PickedFile | null> {
  await loadPicker();
  return new Promise((resolve) => {
    const picker = window.google?.picker;
    if (!picker) {
      resolve(null);
      return;
    }
    const view = new picker.DocsView(picker.ViewId.DOCS)
      .setMimeTypes("application/json")
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false);
    const built = new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY)
      .setTitle("Open a Kukui activity from Drive")
      .setCallback((data) => {
        if (data.action === picker.Action.PICKED) {
          const doc = data.docs?.[0];
          resolve(doc ? { id: doc.id, name: doc.name } : null);
        } else if (data.action === picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    built.setVisible(true);
  });
}

/**
 * End-to-end: prompt sign-in, show Picker, download the picked JSON.
 * Resolves with `{ name, json }`, or null if the user cancelled at
 * any step. Throws on network / auth failure with a human-readable
 * message.
 */
export async function openJsonFromDrive(): Promise<
  { name: string; json: string } | null
> {
  const token = await requestDriveToken();
  const picked = await showPicker(token);
  if (!picked) return null;
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(picked.id)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `Drive download failed (${resp.status}): ${text.slice(0, 200) || resp.statusText}`,
    );
  }
  const json = await resp.text();
  return { name: picked.name, json };
}
