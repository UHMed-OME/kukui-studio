import { useId, useState, type ChangeEvent } from "react";
import type { WidgetProps } from "@rjsf/utils";

/**
 * RJSF widget for an inline-SVG field. Authors can paste `<svg>…</svg>`
 * markup directly OR upload an `.svg` file, whose TEXT is read into the
 * field (not a data URL) so it renders through @kukui/core's SafeSvg,
 * which sanitizes scripts/handlers/foreignObject at display time.
 *
 * `ui:options`: maxSizeMb (default 1), rows (default 6).
 */
export function SvgUploadWidget(props: WidgetProps) {
  const { value, onChange, options, id, disabled, readonly } = props;
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);
  const maxSizeMb = typeof options?.maxSizeMb === "number" ? options.maxSizeMb : 1;
  const rows = typeof options?.rows === "number" ? options.rows : 6;
  const valueStr = typeof value === "string" ? value : "";

  const handleFile = (file: File | undefined | null) => {
    if (!file) return;
    setError(null);
    if (!/svg/i.test(file.type) && !/\.svg$/i.test(file.name)) {
      setError("Pick an .svg file (or paste SVG markup above).");
      return;
    }
    const sizeMb = file.size / 1024 / 1024;
    if (sizeMb > maxSizeMb) {
      setError(`SVG is ${sizeMb.toFixed(1)} MB; over the ${maxSizeMb} MB cap.`);
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setError("Could not read the file.");
    reader.onload = () => {
      if (typeof reader.result === "string") onChange(reader.result);
    };
    reader.readAsText(file);
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    e.target.value = "";
  };

  return (
    <div className="ks-file">
      <textarea
        id={id}
        className="ks-file__url ks-file__svg"
        rows={rows}
        placeholder="Paste <svg>…</svg> markup, or upload an .svg below"
        value={valueStr}
        readOnly={disabled || readonly}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Inline SVG markup"
      />
      <div className="ks-file__row">
        <label htmlFor={inputId} className="ks-file__btn">
          {valueStr ? "Replace with file…" : "Upload .svg"}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/svg+xml,.svg"
          onChange={onPick}
          disabled={disabled || readonly}
          className="ks-file__input"
        />
        {valueStr ? (
          <button type="button" className="ks-file__clear" onClick={() => onChange("")}>
            Clear
          </button>
        ) : null}
        {valueStr ? (
          <span className="ks-file__size">{valueStr.length.toLocaleString()} chars</span>
        ) : null}
      </div>
      <p className="ks-file__hint">
        Scripts and event handlers are stripped when the diagram renders.
      </p>
      {error ? <p className="ks-file__err">{error}</p> : null}
    </div>
  );
}
