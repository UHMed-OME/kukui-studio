import { lazy, Suspense, type ComponentType } from "react";
import type { ActivityKind } from "@kukui/core";

const DnDEditor = lazy(() =>
  import("./DnDEditor.js").then((m) => ({ default: m.DnDEditor })),
);
const Hotspot2DEditor = lazy(() =>
  import("./Hotspot2DEditor.js").then((m) => ({ default: m.Hotspot2DEditor })),
);
const AnatomyLabelingEditor = lazy(() =>
  import("./AnatomyLabelingEditor.js").then((m) => ({ default: m.AnatomyLabelingEditor })),
);
const ImageAnnotationEditor = lazy(() =>
  import("./ImageAnnotationEditor.js").then((m) => ({ default: m.ImageAnnotationEditor })),
);
const ConceptMapEditor = lazy(() =>
  import("./ConceptMapEditor.js").then((m) => ({ default: m.ConceptMapEditor })),
);
const Hotspot3DEditor = lazy(() =>
  import("./Hotspot3DEditor.js").then((m) => ({ default: m.Hotspot3DEditor })),
);
const InteractiveVideoEditor = lazy(() =>
  import("./InteractiveVideoEditor.js").then((m) => ({ default: m.InteractiveVideoEditor })),
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditor = ComponentType<{ config: any; onChange: (next: any) => void }>;

const EDITORS: Partial<Record<ActivityKind, AnyEditor>> = {
  "drag-and-drop": DnDEditor as AnyEditor,
  "hotspot-2d": Hotspot2DEditor as AnyEditor,
  "anatomy-labeling": AnatomyLabelingEditor as AnyEditor,
  "image-annotation": ImageAnnotationEditor as AnyEditor,
  "concept-map": ConceptMapEditor as AnyEditor,
  "hotspot-3d": Hotspot3DEditor as AnyEditor,
  "interactive-video": InteractiveVideoEditor as AnyEditor,
};

/** Single source of truth for which activities have a visual editor. */
export function hasEditor(kind: ActivityKind): boolean {
  return Object.prototype.hasOwnProperty.call(EDITORS, kind);
}

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
  const Editor = EDITORS[kind];
  if (Editor) {
    return (
      <Suspense fallback={<EditLoading />}>
        <Editor config={value} onChange={onChange} />
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
        For now, edit values in the form on the right and switch to <strong>Live</strong> here to
        see them rendered.
      </p>
    </div>
  );
}
