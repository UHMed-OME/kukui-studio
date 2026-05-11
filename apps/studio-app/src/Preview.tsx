import { Suspense, useMemo } from "react";
import { SchemaRegistry, type SchemaRegistryKey } from "@kukui/schemas";
import { type ActivityKind, PLANNED_ACTIVITY_KINDS } from "@kukui/core";
import {
  ACTIVITY_REGISTRY,
  StubActivityLazy,
} from "@kukui/core/components/registry";
import { EditCanvas } from "./EditCanvas/index.js";

export type PreviewMode = "live" | "edit";

/**
 * Live preview pane. Validates the current draft against the matching Zod
 * schema, then renders the actual @kukui/core component if valid; on
 * failure shows the validation issues so the author can fix them inline.
 *
 * Activity components are pulled from the shared `ACTIVITY_REGISTRY` — each
 * entry is a `React.lazy` of a per-kind subpath import, so Vite/Rollup
 * emits one chunk per activity instead of one giant bundle that drags every
 * other activity in. Switching kinds in Preview only downloads the new
 * activity's chunk; 2D activities never pull three.js + r3f unless the user
 * opens a 3D preview.
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

  // Note: each activity component resets its own derived-from-config local
  // state via `useEffect([config])`, so we don't remount the Suspense tree
  // on every keystroke. This keeps three.js / audio / imagery from
  // re-initializing on every form edit.

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
  // `kind`. TypeScript can't track that through the dispatch registry.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = result.data as any;
  const noop = () => {};

  const isPlanned = (PLANNED_ACTIVITY_KINDS as readonly string[]).includes(kind);
  // Stub takes an extra `kind` prop that the regular ActivityProps doesn't
  // model; cast to `any` to widen at the call site. Same contract as the
  // old `renderActivity` switch which fell through to StubActivity.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Stub = StubActivityLazy as any;
  const Component = ACTIVITY_REGISTRY[kind as keyof typeof ACTIVITY_REGISTRY];

  return (
    <Suspense fallback={<PreviewLoading />}>
      {isPlanned || !Component ? (
        <Stub config={config} kind={kind as never} onSubmit={noop} />
      ) : (
        <Component config={config} onSubmit={noop} />
      )}
    </Suspense>
  );
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
