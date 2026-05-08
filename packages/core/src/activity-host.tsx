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
import { Hotspot2D } from "./components/hotspot-2d/index.js";
import { VirtualTour } from "./components/virtual-tour/index.js";
import { Categorization } from "./components/categorization/index.js";
import { AnatomyLabeling } from "./components/anatomy-labeling/index.js";
import { SequenceSteps } from "./components/sequence-steps/index.js";
import { MatchingPairs } from "./components/matching-pairs/index.js";
import { HighlightText } from "./components/highlight-text/index.js";
import { ImageComparisonSlider } from "./components/image-comparison-slider/index.js";
import { Flashcards } from "./components/flashcards/index.js";
import { ReflectionPrompt } from "./components/reflection-prompt/index.js";
import { AudioRecording } from "./components/audio-recording/index.js";
import { BranchingScenario } from "./components/branching-scenario/index.js";
import { ImageAnnotation } from "./components/image-annotation/index.js";
import { ConceptMap } from "./components/concept-map/index.js";
import { InteractiveVideo } from "./components/interactive-video/index.js";
import { LabPanel } from "./components/lab-panel/index.js";
import { DDxTree } from "./components/ddx-tree/index.js";
import { OSCE } from "./components/osce/index.js";
import { StubActivity } from "./components/_stub/StubActivity.js";
import { PLANNED_ACTIVITY_KINDS } from "./planned.js";

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

  const activityElement = renderActivity(kind, cfg, callbacks);
  return (
    <>
      {activityElement}
      <ActivityFooter author={cfg?.author} />
    </>
  );
}

function renderActivity(kind: ActivityKind, cfg: unknown, callbacks: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = cfg as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cb = callbacks as any;
  if ((PLANNED_ACTIVITY_KINDS as readonly string[]).includes(kind)) {
    return <StubActivity config={c} kind={kind as never} {...cb} />;
  }

  switch (kind) {
    case "multiple-choice":
      return <MultipleChoice config={c} {...cb} />;
    case "fill-in-the-blanks":
      return <FillInTheBlanks config={c} {...cb} />;
    case "drag-and-drop":
      return <DragAndDrop config={c} {...cb} />;
    case "course-presentation":
      return <CoursePresentation config={c} {...cb} />;
    case "question-set":
      return <QuestionSet config={c} {...cb} />;
    case "hotspot-3d":
      return <Hotspot3D config={c} {...cb} />;
    case "hotspot-2d":
      return <Hotspot2D config={c} {...cb} />;
    case "virtual-tour":
      return <VirtualTour config={c} {...cb} />;
    case "categorization":
      return <Categorization config={c} {...cb} />;
    case "anatomy-labeling":
      return <AnatomyLabeling config={c} {...cb} />;
    case "sequence-steps":
      return <SequenceSteps config={c} {...cb} />;
    case "matching-pairs":
      return <MatchingPairs config={c} {...cb} />;
    case "highlight-text":
      return <HighlightText config={c} {...cb} />;
    case "image-comparison-slider":
      return <ImageComparisonSlider config={c} {...cb} />;
    case "flashcards":
      return <Flashcards config={c} {...cb} />;
    case "reflection-prompt":
      return <ReflectionPrompt config={c} {...cb} />;
    case "audio-recording":
      return <AudioRecording config={c} {...cb} />;
    case "branching-scenario":
      return <BranchingScenario config={c} {...cb} />;
    case "image-annotation":
      return <ImageAnnotation config={c} {...cb} />;
    case "concept-map":
      return <ConceptMap config={c} {...cb} />;
    case "interactive-video":
      return <InteractiveVideo config={c} {...cb} />;
    case "lab-panel":
      return <LabPanel config={c} {...cb} />;
    case "ddx-tree":
      return <DDxTree config={c} {...cb} />;
    case "osce":
      return <OSCE config={c} {...cb} />;
    default:
      return <StubActivity config={c} {...cb} />;
  }
}

/**
 * Tiny credit line shown beneath every activity. Identifies the platform
 * (links back to the open-source repo + license) and surfaces the author's
 * name when the JSON sets one. Stays out of the way visually so it doesn't
 * compete with the activity's own UI.
 */
function ActivityFooter({ author }: { author?: string }) {
  return (
    <footer
      style={{
        maxWidth: 720,
        margin: "12px auto 16px",
        padding: "0 28px",
        fontSize: 12,
        color: "var(--color-text-muted, #6e6e76)",
        textAlign: "center",
        lineHeight: 1.6,
      }}
    >
      {author ? (
        <>
          Authored by <strong>{author}</strong>
          {" · "}
        </>
      ) : null}
      Made with{" "}
      <a
        href="https://github.com/anthropics/kukui"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "inherit", textDecoration: "underline" }}
      >
        Kukui Studio
      </a>
      {" · "}
      <a
        href="https://opensource.org/license/mit"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "inherit", textDecoration: "underline" }}
      >
        MIT
      </a>
    </footer>
  );
}

// Smaller vertical margins than a standalone web page would use — most LMS
// embeds (Brightspace's content-topic-renderer is 680 px tall by default)
// give activities a fixed-height iframe, so 48 px of card margin pushed the
// footer credit line below the fold. 16 px keeps the activity centered
// without wasting that space.
const baseCard: CSSProperties = {
  maxWidth: 720,
  margin: "16px auto",
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
