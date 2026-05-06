import { useEffect, useState } from "react";

/**
 * Raw-JSON fallback editor. The form tab is the primary path; this catches
 * everything RJSF can't express (discriminated unions in Course
 * Presentation elements, etc.). The textarea always reflects the current
 * draft; clicking Apply runs JSON.parse and bubbles the result up.
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
    <div className="ks-json">
      <textarea
        className="ks-json__textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        aria-label="Raw JSON for the active activity"
      />
      <div className="ks-json__bar">
        <button type="button" onClick={apply} className="ks-json__apply">
          Apply JSON
        </button>
        {error ? (
          <span className="ks-json__msg ks-json__msg--err">{error}</span>
        ) : (
          <span className="ks-json__msg">
            Edits aren't live — click Apply to feed them into the form + preview.
          </span>
        )}
      </div>
    </div>
  );
}
