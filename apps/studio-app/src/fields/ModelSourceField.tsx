import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import type { FieldProps } from "@rjsf/utils";
import { SketchfabImportButton } from "../sketchfab/SketchfabImportButton.js";
import type { ImportAttribution } from "../sketchfab/import.js";

/**
 * RJSF custom field for the hotspot-3d `model` object.
 *
 * Renders a 3-tab picker (Link / Upload / Sketchfab) for choosing the
 * model source — the form is the canonical place for *settings*; the
 * canvas is reserved for spatial interaction (placing pins, orbiting).
 *
 * After the picker, delegates the rest of the `model` object's
 * properties (`scale`, `attribution`) back to RJSF's default
 * SchemaField so they get the standard form treatment.
 *
 * Wiring: registered as `modelSource` in EditorForm's `fields` map and
 * applied via `ui:field: "modelSource"` on the `model` key of
 * hotspot-3d's uiSchema.
 */

type ModelSourceMode = "link" | "upload" | "sketchfab";

type ModelObject = {
  src?: string;
  sketchfabUid?: string;
  scale?: number;
  attribution?: unknown;
  [key: string]: unknown;
};

/**
 * Pull a 32-char Sketchfab UID out of any input: full Sketchfab URL,
 * embed URL, or a bare UID. Returns null when nothing matches so the
 * caller can show an inline hint.
 */
function parseSketchfabUid(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[a-f0-9]{32}$/i.test(trimmed)) return trimmed.toLowerCase();
  const match = trimmed.match(/([a-f0-9]{32})/i);
  return match?.[1] ? match[1].toLowerCase() : null;
}

function deriveMode(model: ModelObject): ModelSourceMode {
  if (model.sketchfabUid) return "sketchfab";
  if (typeof model.src === "string" && model.src.startsWith("data:")) return "upload";
  return "link";
}

export function ModelSourceField(props: FieldProps) {
  const { formData, onChange, registry, schema, uiSchema, errorSchema, idSchema } = props;
  const model = (formData ?? {}) as ModelObject;
  const derivedMode = deriveMode(model);
  const [mode, setMode] = useState<ModelSourceMode>(derivedMode);
  // Re-sync the tab when the config changes externally (AI Accept,
  // draft load, undo/redo) but the user hasn't manually picked.
  useEffect(() => {
    setMode(derivedMode);
  }, [derivedMode]);

  const linkValue =
    typeof model.src === "string" && !model.src.startsWith("data:") ? model.src : "";
  const sketchfabValue = model.sketchfabUid
    ? `https://sketchfab.com/models/${model.sketchfabUid}`
    : "";

  const writeLink = (raw: string) => {
    const trimmed = raw.trim();
    onChange({ ...model, src: trimmed || undefined, sketchfabUid: undefined });
  };
  const writeSketchfab = (raw: string) => {
    const uid = parseSketchfabUid(raw);
    onChange({ ...model, sketchfabUid: uid ?? undefined, src: undefined });
  };
  const writeUpload = (dataUrl: string) => {
    onChange({ ...model, src: dataUrl, sketchfabUid: undefined });
  };
  const writeImport = ({
    uid,
    attribution,
  }: {
    uid: string;
    attribution: ImportAttribution;
  }) => {
    onChange({
      ...model,
      sketchfabUid: uid,
      sketchfabMode: "import",
      attribution,
      src: undefined,
    });
  };

  // Delegate non-source properties (scale, attribution) back to RJSF.
  // The src/sketchfabUid pair is owned by the picker above; everything
  // else gets the default field treatment so authors don't lose
  // tooltips, validation, etc.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SchemaField = registry.fields.SchemaField as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties = (schema.properties ?? {}) as Record<string, any>;
  // sketchfabMode is managed programmatically by the import button;
  // sketchfabUid and src are owned by the tab picker above.
  // All three are excluded from the RJSF-rendered child fields.
  const childKeys = Object.keys(properties).filter(
    (k) => k !== "src" && k !== "sketchfabUid" && k !== "sketchfabMode",
  );

  const title = (uiSchema as Record<string, unknown> | undefined)?.["ui:title"];
  const help = (uiSchema as Record<string, unknown> | undefined)?.["ui:help"];

  return (
    <fieldset className="ks-model-source">
      {typeof title === "string" ? (
        <legend className="ks-model-source__legend">{title}</legend>
      ) : null}
      {typeof help === "string" ? (
        <p className="ks-model-source__help">{help}</p>
      ) : null}

      <div
        className="ks-model-source__tabs"
        role="tablist"
        aria-label="Model source type"
      >
        {(["link", "upload", "sketchfab"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={["ks-model-source__tab", mode === m ? "is-active" : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setMode(m)}
          >
            {m === "link" ? "Link" : m === "upload" ? "Upload" : "Sketchfab"}
          </button>
        ))}
      </div>

      <div className="ks-model-source__body" role="tabpanel">
        {mode === "link" ? (
          <LinkInput value={linkValue} onCommit={writeLink} />
        ) : mode === "upload" ? (
          <UploadInput src={model.src} onUpload={writeUpload} />
        ) : (
          <>
            <SketchfabImportButton onImported={writeImport} />
            <details className="ks-model-source__uid-fallback">
              <summary>Or paste a UID / URL manually</summary>
              <SketchfabInput value={sketchfabValue} onCommit={writeSketchfab} />
            </details>
          </>
        )}
      </div>

      {childKeys.map((propName) => (
        <SchemaField
          key={propName}
          name={propName}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          schema={properties[propName] as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          uiSchema={(uiSchema as any)?.[propName]}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formData={(model as any)[propName]}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          errorSchema={(errorSchema as any)?.[propName]}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          idSchema={(idSchema as any)?.[propName]}
          onChange={(value: unknown) => onChange({ ...model, [propName]: value })}
          onBlur={() => {}}
          onFocus={() => {}}
          required={false}
          registry={registry}
        />
      ))}
    </fieldset>
  );
}

function LinkInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (raw: string) => void;
}) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value);
  }, [value, focused]);
  return (
    <input
      type="text"
      className="ks-model-source__input"
      placeholder="https://… .glb or .gltf URL"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        onCommit(text);
      }}
    />
  );
}

function SketchfabInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (raw: string) => void;
}) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value);
  }, [value, focused]);
  const liveUid = parseSketchfabUid(text);
  const showInvalid = text.trim().length > 0 && !liveUid;
  return (
    <>
      <input
        type="text"
        className="ks-model-source__input"
        placeholder="https://sketchfab.com/3d-models/… or a 32-char UID"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onCommit(text);
        }}
        aria-invalid={showInvalid || undefined}
      />
      {showInvalid ? (
        <p className="ks-model-source__hint ks-model-source__hint--warn">
          Couldn't find a Sketchfab UID in that input. Paste the full model
          page URL or the 32-character UID itself.
        </p>
      ) : (
        <p className="ks-model-source__hint">
          Paste any Sketchfab model URL — we'll extract the UID automatically.
        </p>
      )}
    </>
  );
}

function UploadInput({
  src,
  onUpload,
}: {
  src: string | undefined;
  onUpload: (dataUrl: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragHover, setDragHover] = useState(false);

  const handleFile = (file: File | undefined | null) => {
    if (!file) return;
    setError(null);
    const sizeMb = file.size / 1024 / 1024;
    if (sizeMb > 50) {
      setError(
        `File is ${sizeMb.toFixed(1)} MB; over the 50 MB cap. Drafts won't persist; the SCORM zip will still include it for this session.`,
      );
    }
    const reader = new FileReader();
    reader.onerror = () => setError("Could not read the file.");
    reader.onload = () => {
      if (typeof reader.result === "string") onUpload(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragHover(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const isData = src?.startsWith("data:") ?? false;
  const sizeKb = isData && src ? Math.round((src.length * 0.75) / 1024) : null;

  return (
    <div
      className={["ks-model-source__drop", dragHover ? "is-drophover" : ""]
        .filter(Boolean)
        .join(" ")}
      onDragOver={(e) => {
        e.preventDefault();
        setDragHover(true);
      }}
      onDragLeave={() => setDragHover(false)}
      onDrop={onDrop}
    >
      <input
        ref={fileRef}
        type="file"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        onChange={onPick}
        className="ks-model-source__file"
      />
      <button
        type="button"
        className="ks-model-source__pick"
        onClick={() => fileRef.current?.click()}
      >
        {isData ? "Replace file" : "Choose .glb / .gltf file"}
      </button>
      <p className="ks-model-source__hint">
        {isData && sizeKb !== null
          ? `Loaded inline (~${sizeKb} KB). Drop another file to replace.`
          : "Or drag a .glb / .gltf file here. Up to 50 MB."}
      </p>
      {error ? (
        <p className="ks-model-source__hint ks-model-source__hint--warn">{error}</p>
      ) : null}
    </div>
  );
}
