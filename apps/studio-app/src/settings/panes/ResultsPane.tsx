import { useState } from "react";
import { decodeCompletionCode, scorePercent, type CompletionPayload } from "@kukui/core";
import { ACTIVITY_LABELS } from "../../starters.js";
import type { ActivityKind } from "@kukui/core";

/**
 * Instructor-side reader for the completion codes learners get from a
 * non-LMS "web" package (see apps/studio-app/src/content/docs/host-on-the-web.md
 * — the "Host on the web" page in Studio's Docs). Paste the code, see
 * the decoded score. Purely local — nothing is sent anywhere — and, like the
 * codes themselves, self-reported, so it's for formative use only.
 */
export function ResultsPane() {
  const [code, setCode] = useState("");
  const [decoded, setDecoded] = useState<CompletionPayload | null>(null);
  const [error, setError] = useState(false);

  const read = () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setDecoded(null);
      setError(false);
      return;
    }
    const result = decodeCompletionCode(trimmed);
    setDecoded(result ?? null);
    setError(!result);
  };

  return (
    <div className="ks-settings-pane ks-settings-pane--prose">
      <p>
        Paste a <strong>completion code</strong> a learner sent you from a web
        package to see their score. Codes are self-reported, so use them for
        low-stakes, formative work, not graded assessment.
      </p>

      <label htmlFor="ks-completion-code" style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
        Completion code
      </label>
      <textarea
        id="ks-completion-code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={3}
        spellCheck={false}
        style={{
          width: "100%",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 13,
          padding: 10,
          borderRadius: 8,
          border: "1px solid var(--color-border, #dad2c6)",
          resize: "vertical",
        }}
      />
      <button
        type="button"
        className="kukui-studio-btn kukui-studio-btn--primary kukui-studio-btn--sm"
        onClick={read}
        style={{ marginTop: 8 }}
      >
        Read code
      </button>

      {error ? (
        <p role="alert" style={{ marginTop: 12, color: "var(--color-error, #c34132)" }}>
          That doesn't look like a valid completion code. Check that the whole
          code was copied.
        </p>
      ) : null}

      {decoded ? (
        <dl style={resultGridStyle}>
          <dt style={dtStyle}>Activity</dt>
          <dd style={ddStyle}>
            {decoded.t || ACTIVITY_LABELS[decoded.k as ActivityKind] || decoded.k}
          </dd>

          <dt style={dtStyle}>Score</dt>
          <dd style={ddStyle}>
            {scorePercent(decoded.r, decoded.m)}% ({decoded.r}/{decoded.m}) ·{" "}
            {decoded.p ? "Passed" : "Not yet passed"}
          </dd>

          {decoded.n ? (
            <>
              <dt style={dtStyle}>Name</dt>
              <dd style={ddStyle}>{decoded.n}</dd>
            </>
          ) : null}

          {decoded.at ? (
            <>
              <dt style={dtStyle}>Finished</dt>
              <dd style={ddStyle}>{formatDate(decoded.at)}</dd>
            </>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

const resultGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: "6px 16px",
  marginTop: 16,
  padding: 14,
  border: "1px solid var(--color-border, #dad2c6)",
  borderRadius: 10,
  background: "var(--color-surface-sunken, #f6f1e9)",
};

const dtStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 13,
  color: "var(--color-text-secondary, #606069)",
};

const ddStyle: React.CSSProperties = { margin: 0, fontSize: 14 };
