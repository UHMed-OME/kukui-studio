import { lazy, Suspense } from "react";
import type { ActivityKind } from "@kukui/core";

const DnDEditor = lazy(() =>
  import("./DnDEditor.js").then((m) => ({ default: m.DnDEditor })),
);

/**
 * Edit-mode canvas. Replaces the live preview when the author wants to
 * place elements visually instead of editing coordinates in the form.
 *
 * Each activity that supports a visual editor renders its own canvas; the
 * rest fall through to a "Coming soon" message that points the author at
 * the form.
 */
export function EditCanvas({
  kind,
  value,
  onChange,
}: {
  kind: ActivityKind;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  if (kind === "drag-and-drop") {
    return (
      <Suspense fallback={<EditLoading />}>
        <DnDEditor
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config={value as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onChange={onChange as any}
        />
      </Suspense>
    );
  }
  return <EditUnsupported kind={kind} />;
}

function EditLoading() {
  return <div className="ks-edit-empty">Loading editor…</div>;
}

function EditUnsupported({ kind }: { kind: ActivityKind }) {
  return (
    <div className="ks-edit-empty">
      <p style={{ margin: "0 0 8px", fontWeight: 700, color: "var(--color-text-primary)" }}>
        Visual editor for <em>{kind}</em> is on the way.
      </p>
      <p style={{ margin: 0 }}>
        For now, edit values in the form on the left and switch to <strong>Live</strong> here to
        see them rendered.
      </p>
    </div>
  );
}
