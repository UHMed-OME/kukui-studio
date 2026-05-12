import { Suspense, useMemo, useState } from "react";
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
      {isLiveActivity(kind) ? <LiveTestLauncher kind={kind} config={config} /> : null}
    </Suspense>
  );
}

/**
 * Activities that only really make sense with multiple peers, so the
 * single-learner preview can only show their static surface. For these
 * we offer an "Open in Kukui Live" launcher right below the preview so
 * the author can dress-rehearse the multi-peer flow without leaving
 * Studio.
 */
const LIVE_ACTIVITY_KINDS: readonly ActivityKind[] = ["straw-poll"];

function isLiveActivity(kind: ActivityKind): boolean {
  return LIVE_ACTIVITY_KINDS.includes(kind);
}

/**
 * "Test in Kukui Live" launcher. Emits two URL variants:
 *
 *   - **Instructor URL**: `?config=…&adminKey=…` — auto-claims host role
 *     because the URL's adminKey matches `config.live.adminKey`.
 *   - **Student URL**: `?config=…` only — joins as a student. Safe to
 *     share with anyone, since it can't unlock host controls.
 *
 * Both URLs open in a new tab pointed at `VITE_LIVE_URL` (defaults to
 * `../live-mode/` — works once both apps are co-deployed; in dev the
 * instructor opens the live-mode dev server directly).
 */
function LiveTestLauncher({
  kind,
  config,
}: {
  kind: ActivityKind;
  config: unknown;
}) {
  const liveBaseUrl =
    (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_LIVE_URL ??
    "../live-mode/";

  const adminKey = useMemo(() => {
    if (!config || typeof config !== "object") return undefined;
    const live = (config as Record<string, unknown>).live;
    if (!live || typeof live !== "object") return undefined;
    const key = (live as Record<string, unknown>).adminKey;
    return typeof key === "string" && key.length > 0 ? key : undefined;
  }, [config]);

  const buildUrl = (asInstructor: boolean): string => {
    try {
      const json = JSON.stringify(config);
      const b64 = toBase64Url(json);
      const params = new URLSearchParams({ activity: kind, config: b64 });
      if (asInstructor && adminKey) params.set("adminKey", adminKey);
      return `${liveBaseUrl}?${params.toString()}`;
    } catch {
      return liveBaseUrl;
    }
  };

  const instructorUrl = useMemo(
    () => buildUrl(true),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, config, adminKey, liveBaseUrl],
  );
  const studentUrl = useMemo(
    () => buildUrl(false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, config, liveBaseUrl],
  );

  const [copied, setCopied] = useState<"instructor" | "student" | null>(null);
  const copyUrl = async (which: "instructor" | "student") => {
    const target = which === "instructor" ? instructorUrl : studentUrl;
    try {
      const abs = new URL(target, window.location.href).toString();
      await navigator.clipboard.writeText(abs);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard API blocked in some contexts — fall through quietly */
    }
  };

  return (
    <div
      className="kukui-studio-live-launch"
      role="region"
      aria-label="Test in Kukui Live"
    >
      <div className="kukui-studio-live-launch__row">
        <div className="kukui-studio-live-launch__text">
          <strong>Test this activity in Kukui Live</strong>
          <span>
            Opens your current draft in a new tab. The instructor URL embeds your admin key
            (auto-grants host role); the student URL is safe to share with anyone.
          </span>
        </div>
      </div>
      <div className="kukui-studio-live-launch__grid">
        <div className="kukui-studio-live-launch__col">
          <h4>As instructor</h4>
          <p>Auto-claims host. Use this URL to drive the session.</p>
          <div className="kukui-studio-live-launch__actions">
            <a
              className="kukui-studio-btn kukui-studio-btn--primary"
              href={instructorUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Launch instructor view →
            </a>
            <button
              type="button"
              className="kukui-studio-btn kukui-studio-btn--ghost"
              onClick={() => copyUrl("instructor")}
              disabled={!adminKey}
              title={adminKey ? undefined : "Set an admin key in Live settings first"}
            >
              {copied === "instructor" ? "Copied!" : "Copy instructor URL"}
            </button>
          </div>
          {!adminKey ? (
            <p className="kukui-studio-live-launch__warn">
              No admin key set — anyone with the student URL could claim host. Set one under{" "}
              <em>Live session settings</em>.
            </p>
          ) : null}
        </div>
        <div className="kukui-studio-live-launch__col">
          <h4>As student</h4>
          <p>Joins as a participant. Share with classmates / open in incognito to test.</p>
          <div className="kukui-studio-live-launch__actions">
            <a
              className="kukui-studio-btn kukui-studio-btn--ghost"
              href={studentUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Launch student view →
            </a>
            <button
              type="button"
              className="kukui-studio-btn kukui-studio-btn--ghost"
              onClick={() => copyUrl("student")}
            >
              {copied === "student" ? "Copied!" : "Copy student URL"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Base64url (RFC 4648 §5) — `+` → `-`, `/` → `_`, no padding. URL-safe. */
function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
