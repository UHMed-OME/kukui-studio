/**
 * Filesystem-safe slug for activity titles. Lowercases, collapses any
 * non-alphanumeric run to a single dash, strips leading/trailing dashes,
 * and caps length at 60 chars so the resulting filename stays well under
 * macOS/Windows path limits.
 *
 * Returns "" for non-string inputs — callers should fall back to a
 * kind-based default (e.g. the activity kind).
 */
export function slug(s: unknown): string {
  if (typeof s !== "string") return "";
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
