import { useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import type { WidgetProps } from "@rjsf/utils";

/**
 * RJSF widget for fields that hold a media URL.
 *
 * Accepts both a paste-a-URL flow (typed text) and an upload flow (drop or
 * pick a file). On upload, the file is read into a data URL and stored
 * inline in the field — that way it round-trips through the existing
 * localStorage drafts and SCORM-zip download without any asset-store
 * plumbing. Trade-off: very large files bloat the JSON. The widget shows
 * the file size after upload so authors can spot anything obviously wrong.
 *
 * `ui:options` knobs:
 *   accept      — comma-separated MIME / extension list. Default "image/*".
 *   maxSizeMb   — soft cap. Files above this trigger a warning before upload.
 *                 Defaults to 5 (matches localStorage's per-origin budget).
 *   kind        — "image" | "model" | "audio" | "any"; controls the preview.
 */
export function FileUploadWidget(props: WidgetProps) {
  const { value, onChange, options, id, disabled, readonly } = props;
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragHover, setDragHover] = useState(false);

  const accept = typeof options?.accept === "string" ? options.accept : "image/*";
  const maxSizeMb = typeof options?.maxSizeMb === "number" ? options.maxSizeMb : 5;
  const kind = (typeof options?.kind === "string" ? options.kind : "image") as
    | "image"
    | "model"
    | "audio"
    | "any";

  const handleFile = (file: File | undefined | null) => {
    if (!file) return;
    setError(null);
    const sizeMb = file.size / 1024 / 1024;
    if (sizeMb > maxSizeMb) {
      setError(
        `File is ${sizeMb.toFixed(1)} MB; over the ${maxSizeMb} MB cap. Drafts won't persist; SCORM zip will still include it for this session.`,
      );
    }
    const reader = new FileReader();
    reader.onerror = () => setError("Could not read the file.");
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onChange(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    // Allow re-picking the same file after a clear.
    e.target.value = "";
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragHover(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const clear = () => {
    onChange("");
    setError(null);
  };

  const valueStr = typeof value === "string" ? value : "";
  const isData = valueStr.startsWith("data:");
  const isHttp = /^https?:\/\//.test(valueStr);
  const sizeKb = isData ? Math.round((valueStr.length * 0.75) / 1024) : null;

  return (
    <div
      className={["ks-file", dragHover ? "is-drophover" : ""].filter(Boolean).join(" ")}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled && !readonly) setDragHover(true);
      }}
      onDragLeave={() => setDragHover(false)}
      onDrop={onDrop}
    >
      <input
        id={id}
        type="text"
        className="ks-file__url"
        placeholder="Paste a URL (https://…) or upload below"
        value={valueStr.startsWith("data:") ? "(uploaded file)" : valueStr}
        readOnly={isData}
        onChange={(e) => {
          if (!isData) onChange(e.target.value);
        }}
        aria-label="Asset URL"
      />
      <div className="ks-file__row">
        <label htmlFor={inputId} className="ks-file__btn">
          {isData || isHttp ? "Replace…" : "Upload file"}
        </label>
        <input
          ref={fileRef}
          id={inputId}
          type="file"
          accept={accept}
          onChange={onPick}
          disabled={disabled || readonly}
          className="ks-file__input"
        />
        {valueStr ? (
          <button type="button" className="ks-file__clear" onClick={clear}>
            Clear
          </button>
        ) : null}
        {sizeKb !== null ? (
          <span className="ks-file__size">📎 {sizeKb.toLocaleString()} KB inline</span>
        ) : null}
        {!valueStr ? (
          <span className="ks-file__hint">…or drop a file here</span>
        ) : null}
      </div>
      {error ? <p className="ks-file__err">{error}</p> : null}
      {valueStr ? <Preview kind={kind} src={valueStr} /> : null}
    </div>
  );
}

function Preview({ kind, src }: { kind: "image" | "model" | "audio" | "any"; src: string }) {
  if (kind === "image") {
    return (
      <div className="ks-file__preview">
        <img src={src} alt="" className="ks-file__preview-img" />
      </div>
    );
  }
  if (kind === "audio") {
    return (
      <div className="ks-file__preview">
        <audio src={src} controls className="ks-file__preview-audio" />
      </div>
    );
  }
  if (kind === "model") {
    return (
      <div className="ks-file__preview ks-file__preview--model">
        <span aria-hidden="true">📦</span>
        <span>3D model attached</span>
      </div>
    );
  }
  return null;
}
