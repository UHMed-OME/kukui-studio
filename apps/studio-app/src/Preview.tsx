import { lazy, Suspense, useMemo } from "react";
import { SchemaRegistry, type SchemaRegistryKey } from "@kukui/schemas";
import { type ActivityKind, PLANNED_ACTIVITY_KINDS } from "@kukui/core";
import { EditCanvas } from "./EditCanvas/index.js";

export type PreviewMode = "live" | "edit";

// Each activity component is its own lazy chunk. Switching activity kinds
// only fetches the chunk for the kind being previewed; in particular, the
// 2D activities (MC / FIB / DnD / CP / QS) never pay for three.js + r3f
// unless the user opens the 3D Hotspot or Virtual Tour preview.
const MultipleChoice = lazy(() =>
  import("@kukui/core").then((m) => ({ default: m.MultipleChoice })),
);
const FillInTheBlanks = lazy(() =>
  import("@kukui/core").then((m) => ({ default: m.FillInTheBlanks })),
);
const DragAndDrop = lazy(() =>
  import("@kukui/core").then((m) => ({ default: m.DragAndDrop })),
);
const CoursePresentation = lazy(() =>
  import("@kukui/core").then((m) => ({ default: m.CoursePresentation })),
);
const QuestionSet = lazy(() =>
  import("@kukui/core").then((m) => ({ default: m.QuestionSet })),
);
const Hotspot3D = lazy(() => import("@kukui/core").then((m) => ({ default: m.Hotspot3D })));
const Hotspot2D = lazy(() => import("@kukui/core").then((m) => ({ default: m.Hotspot2D })));
const VirtualTour = lazy(() => import("@kukui/core").then((m) => ({ default: m.VirtualTour })));
const StubActivity = lazy(() =>
  import("@kukui/core").then((m) => ({ default: m.StubActivity })),
);

/**
 * Live preview pane. Validates the current draft against the matching Zod
 * schema, then renders the actual @kukui/core component if valid; on
 * failure shows the validation issues so the author can fix them inline.
 */
export function Preview({
  kind,
  value,
  mode,
  onChange,
}: {
  kind: ActivityKind;
  value: unknown;
  mode: PreviewMode;
  onChange: (next: unknown) => void;
}) {
  const result = useMemo(
    () => SchemaRegistry[kind as SchemaRegistryKey].safeParse(value),
    [kind, value],
  );

  if (mode === "edit") {
    // Visual editor doesn't strictly require Zod-valid input; show the editor
    // as long as the activity kind has one. The EditCanvas reads `value`
    // forgivingly and emits validated edits via `onChange`.
    return <EditCanvas kind={kind} value={value} onChange={onChange} />;
  }

  if (!result.success) {
    return (
      <div className="kukui-studio-preview-error" role="status">
        <strong>Preview is paused — config doesn't validate yet:</strong>
        <ul>
          {result.error.issues.slice(0, 8).map((issue, i) => (
            <li key={i}>
              <code>{issue.path.join(".") || "(root)"}</code> — {issue.message}
            </li>
          ))}
        </ul>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
          Fill in the highlighted fields on the left, then the preview reappears.
        </p>
      </div>
    );
  }

  // The runtime Zod parse above narrowed `config` to the right shape for
  // `kind`. TypeScript can't track that through the dispatch table.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = result.data as any;
  const noop = () => {};

  return (
    <Suspense fallback={<PreviewLoading />}>
      {renderActivity(kind, config, noop)}
    </Suspense>
  );
}

function renderActivity(kind: ActivityKind, config: unknown, noop: () => void) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = config as any;
  if ((PLANNED_ACTIVITY_KINDS as readonly string[]).includes(kind)) {
    return <StubActivity config={c} kind={kind as never} onSubmit={noop} />;
  }
  switch (kind) {
    case "multiple-choice":
      return <MultipleChoice config={c} onSubmit={noop} />;
    case "fill-in-the-blanks":
      return <FillInTheBlanks config={c} onSubmit={noop} />;
    case "drag-and-drop":
      return <DragAndDrop config={c} onSubmit={noop} />;
    case "course-presentation":
      return <CoursePresentation config={c} onSubmit={noop} />;
    case "question-set":
      return <QuestionSet config={c} onSubmit={noop} />;
    case "hotspot-3d":
      return <Hotspot3D config={c} onSubmit={noop} />;
    case "hotspot-2d":
      return <Hotspot2D config={c} onSubmit={noop} />;
    case "virtual-tour":
      return <VirtualTour config={c} onSubmit={noop} />;
    default:
      return <StubActivity config={c} onSubmit={noop} />;
  }
}

function PreviewLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        padding: 28,
        color: "var(--color-text-secondary)",
        fontSize: 13,
      }}
    >
      Loading preview…
    </div>
  );
}
