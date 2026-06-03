import { Suspense, useEffect, useState, type CSSProperties } from "react";
import { SchemaRegistry, type SchemaRegistryKey } from "@kukui/schemas";
import { loadContent, ContentLoadError } from "./content.js";
import { getScormDriver, type DriverMode } from "./scorm.js";
import type { CollectConfig } from "./collect.js";
import type { ActivityKind, BuiltActivityKind, InteractionRecord, ScoreState } from "./types.js";
import { ACTIVITY_REGISTRY, StubActivityLazy } from "./components/registry.js";
import { PLANNED_ACTIVITY_KINDS } from "./planned.js";
import { applyColorScheme, type ResolvedColorScheme } from "./colorScheme.js";
import { WebCompletionPanel } from "./WebCompletionPanel.js";

export type { ActivityKind };

/** Stable localStorage namespace for a web-mode run on this page. */
function webStorageKey(kind: ActivityKind): string {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  return `kukui:web:${kind}:${path}`;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string; details?: string }
  | { status: "ready"; config: unknown };

export type ActivityHostProps = {
  kind: ActivityKind;
  configUrl: string;
  /**
   * Distribution mode. "web" turns on localStorage persistence and the
   * learner-facing completion panel; omitted/"memory" keeps the silent
   * dev/preview behaviour. Engine-web sets this from `data-mode` on #root.
   */
  mode?: DriverMode;
  /**
   * Optional results-collection wiring for web mode (mailto / webhook /
   * external form). A deployment-time concern set by whoever hosts the
   * package — NOT part of the authored activity JSON — so the 24 activity
   * schemas stay untouched. Engine-web reads it from `data-collect` on #root.
   */
  collect?: CollectConfig;
  /** Test seam: replace the loader. */
  loader?: typeof loadContent;
};

export function ActivityHost({
  kind,
  configUrl,
  mode,
  collect,
  loader = loadContent,
}: ActivityHostProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [completion, setCompletion] = useState<ScoreState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const schema = SchemaRegistry[kind as SchemaRegistryKey];
    if (!schema) {
      setState({ status: "error", message: `Unknown activity kind: ${kind}` });
      return;
    }
    loader(configUrl, schema)
      .then((config) => {
        if (cancelled) return;
        // Apply author-pinned theme from the validated config. "auto" or
        // missing → no override; initColorScheme has already wired the
        // OS-follow path. Any concrete scheme value → override regardless
        // of OS or stored preference. The learner has no in-engine
        // toggle, so this pin sticks for the session.
        const theme = (config as { appearance?: { theme?: string } })?.appearance?.theme;
        if (theme && theme !== "auto") {
          applyColorScheme(theme as ResolvedColorScheme);
        }
        setState({ status: "ready", config });
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

  const scorm = getScormDriver(
    mode === "web" ? { mode, storageKey: webStorageKey(kind) } : undefined,
  );

  const handleSubmit = (score: ScoreState) => {
    scorm.postScore(score.raw, score.max, score.success);
    if (score.suspendData !== undefined) scorm.saveSuspendData(score.suspendData);
    if (mode === "web") setCompletion(score);
  };

  const handlePersist = (suspendData: string) => {
    scorm.saveSuspendData(suspendData);
  };

  const handleInteraction = (record: InteractionRecord) => {
    scorm.recordInteraction(record);
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
  // registry, so each entry receives `state.config` with the implicit
  // contract that runtime validation matches the static type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = state.config as any;

  const callbackProps = {
    onSubmit: handleSubmit,
    onPersist: handlePersist,
    onInteraction: handleInteraction,
    suspendData: scorm.loadSuspendData(),
  };

  const isPlanned = (PLANNED_ACTIVITY_KINDS as readonly string[]).includes(kind);
  // Stub takes an extra `kind` prop that the regular ActivityProps doesn't
  // model; cast to `any` to widen at the call site. Runtime contract is
  // identical to the old switch statement that fell through to StubActivity.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Stub = StubActivityLazy as any;
  const Component = ACTIVITY_REGISTRY[kind as BuiltActivityKind];

  return (
    <>
      <Suspense fallback={<div style={loadingStyle}>Loading activity…</div>}>
        {isPlanned || !Component ? (
          <Stub config={cfg} kind={kind as never} {...callbackProps} />
        ) : (
          <Component config={cfg} {...callbackProps} />
        )}
      </Suspense>
      {mode === "web" && completion ? (
        <WebCompletionPanel
          score={completion}
          kind={kind}
          title={cfg?.title}
          collect={collect}
          getResults={scorm.getWebResults?.bind(scorm)}
        />
      ) : null}
      <ActivityFooter author={cfg?.author} />
    </>
  );
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
