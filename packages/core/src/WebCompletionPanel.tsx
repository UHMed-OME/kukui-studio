import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ScoreState } from "./types.js";
import type { WebResults } from "./scorm.js";
import type { CollectConfig } from "./collect.js";
import {
  buildPayload,
  buildResultsDocument,
  encodeCompletionCode,
  scorePercent,
} from "./web-results.js";

/**
 * Learner-facing summary shown after a web-mode (non-LMS) submission. There
 * is no gradebook here, so this panel IS the record: it states the score,
 * confirms progress is saved on the device, and offers backend-free ways to
 * hand results back to an instructor — a copy-paste completion code, a JSON
 * download, and (when the host opted in) a mailto / webhook / external form.
 *
 * Accessibility: announced via aria-live, score is never conveyed by colour
 * alone (icon + words + percentage), buttons meet the 44px target, and state
 * changes recolour in place without reflowing neighbours.
 */
export type WebCompletionPanelProps = {
  score: ScoreState;
  kind: string;
  title?: string;
  collect?: CollectConfig;
  getResults?: () => WebResults | undefined;
};

export function WebCompletionPanel({
  score,
  kind,
  title,
  collect,
  getResults,
}: WebCompletionPanelProps) {
  const results = getResults?.();
  const percent = scorePercent(score.raw, score.max);
  const code = encodeCompletionCode(buildPayload(kind, title, score, results));
  const passed = score.success;

  return (
    <section style={panelStyle} aria-live="polite" aria-label="Activity results">
      <h2 style={headingStyle}>Activity complete</h2>

      <div style={scoreRowStyle}>
        <span aria-hidden="true" style={badgeStyle(passed)}>
          {passed ? "✓" : "—"}
        </span>
        <span style={scoreTextStyle}>
          <strong style={{ fontSize: 20 }}>{percent}%</strong>
          {" · "}
          {passed ? "Passed" : "Keep practicing"}
        </span>
      </div>

      <p style={noteStyle}>
        Your progress is saved in this browser, so you can close this page and
        come back on the same device.
      </p>

      <CollectionSection
        code={code}
        score={score}
        kind={kind}
        title={title}
        results={results}
        collect={collect}
      />
    </section>
  );
}

function CollectionSection({
  code,
  score,
  kind,
  title,
  results,
  collect,
}: {
  code: string;
  score: ScoreState;
  kind: string;
  title?: string;
  results?: WebResults;
  collect?: CollectConfig;
}) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / permissions) — the field is
      // selectable, so the learner can still copy by hand.
      setCopied(false);
    }
  };

  const downloadJson = () => {
    const doc = buildResultsDocument(kind, title, score, results);
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(title) || kind}-results.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={collectStyle}>
      <p style={collectIntroStyle}>Share your results with your instructor:</p>

      <label style={codeLabelStyle} htmlFor="kukui-completion-code">
        Completion code
      </label>
      <div style={codeRowStyle}>
        <input
          id="kukui-completion-code"
          readOnly
          value={code}
          onFocus={(e) => e.currentTarget.select()}
          style={codeInputStyle}
        />
        <button type="button" onClick={copyCode} style={buttonStyle} aria-live="polite">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div style={buttonRowStyle}>
        <button type="button" onClick={downloadJson} style={buttonStyle}>
          Download results (JSON)
        </button>

        {collect?.email ? (
          <a
            href={mailtoHref(collect.email, kind, title, score)}
            style={{ ...buttonStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
          >
            Email my results
          </a>
        ) : null}

        {collect?.formUrl ? (
          <a
            href={collect.formUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...buttonStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
          >
            Open the form
          </a>
        ) : null}
      </div>

      {collect?.webhook ? (
        <WebhookSender
          webhook={collect.webhook}
          kind={kind}
          title={title}
          score={score}
          results={results}
        />
      ) : null}
    </div>
  );
}

/**
 * Fires a single POST of the results JSON to an author-supplied endpoint on
 * mount, with a manual retry. The endpoint must send CORS headers; a network
 * rejection (including CORS failure) surfaces as "couldn't send" with retry.
 */
function WebhookSender({
  webhook,
  kind,
  title,
  score,
  results,
}: {
  webhook: string;
  kind: string;
  title?: string;
  score: ScoreState;
  results?: WebResults;
}) {
  const [status, setStatus] = useState<"sending" | "sent" | "error">("sending");
  const sentRef = useRef(false);

  const send = () => {
    setStatus("sending");
    const doc = buildResultsDocument(kind, title, score, results);
    fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(doc),
    })
      .then((res) => setStatus(res.ok ? "sent" : "error"))
      .catch(() => setStatus("error"));
  };

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    send();
    // Intentionally fire once on mount; retry is manual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <p style={webhookStatusStyle} aria-live="polite">
      {status === "sending" ? "Sending your results…" : null}
      {status === "sent" ? "✓ Results sent to your instructor." : null}
      {status === "error" ? (
        <>
          <span aria-hidden="true">⚠ </span>
          Couldn't send your results automatically.{" "}
          <button type="button" onClick={send} style={linkButtonStyle}>
            Try again
          </button>
        </>
      ) : null}
    </p>
  );
}

function mailtoHref(email: string, kind: string, title: string | undefined, score: ScoreState): string {
  const subject = `Kukui results: ${title || kind}`;
  const percent = scorePercent(score.raw, score.max);
  const body = [
    `Activity: ${title || kind}`,
    `Score: ${percent}% (${score.raw}/${score.max})`,
    `Result: ${score.success ? "Passed" : "Not yet passed"}`,
  ].join("\n");
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function slugify(s: string | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ── Styles ────────────────────────────────────────────────────────────────
// Inline styles using engine CSS variables with hex fallbacks, matching the
// approach in activity-host.tsx so the panel themes with the activity.

const panelStyle: CSSProperties = {
  maxWidth: 720,
  margin: "16px auto",
  padding: 24,
  background: "var(--color-surface, #ffffff)",
  border: "1px solid var(--color-border, #dad2c6)",
  borderRadius: 12,
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: "var(--font-size-title, 22px)",
  color: "var(--color-text-primary, #1c1e20)",
};

const scoreRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginTop: 12,
};

function badgeStyle(passed: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: "50%",
    fontSize: 20,
    fontWeight: 700,
    color: "#ffffff",
    background: passed ? "var(--color-success, #2e6e41)" : "var(--color-text-secondary, #606069)",
  };
}

const scoreTextStyle: CSSProperties = {
  fontSize: 16,
  color: "var(--color-text-primary, #1c1e20)",
};

const noteStyle: CSSProperties = {
  marginTop: 12,
  marginBottom: 0,
  fontSize: 13,
  color: "var(--color-text-secondary, #606069)",
  lineHeight: 1.5,
};

const collectStyle: CSSProperties = {
  marginTop: 20,
  paddingTop: 16,
  borderTop: "1px solid var(--color-border, #dad2c6)",
};

const collectIntroStyle: CSSProperties = {
  margin: "0 0 10px",
  fontSize: 14,
  fontWeight: 600,
  color: "var(--color-text-primary, #1c1e20)",
};

const codeLabelStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--color-text-secondary, #606069)",
  marginBottom: 4,
};

const codeRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "stretch",
};

const codeInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: 44,
  padding: "8px 12px",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 13,
  color: "var(--color-text-primary, #1c1e20)",
  background: "var(--color-bg, #fcf8f2)",
  border: "1px solid var(--color-border, #dad2c6)",
  borderRadius: 8,
};

const buttonStyle: CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 600,
  color: "var(--color-text-primary, #1c1e20)",
  background: "var(--color-surface, #ffffff)",
  border: "1px solid var(--color-border, #dad2c6)",
  borderRadius: 8,
  cursor: "pointer",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 12,
};

const webhookStatusStyle: CSSProperties = {
  marginTop: 12,
  marginBottom: 0,
  fontSize: 13,
  color: "var(--color-text-secondary, #606069)",
};

const linkButtonStyle: CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  font: "inherit",
  color: "var(--color-primary, #7b4324)",
  textDecoration: "underline",
  cursor: "pointer",
};
