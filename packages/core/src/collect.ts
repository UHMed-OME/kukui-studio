/**
 * Results-collection wiring for the non-LMS "web" distribution.
 *
 * Web mode has no LMS to post grades to, so a host who wants to *collect*
 * results (rather than just let the learner see them) opts into one or more
 * backend-free channels. This is a deployment-time concern — set on the page
 * by whoever packages/hosts the activity — not authored activity content, so
 * the per-activity schemas stay untouched.
 *
 * All channels are forgeable by design (there is no server verifying the
 * learner), so web mode is positioned as formative / low-stakes; SCORM stays
 * the path for graded work.
 */
export interface CollectConfig {
  /** "Email my results" opens the learner's mail client addressed here. */
  email?: string;
  /** On completion, POST the results JSON to this URL (author-supplied). */
  webhook?: string;
  /** External form link (e.g. a Google Form) shown as "Open the form". */
  formUrl?: string;
}

const HTTPS_RE = /^https:\/\//i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parse a `data-collect` attribute (a JSON object string) into a validated
 * CollectConfig. Unknown shapes, non-https webhooks/forms, and malformed
 * emails are dropped silently — a misconfigured page just shows fewer
 * collection buttons rather than breaking the activity. Returns undefined
 * when nothing valid is present.
 */
export function parseCollectConfig(raw: string | null | undefined): CollectConfig | undefined {
  if (!raw) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object") return undefined;
  const obj = parsed as Record<string, unknown>;
  const out: CollectConfig = {};
  if (typeof obj.email === "string" && EMAIL_RE.test(obj.email)) out.email = obj.email;
  if (typeof obj.webhook === "string" && HTTPS_RE.test(obj.webhook)) out.webhook = obj.webhook;
  if (typeof obj.formUrl === "string" && HTTPS_RE.test(obj.formUrl)) out.formUrl = obj.formUrl;
  return out.email || out.webhook || out.formUrl ? out : undefined;
}
