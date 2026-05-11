/**
 * `?config=` accepts only same-origin relative paths to prevent SSRF / open
 * redirect via crafted URLs. Anything starting with a scheme, a protocol-
 * relative `//`, or an unexpected `..`-traversal is rejected. Callers fall
 * back to the HTML's `data-config` (set per-activity at build time) or the
 * per-kind default sample.
 *
 * The `..` and scheme/protocol-relative checks must run BEFORE the
 * root-relative early-return — otherwise `/../etc/passwd` would slip
 * through as "root-relative, safe."
 */
export function safeConfigParam(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.includes("..")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null; // any scheme
  if (raw.startsWith("//")) return null; // protocol-relative
  if (raw.startsWith("/")) return raw; // root-relative, safe
  // relative paths (samples/<kind>/basic.json etc.) also fine
  return raw;
}
