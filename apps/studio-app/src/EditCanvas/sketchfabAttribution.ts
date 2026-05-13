/**
 * Sketchfab attribution helper. Authors paste a Sketchfab model page
 * URL; we fetch its public metadata (no auth needed for public models),
 * validate the license is Creative Commons, and return a structured
 * attribution payload ready to drop into `model.attribution`.
 *
 * What we DON'T do: fetch the .glb itself. Sketchfab requires OAuth
 * for downloads even on CC-licensed models. Authors download the .glb
 * separately (Sketchfab → Download → glTF) and paste the resulting
 * direct URL into `model.src` (or upload via the file widget).
 */

export type ModelAttribution = {
  author: string;
  authorUrl?: string;
  sourceUrl?: string;
  license?: string;
  licenseUrl?: string;
};

export type SketchfabLookupResult =
  | { ok: true; attribution: ModelAttribution; downloadable: boolean }
  | { ok: false; error: string };

const SKETCHFAB_PATTERNS = [
  // https://sketchfab.com/3d-models/some-name-{uid}
  /sketchfab\.com\/3d-models\/[^/?#]*-([a-f0-9]{32})/i,
  // https://sketchfab.com/models/{uid}
  /sketchfab\.com\/models\/([a-f0-9]{32})/i,
];

/**
 * True iff `url` looks like a Sketchfab model page URL. Used by the
 * editor to decide whether to attempt a metadata lookup.
 */
export function isSketchfabUrl(url: string): boolean {
  return SKETCHFAB_PATTERNS.some((re) => re.test(url));
}

/** Extracts the UID from a Sketchfab model URL, or null if it's not one. */
export function sketchfabUid(url: string): string | null {
  for (const re of SKETCHFAB_PATTERNS) {
    const m = url.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

const CC_LICENSE_SLUGS = new Set([
  "cc0",
  "cc-by",
  "cc-by-sa",
  "cc-by-nc",
  "cc-by-nc-sa",
  "cc-by-nd",
  "cc-by-nc-nd",
]);

type SketchfabModelResponse = {
  name?: string;
  user?: {
    username?: string;
    displayName?: string;
    profileUrl?: string;
  };
  license?: {
    slug?: string;
    fullName?: string;
    label?: string;
    uri?: string;
  };
  viewerUrl?: string;
  isDownloadable?: boolean;
};

/**
 * Calls Sketchfab's public model endpoint (no auth required for
 * public models) and returns a normalized attribution payload. Caller
 * is responsible for surfacing failures to the user.
 */
export async function lookupSketchfabModel(
  url: string,
): Promise<SketchfabLookupResult> {
  const uid = sketchfabUid(url);
  if (!uid) {
    return { ok: false, error: "Doesn't look like a Sketchfab model URL." };
  }
  let res: Response;
  try {
    res = await fetch(`https://api.sketchfab.com/v3/models/${uid}`);
  } catch {
    return {
      ok: false,
      error: "Couldn't reach Sketchfab. Check your connection and try again.",
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      error:
        res.status === 404
          ? "Model not found — make sure the URL is public."
          : `Sketchfab returned ${res.status}. Try again later.`,
    };
  }
  const data = (await res.json()) as SketchfabModelResponse;
  const license = data.license;
  const slug = license?.slug?.toLowerCase();
  if (!slug || !CC_LICENSE_SLUGS.has(slug)) {
    return {
      ok: false,
      error: `License "${license?.fullName ?? license?.label ?? "unknown"}" isn't Creative Commons — use a CC-licensed model.`,
    };
  }
  const user = data.user;
  const author = user?.displayName?.trim() || user?.username?.trim();
  if (!author) {
    return {
      ok: false,
      error: "Sketchfab response missing author info; can't attribute properly.",
    };
  }
  return {
    ok: true,
    attribution: {
      author,
      authorUrl: user?.profileUrl,
      sourceUrl: data.viewerUrl ?? url,
      license: license?.fullName ?? license?.label ?? slug.toUpperCase(),
      licenseUrl: license?.uri,
    },
    downloadable: data.isDownloadable === true,
  };
}
