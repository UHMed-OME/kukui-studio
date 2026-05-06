import { useMemo } from "react";
import {
  MultipleChoice,
  FillInTheBlanks,
  DragAndDrop,
  CoursePresentation,
  QuestionSet,
  Hotspot3D,
  VirtualTour,
} from "@kukui/core";
import { SchemaRegistry, type SchemaRegistryKey } from "@kukui/schemas";
import type { ActivityKind } from "@kukui/core";

/**
 * Live preview pane. Validates the current form value against the matching
 * Zod schema, then renders the actual @kukui/core activity component if
 * valid; otherwise shows the validation errors so the author can fix them
 * inline.
 */
export function Preview({ kind, value }: { kind: ActivityKind; value: unknown }) {
  const result = useMemo(
    () => SchemaRegistry[kind as SchemaRegistryKey].safeParse(value),
    [kind, value],
  );

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
  // `kind`. TypeScript can't track that through the dispatch table here any
  // more than ActivityHost can, so each branch passes the same any-typed
  // payload through.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = result.data as any;
  const noop = () => {};

  switch (kind) {
    case "multiple-choice":
      return <MultipleChoice config={config} onSubmit={noop} />;
    case "fill-in-the-blanks":
      return <FillInTheBlanks config={config} onSubmit={noop} />;
    case "drag-and-drop":
      return <DragAndDrop config={config} onSubmit={noop} />;
    case "course-presentation":
      return <CoursePresentation config={config} onSubmit={noop} />;
    case "question-set":
      return <QuestionSet config={config} onSubmit={noop} />;
    case "hotspot-3d":
      return <Hotspot3D config={config} onSubmit={noop} />;
    case "virtual-tour":
      return <VirtualTour config={config} onSubmit={noop} />;
  }
}
