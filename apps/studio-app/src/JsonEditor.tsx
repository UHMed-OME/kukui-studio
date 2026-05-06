import { useEffect, useState } from "react";

/**
 * Raw-JSON fallback editor. RJSF is the primary path; this catches
 * everything RJSF can't express (discriminated unions in Course
 * Presentation elements, etc.). The textarea always reflects the current
 * form state; saving runs JSON.parse and bubbles the result up.
 */
export function JsonEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(JSON.stringify(value, null, 2));
    setError(null);
  }, [value]);

  const apply = () => {
    try {
      const parsed = JSON.parse(text);
      onChange(parsed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        style={{
          flex: 1,
          minHeight: 320,
          padding: 12,
          fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
          fontSize: 12,
          lineHeight: 1.5,
          border: "2px solid var(--color-border)",
          borderRadius: 8,
          background: "var(--color-surface)",
          resize: "vertical",
        }}
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
        <button
          type="button"
          onClick={apply}
          style={{
            minHeight: 36,
            padding: "6px 14px",
            background: "var(--color-primary)",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontWeight: 700,
          }}
        >
          Apply JSON
        </button>
        {error ? (
          <span style={{ color: "var(--color-error)", fontSize: 13 }}>{error}</span>
        ) : (
          <span style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>
            Edits are not live — click Apply to feed them into the form + preview.
          </span>
        )}
      </div>
    </div>
  );
}
