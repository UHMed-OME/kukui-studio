import { useEffect, useMemo, useState } from "react";
import {
  ContentLoadError,
  getScormDriver,
  loadContent,
  type ActivityKind,
} from "@kukui/core";
import { SchemaRegistry, type SchemaRegistryKey, type StrawPollConfig } from "@kukui/schemas";
import type { LiveRoomHandle, Presence } from "@kukui/live";
import { InstructorConsole, type ConfigSummary } from "./InstructorConsole.js";
import { StudentParticipant } from "./StudentParticipant.js";
import { StrawPollLive } from "./activities/StrawPollLive.js";

export type LiveHostProps = {
  /** Activity kind to host. Must be a key in `SchemaRegistry`. */
  kind: ActivityKind;
  /** Optional initial config URL — when provided, loads + validates on mount. */
  configUrl?: string;
  /** Connected Live room handle. */
  room: LiveRoomHandle;
  /** Presence snapshot from the parent (already polled). */
  presence: Map<string, Presence>;
  /** Local participant's role — drives the instructor/student split. */
  role: "instructor" | "student";
  /** Called when the user leaves the room. Parent owns the join lifecycle. */
  onLeave: () => void;
  /** Called when the instructor clicks "Load demo activity". */
  onLoadDemo?: () => void;
  /** Test seam: replace the loader. */
  loader?: typeof loadContent;
};

type LoadState =
  | { status: "idle" }
  | { status: "loading"; url: string }
  | { status: "error"; message: string; details?: string }
  | { status: "ready"; config: unknown };

/**
 * Live counterpart to `@kukui/core`'s ActivityHost.
 *
 * Responsibilities for M1:
 *   - Validate an activity JSON config against `SchemaRegistry[kind]`.
 *   - Initialize this student's SCORM session (so grade passback works on
 *     `cmi.core.lesson_status` at session end).
 *   - Delegate to InstructorConsole or StudentParticipant based on role.
 *
 * Activity-specific Live components (TBL, Live Poll, Live Timeline) plug in
 * here in M2+ — for now the body of the room is a placeholder summary.
 */
export function LiveHost({
  kind,
  configUrl,
  room,
  presence,
  role,
  onLeave,
  onLoadDemo,
  loader = loadContent,
}: LiveHostProps) {
  const [loadState, setLoadState] = useState<LoadState>(
    configUrl ? { status: "loading", url: configUrl } : { status: "idle" },
  );

  // Initialize the SCORM driver once per LiveHost mount. Each student tab
  // is its own SCORM session, regardless of how many peers share the room.
  useEffect(() => {
    const driver = getScormDriver();
    driver.initialize();
    return () => {
      // Leaving the room ends this student's session; finish so the LMS
      // commits whatever was already written.
      driver.finish();
    };
  }, []);

  // Validate the activity config when the URL changes.
  useEffect(() => {
    if (!configUrl) {
      setLoadState({ status: "idle" });
      return;
    }
    const schema = SchemaRegistry[kind as SchemaRegistryKey];
    if (!schema) {
      setLoadState({ status: "error", message: `Unknown activity kind: ${kind}` });
      return;
    }
    let cancelled = false;
    setLoadState({ status: "loading", url: configUrl });
    loader(configUrl, schema)
      .then((config) => {
        if (!cancelled) setLoadState({ status: "ready", config });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ContentLoadError) {
          setLoadState({
            status: "error",
            message: err.message,
            details: err.issues ? JSON.stringify(err.issues, null, 2) : undefined,
          });
        } else if (err instanceof Error) {
          setLoadState({ status: "error", message: err.message });
        } else {
          setLoadState({ status: "error", message: "Unknown error loading content" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [kind, configUrl, loader]);

  const summary: ConfigSummary = useMemo(() => {
    if (loadState.status !== "ready") return {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = loadState.config as any;
    return {
      title: typeof cfg?.title === "string" ? cfg.title : undefined,
      version: typeof cfg?.version === "string" ? cfg.version : undefined,
      detail: describeConfig(kind, cfg),
    };
  }, [loadState, kind]);

  if (loadState.status === "loading") {
    return (
      <div className="live-shell">
        <article className="live-card" role="status" aria-live="polite">
          Loading activity…
        </article>
      </div>
    );
  }

  if (loadState.status === "error") {
    return (
      <div className="live-shell">
        <article
          className="live-card"
          role="alert"
          style={{ borderColor: "var(--color-error)" }}
        >
          <h1 className="live-title" style={{ fontSize: "var(--font-size-title)" }}>
            Could not load activity
          </h1>
          <p style={{ color: "var(--color-error)" }}>{loadState.message}</p>
          {loadState.details ? (
            <details style={{ marginTop: 12 }}>
              <summary>Validation details</summary>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{loadState.details}</pre>
            </details>
          ) : null}
          <div className="live-actions" style={{ marginTop: 24 }}>
            <button type="button" className="live-btn live-btn--ghost" onClick={onLeave}>
              Leave room
            </button>
          </div>
        </article>
      </div>
    );
  }

  const hasDemoLoaded = loadState.status === "ready";

  // Activity-specific live runtimes plug in here. Straw Poll is the
  // first; future activities (TBL Round, Live Timeline) add their own
  // dispatch branch. The generic Instructor/Student split below is the
  // shell for kinds that don't yet have a bespoke live runtime.
  if (kind === "straw-poll" && loadState.status === "ready") {
    return (
      <StrawPollLive
        room={room}
        presence={presence}
        role={role}
        config={loadState.config as StrawPollConfig}
        onLeave={onLeave}
      />
    );
  }

  if (role === "instructor") {
    return (
      <InstructorConsole
        room={room}
        presence={presence}
        activityKind={kind}
        configSummary={summary}
        hasDemoLoaded={hasDemoLoaded}
        onLoadDemo={onLoadDemo ?? (() => {})}
        onLeave={onLeave}
      />
    );
  }

  return (
    <StudentParticipant
      room={room}
      presence={presence}
      activityKind={kind}
      configTitle={summary.title}
      onLeave={onLeave}
    />
  );
}

/**
 * Best-effort one-line summary for a validated config. Activity-specific
 * surfaces will replace this with real previews in M2+.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function describeConfig(kind: ActivityKind, cfg: any): string | undefined {
  if (kind === "multiple-choice" && Array.isArray(cfg?.answers)) {
    return `${cfg.answers.length} answer choice${cfg.answers.length === 1 ? "" : "s"}`;
  }
  if (kind === "question-set" && Array.isArray(cfg?.questions)) {
    return `${cfg.questions.length} questions`;
  }
  return undefined;
}
