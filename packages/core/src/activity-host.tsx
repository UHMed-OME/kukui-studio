import { useEffect, useState, type CSSProperties } from "react";
import { SchemaRegistry, type SchemaRegistryKey } from "@kukui/schemas";
import { loadContent, ContentLoadError } from "./content.js";
import { getScormDriver } from "./scorm.js";
import type { ActivityKind, ScoreState } from "./types.js";
import { MultipleChoice } from "./components/multiple-choice/index.js";
import { FillInTheBlanks } from "./components/fill-in-the-blanks/index.js";
import { DragAndDrop } from "./components/drag-and-drop/index.js";
import { CoursePresentation } from "./components/course-presentation/index.js";
import { QuestionSet } from "./components/question-set/index.js";
import { Hotspot3D } from "./components/hotspot-3d/index.js";
import { VirtualTour } from "./components/virtual-tour/index.js";

export type { ActivityKind };

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string; details?: string }
  | { status: "ready"; config: unknown };

export type ActivityHostProps = {
  kind: ActivityKind;
  configUrl: string;
  /** Test seam: replace the loader. */
  loader?: typeof loadContent;
};

export function ActivityHost({ kind, configUrl, loader = loadContent }: ActivityHostProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const schema = SchemaRegistry[kind as SchemaRegistryKey];
    if (!schema) {
      setState({ status: "error", message: `Unknown activity kind: ${kind}` });
      return;
    }
    loader(configUrl, schema)
      .then((config) => {
        if (!cancelled) setState({ status: "ready", config });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ContentLoadError) {
          setState({
            status: "error",
            message: err.message,
            details: err.issues ? JSON.stringify(err.issues, null, 2) : undefined,
          });
        } else if (err instanceof Error) {
          setState({ status: "error", message: err.message });
        } else {
          setState({ status: "error", message: "Unknown error loading content" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [kind, configUrl, loader]);

  const scorm = getScormDriver();

  const handleSubmit = (score: ScoreState) => {
    scorm.postScore(score.raw, score.max, score.success);
    if (score.suspendData !== undefined) scorm.saveSuspendData(score.suspendData);
  };

  const handlePersist = (suspendData: string) => {
    scorm.saveSuspendData(suspendData);
  };

  if (state.status === "loading") {
    return (
      <div role="status" aria-live="polite" style={loadingStyle}>
        Loading activity…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div role="alert" style={errorStyle}>
        <h2 style={{ margin: 0, fontSize: "var(--font-size-title, 24px)" }}>
          Could not load activity
        </h2>
        <p style={{ marginTop: 12 }}>{state.message}</p>
        {state.details ? (
          <details style={{ marginTop: 16 }}>
            <summary>Validation details</summary>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{state.details}</pre>
          </details>
        ) : null}
      </div>
    );
  }

  // The runtime Zod parse above already narrowed `state.config` to the right
  // TConfig for `kind`. TypeScript can't track that through the dispatch
  // table, so each branch passes `state.config` through with the implicit
  // contract that runtime validation matches the static type.
  const callbacks = {
    onSubmit: handleSubmit,
    onPersist: handlePersist,
    suspendData: scorm.loadSuspendData(),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = state.config as any;

  switch (kind) {
    case "multiple-choice":
      return <MultipleChoice config={cfg} {...callbacks} />;
    case "fill-in-the-blanks":
      return <FillInTheBlanks config={cfg} {...callbacks} />;
    case "drag-and-drop":
      return <DragAndDrop config={cfg} {...callbacks} />;
    case "course-presentation":
      return <CoursePresentation config={cfg} {...callbacks} />;
    case "question-set":
      return <QuestionSet config={cfg} {...callbacks} />;
    case "hotspot-3d":
      return <Hotspot3D config={cfg} {...callbacks} />;
    case "virtual-tour":
      return <VirtualTour config={cfg} {...callbacks} />;
  }
}

const baseCard: CSSProperties = {
  maxWidth: 720,
  margin: "48px auto",
  padding: 28,
  background: "var(--color-surface, #ffffff)",
  border: "1px solid var(--color-border, #dad2c6)",
  borderRadius: 12,
};

const loadingStyle: CSSProperties = { ...baseCard, color: "var(--color-text-secondary)" };
const errorStyle: CSSProperties = {
  ...baseCard,
  borderColor: "var(--color-error, #c34132)",
  background: "var(--color-error-soft)",
};
