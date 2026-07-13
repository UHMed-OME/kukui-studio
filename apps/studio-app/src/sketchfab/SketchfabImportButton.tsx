import { useState } from "react";
import { useSketchfabAuth } from "./useSketchfabAuth.js";
import { importFromSketchfab, type ImportAttribution } from "./import.js";

export type SketchfabImportButtonProps = {
  onImported: (result: { uid: string; attribution: ImportAttribution }) => void;
};

type State =
  | { kind: "idle"; url: string }
  | { kind: "loading"; url: string }
  | { kind: "error"; url: string; message: string };

export function SketchfabImportButton({ onImported }: SketchfabImportButtonProps) {
  const { status, token, signIn } = useSketchfabAuth();
  const [state, setState] = useState<State>({ kind: "idle", url: "" });

  if (status === "disabled") {
    return (
      <p className="ks-sketchfab-import__msg">
        Sketchfab import isn't configured for this deployment.
      </p>
    );
  }

  if (status === "signed-out") {
    return (
      <div className="ks-sketchfab-import">
        <p className="ks-sketchfab-import__msg">
          Sign in to Sketchfab to import a Creative Commons-licensed model.
        </p>
        <button
          type="button"
          className="kukui-studio-btn kukui-studio-btn--primary"
          onClick={() => signIn()}
        >
          Sign in to Sketchfab
        </button>
      </div>
    );
  }

  const url = state.url;
  const loading = state.kind === "loading";

  const handleImport = async () => {
    if (!token) return;
    setState({ kind: "loading", url });
    const result = await importFromSketchfab(url, token.accessToken);
    if (result.kind === "error") {
      setState({ kind: "error", url, message: result.message });
      return;
    }
    onImported({ uid: result.uid, attribution: result.attribution });
    setState({ kind: "idle", url: "" });
  };

  return (
    <div className="ks-sketchfab-import">
      <label className="ks-sketchfab-import__label">
        Sketchfab model URL or UID
        <input
          type="text"
          value={url}
          onChange={(e) =>
            setState((s) =>
              s.kind === "loading"
                ? s
                : { kind: "idle", url: e.target.value },
            )
          }
          placeholder="https://sketchfab.com/3d-models/…"
          disabled={loading}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <button
        type="button"
        className="kukui-studio-btn kukui-studio-btn--primary"
        onClick={handleImport}
        disabled={loading || !url.trim()}
      >
        {loading ? "Importing…" : "Import from Sketchfab"}
      </button>
      {state.kind === "error" ? (
        <p role="alert" className="ks-sketchfab-import__error">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
