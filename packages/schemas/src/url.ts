import { z } from "zod";

/**
 * Schema for media URLs (image / audio / video / 3D model `src` fields) that
 * end up in `<img src>`, `<audio src>`, `<video src>`, or 3D model loaders.
 *
 * Allows:
 *   - https?:// — absolute http or https URLs (CDN-hosted media, sample
 *     placeholders, glTF assets pinned to GitHub raw, etc.)
 *   - data:image/, data:audio/, data:video/ — inline payloads, used by
 *     audio-recording for the learner's own clip and by chip thumbnails
 *   - relative paths inside the SCORM package — the bundle ships media
 *     under e.g. `images/...`, `audio/...`, `scenes/...`. These must not
 *     contain `..` traversals or characters outside the safe path set.
 *
 * Rejects anything else: `javascript:`, `vbscript:`, protocol-relative
 * `//evil.com/...`, file:, blob:, et al. A pasted attacker URL like
 * `http://attacker.example/x.png` is still technically allowed (we can't
 * reject all http URLs without breaking the placeholder use-case), but
 * scheme-based injection vectors are closed.
 */
export const SAFE_MEDIA_URL = z
  .string()
  .min(1)
  .refine(
    (v) =>
      /^https?:\/\//i.test(v) ||
      /^data:(image|audio|video)\//i.test(v) ||
      // relative paths inside the SCORM package — letters, digits, `_`,
      // `-`, `.`, `/`. No traversals, no schemes, no whitespace, and no
      // leading `/`: package media is always relative, and a leading slash
      // would let protocol-relative `//evil.com/x.png` slip through.
      (/^[a-z0-9_\-./]+$/i.test(v) && !v.includes("..") && !v.startsWith("/")),
    {
      message:
        "Must be an https URL, a data: URL for image/audio/video, or a relative path inside the SCORM package.",
    },
  );
