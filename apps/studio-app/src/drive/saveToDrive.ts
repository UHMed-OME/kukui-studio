import { requestDriveToken } from "./auth.js";

/**
 * Upload a JSON activity to the user's Google Drive.
 *
 * Always creates a new file (we don't track previous Drive file IDs
 * yet — Save-As semantics, not Save). Returns the new file's metadata
 * so the caller can flash a success toast that links to the file.
 *
 * Uses Drive REST API v3's multipart upload — single request that
 * carries both metadata (filename, mime) and the file body. The token
 * is fetched via requestDriveToken; the user sees the OAuth popup the
 * first time they use the feature.
 *
 * MIME is `application/json`. Google Drive happily stores arbitrary
 * MIME; we don't claim `application/vnd.google-apps.document` (that
 * triggers conversion to Docs, which would mangle our JSON).
 */

export interface DriveFileMeta {
  id: string;
  name: string;
  webViewLink?: string;
}

const UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink";

export async function saveJsonToDrive(
  filename: string,
  json: string,
): Promise<DriveFileMeta> {
  const token = await requestDriveToken();

  // Multipart body: a metadata part (application/json) + the file
  // content part. RFC 2046 multipart with a hand-rolled boundary,
  // because the Drive API's multipart upload format predates
  // browser-native FormData multipart conventions and rejects
  // multipart/form-data.
  const boundary = `kukui-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const metadata = {
    name: filename,
    mimeType: "application/json",
  };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${json}\r\n` +
    `--${boundary}--`;

  const resp = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `Drive upload failed (${resp.status}): ${text.slice(0, 200) || resp.statusText}`,
    );
  }
  return (await resp.json()) as DriveFileMeta;
}
