import { Component, Suspense, useMemo, useRef, useState, type ReactNode } from "react";
import { SchemaRegistry, type SchemaRegistryKey } from "@kukui/schemas";
import { type ActivityKind, PLANNED_ACTIVITY_KINDS, ActivityFooter } from "@kukui/core";
import {
  ACTIVITY_REGISTRY,
  StubActivityLazy,
} from "@kukui/core/components/registry";
import { EditCanvas } from "./EditCanvas/index.js";
import { useResolvedDeck } from "./slides/resolveDeckAssets.js";

export type PreviewMode = "live" | "edit";

/**
 * Course-presentation live preview: resolves slide-image assetIds (stored in
 * IndexedDB) into object URLs before handing the deck to the runtime Component,
 * which only reads `background.src`. Without this, imported slides preview
 * blank because their PNGs never live in the persisted config.
 */
function ResolvedDeckPreview({
  Component,
  config,
  onSubmit,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: React.ComponentType<{ config: any; onSubmit: () => void }>;
  config: unknown;
  onSubmit: () => void;
}) {
  const resolved = useResolvedDeck(config);
  return <Component config={resolved ?? config} onSubmit={onSubmit} />;
}

/**
 * Validation result shape — derived from SchemaRegistry's safeParse
 * rather than imported from zod directly so we stay version-tolerant
 * across Zod 3 / 4 (their public type exports drifted).
 */
export type PreviewValidation = ReturnType<
  (typeof SchemaRegistry)[SchemaRegistryKey]["safeParse"]
>;

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

class PreviewErrorBoundary extends Component<
  { children: ReactNode; resetKey: string },
  { error: Error | null; resetKey: string }
> {
  constructor(props: { children: ReactNode; resetKey: string }) {
    super(props);
    this.state = { error: null, resetKey: props.resetKey };
  }
  static getDerivedStateFromProps(
    props: { children: ReactNode; resetKey: string },
    state: { error: Error | null; resetKey: string },
  ) {
    if (state.error && props.resetKey !== state.resetKey) {
      return { error: null, resetKey: props.resetKey };
    }
    return { resetKey: props.resetKey };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[Preview] Activity render error:", error, info.componentStack);
  }
  override render() {
    if (this.state.error) {
      return (
        <div className="kukui-studio-preview-error" role="alert">
          <strong>Preview error</strong>
          <p>{this.state.error.message}</p>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            Switch activity types or fix the config to recover the preview.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export function Preview({
  kind,
  value,
  mode,
  onChange,
  validation,
}: {
  kind: ActivityKind;
  value: unknown;
  mode: PreviewMode;
  onChange: (next: unknown) => void;
  /**
   * Pre-computed validation result from the parent. Authoring shells
   * (App.tsx) already run `safeParse` on every keystroke to drive the
   * ValidationBadge + RJSF error injection — reusing it here saves a
   * second parse per keystroke. Optional so embedded uses can still
   * pass `value` alone and have the Preview validate locally.
   */
  validation?: PreviewValidation;
}) {
  const localValidation = useMemo(
    () =>
      validation ?? SchemaRegistry[kind as SchemaRegistryKey]!.safeParse(value),
    [validation, kind, value],
  );
  const result = localValidation;

  // Stash the last value that validated cleanly per activity kind. When
  // the author is mid-edit and the form temporarily fails validation,
  // we keep rendering the previous good preview rather than going
  // dark — the broken edit just doesn't get applied yet. Banner at the
  // top tells the author updates are paused.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastValidByKind = useRef<Partial<Record<string, any>>>({});
  if (result.success) {
    lastValidByKind.current[kind] = result.data;
  }
  const fallbackConfig = lastValidByKind.current[kind];

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

  // Failed validation: render the LAST KNOWN GOOD preview (if any) with
  // a banner explaining the form has unresolved errors. First-time
  // failures (no good state yet) still fall through to the verbose
  // issue list so the author has something actionable.
  if (!result.success) {
    if (!fallbackConfig) {
      return (
        <div className="kukui-studio-preview-error" role="status">
          <strong>Preview is paused. Config doesn't validate yet:</strong>
          <ul>
            {(result.error.issues as ReadonlyArray<{ path: PropertyKey[]; message: string }>)
              .slice(0, 8)
              .map((issue, i) => (
                <li key={i}>
                  <code>
                    {issue.path
                      .map((p) => (typeof p === "symbol" ? p.toString() : String(p)))
                      .join(".") || "(root)"}
                  </code>{": "}
                  {issue.message}
                </li>
              ))}
          </ul>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            Fill in the highlighted fields in the form, then the preview reappears.
          </p>
        </div>
      );
    }
    // Render the cached config; flag that edits aren't being applied.
    const Stub = StubActivityLazy as unknown as React.ComponentType<{
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: any;
      kind: never;
      onSubmit: () => void;
    }>;
    const Component = ACTIVITY_REGISTRY[kind as keyof typeof ACTIVITY_REGISTRY];
    const isPlanned = (PLANNED_ACTIVITY_KINDS as readonly string[]).includes(kind);
    const fallbackScheme: string | undefined =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fallbackConfig as any)?.appearance?.theme &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fallbackConfig as any).appearance.theme !== "auto"
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (fallbackConfig as any).appearance.theme
        : undefined;
    return (
      <PreviewErrorBoundary resetKey={kind}>
        <Suspense fallback={<PreviewLoading />}>
          <div className="kukui-studio-preview-stale" role="status" aria-live="polite">
            <strong>Form has unresolved errors.</strong> Preview is paused at the last valid
            state. Fix the highlighted fields in the form to resume live updates.
          </div>
          <div
            className="kukui-studio-preview-scheme"
            data-color-scheme={fallbackScheme}
          >
            {isPlanned || !Component ? (
              <Stub config={fallbackConfig} kind={kind as never} onSubmit={() => {}} />
            ) : (
              <Component config={fallbackConfig} onSubmit={() => {}} />
            )}
            {/* Mirror the integrated runtime's credit line so the preview shows
                exactly what learners see at the bottom of the activity. */}
            <ActivityFooter author={(fallbackConfig as { author?: string })?.author} />
            {isLiveActivity(kind) ? (
              <LiveTestLauncher kind={kind} config={fallbackConfig} onChange={onChange} />
            ) : null}
          </div>
        </Suspense>
      </PreviewErrorBoundary>
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

  // If the author has pinned a specific color scheme on this activity
  // (appearance.theme = "dark" | "sepia" | …), render the preview in
  // that scheme so what the author configures is what they see. "auto"
  // (or unset) falls through to the editor's scheme — that's the right
  // default because "follow the learner's OS preference" is meaningful
  // only inside an actual LMS context.
  // The wrapper scopes the data-color-scheme attribute to the preview
  // subtree only; the editor on the left keeps the author's preferred
  // working scheme so they can read the form regardless of what
  // they're packaging.
  const pinnedScheme: string | undefined =
    config?.appearance?.theme && config.appearance.theme !== "auto"
      ? config.appearance.theme
      : undefined;

  return (
    <PreviewErrorBoundary resetKey={kind}>
      <Suspense fallback={<PreviewLoading />}>
        <div
          className="kukui-studio-preview-scheme"
          data-color-scheme={pinnedScheme}
        >
          {isPlanned || !Component ? (
            <Stub config={config} kind={kind as never} onSubmit={noop} />
          ) : kind === "course-presentation" ? (
            // Slide backgrounds live in IndexedDB by assetId; resolve them to
            // object URLs so the Live preview renders imported decks offline.
            <ResolvedDeckPreview Component={Component} config={config} onSubmit={noop} />
          ) : (
            <Component config={config} onSubmit={noop} />
          )}
          {/* Mirror the integrated runtime's credit line so the preview shows
              exactly what learners see at the bottom of the activity. */}
          <ActivityFooter author={(config as { author?: string })?.author} />
          {isLiveActivity(kind) ? (
            <LiveTestLauncher kind={kind} config={config} onChange={onChange} />
          ) : null}
        </div>
      </Suspense>
    </PreviewErrorBoundary>
  );
}

/**
 * Activities that only really make sense with multiple peers, so the
 * single-learner preview can only show their static surface. For these
 * we offer an "Open in Kukui Live" launcher right below the preview so
 * the author can dress-rehearse the multi-peer flow without leaving
 * Studio.
 */
const LIVE_ACTIVITY_KINDS: readonly ActivityKind[] = [
  "straw-poll",
  "confidence-meter",
  "word-cloud",
  "qa-board",
  "quick-quiz",
  // "isometric-chatroom" — hidden from the Live launcher while the
  // runtime is being overhauled. Studio editing still works.
];

function isLiveActivity(kind: ActivityKind): boolean {
  return LIVE_ACTIVITY_KINDS.includes(kind);
}

/**
 * "Test in Kukui Live" launcher. Emits two URL variants:
 *
 *   - **Instructor URL**: `?config=…&adminKey=…` — auto-claims host role
 *     because the URL's adminKey matches `config.live.adminKey`. The
 *     embedded config still includes the admin key so the runtime can
 *     verify the match client-side.
 *   - **Student URL**: `?config=…` only, with `live.adminKey` stripped
 *     from the encoded config so it can't be decoded back to an
 *     instructor URL. Safe to share with anyone.
 *
 * Both URLs open in a new tab pointed at `VITE_LIVE_URL` (defaults to
 * `../live-mode/` — works once both apps are co-deployed; in dev the
 * instructor opens the live-mode dev server directly).
 */
function LiveTestLauncher({
  kind,
  config,
  onChange,
}: {
  kind: ActivityKind;
  config: unknown;
  onChange: (next: unknown) => void;
}) {
  // Resolve where the Live app lives:
  //   - Author can override via VITE_LIVE_URL (e.g., a staging deploy).
  //   - Dev: vite spins live-mode on port 5175; Studio sits on 5174,
  //     so a relative `../live-mode/` resolves to the wrong port.
  //   - Prod (Pages deploy): live-mode is published under `/live/`
  //     alongside Studio at the same origin.
  const env = (import.meta as unknown as { env?: Record<string, string | boolean> }).env ?? {};
  const liveBaseUrl =
    (typeof env.VITE_LIVE_URL === "string" ? env.VITE_LIVE_URL : undefined) ??
    (env.DEV ? "http://localhost:5175/" : "/live/");

  const adminKey = useMemo(() => {
    if (!config || typeof config !== "object") return undefined;
    const live = (config as Record<string, unknown>).live;
    if (!live || typeof live !== "object") return undefined;
    const key = (live as Record<string, unknown>).adminKey;
    return typeof key === "string" && key.length > 0 ? key : undefined;
  }, [config]);

  const buildUrl = (asInstructor: boolean): string => {
    try {
      // P0 hardening: the student URL must never carry the admin key, even
      // base64-encoded inside `config`. Stripping `live.adminKey` before
      // encoding stops a student from decoding the URL and reconstructing
      // an instructor URL. The instructor URL still passes the admin key
      // out-of-band via the `adminKey` query param so host claim works.
      const sanitized = asInstructor ? config : stripAdminKey(config);
      const json = JSON.stringify(sanitized);
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

  /**
   * Replaces the join + admin keys with freshly-generated random
   * values. Calls onChange so the form re-renders + the new keys are
   * what the launcher URLs encode on the next click. Memorable join
   * keys (`adj-noun-NNNN`, ~16M combinations) read nicely if the
   * instructor ever says them out loud; admin keys are 16 hex chars
   * (64-bit entropy — enough to deter casual brute-forcing during a
   * class session).
   */
  const generateKeys = () => {
    const obj = (config && typeof config === "object" ? config : {}) as Record<
      string,
      unknown
    >;
    const live = (obj.live && typeof obj.live === "object" ? obj.live : {}) as Record<
      string,
      unknown
    >;
    onChange({
      ...obj,
      live: {
        ...live,
        joinKey: randomJoinKey(),
        adminKey: randomAdminKey(),
      },
    });
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
        <div className="kukui-studio-live-launch__actions">
          <button
            type="button"
            className="kukui-studio-btn kukui-studio-btn--ghost"
            onClick={generateKeys}
            title="Replace join + admin keys with fresh random values"
          >
            Generate keys
          </button>
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
              No admin key set. Anyone with the student URL could claim host. Set one under{" "}
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

/**
 * Returns a shallow clone of `config` with `live.adminKey` removed. Any
 * student-facing surface that round-trips the config (URL, QR code, copy
 * link, etc.) MUST run through this — otherwise the admin key leaks in
 * cleartext-decodable form.
 */
function stripAdminKey(config: unknown): unknown {
  if (!config || typeof config !== "object") return config;
  const obj = config as Record<string, unknown>;
  const live = obj.live;
  if (!live || typeof live !== "object") return config;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { adminKey: _stripped, ...liveWithoutAdmin } = live as Record<string, unknown>;
  return { ...obj, live: liveWithoutAdmin };
}

/** Base64url (RFC 4648 §5) — `+` → `-`, `/` → `_`, no padding. URL-safe. */
function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const ADJECTIVES = [
  "amber", "blue", "bold", "brave", "bright", "calm", "clear", "clever",
  "coral", "crisp", "fierce", "gentle", "happy", "jade", "kind", "lively",
  "lucky", "merry", "mint", "noble", "olive", "peach", "polar", "quiet",
  "rapid", "rosy", "ruby", "sage", "sharp", "silver", "snowy", "stellar",
  "sunny", "swift", "teal", "tidy", "warm", "wild", "witty", "zesty",
];

const NOUNS = [
  "badger", "bear", "cedar", "cougar", "crane", "dolphin", "eagle", "elk",
  "falcon", "ferret", "fox", "gecko", "hawk", "heron", "ibis", "iguana",
  "jaguar", "kestrel", "koi", "lemur", "lion", "lynx", "marlin", "mongoose",
  "moose", "newt", "otter", "owl", "panda", "puffin", "quokka", "raven",
  "robin", "salmon", "sparrow", "tiger", "turtle", "vulture", "whale", "wolf",
];

/**
 * Memorable join key: `adj-noun-NNNN`. 40 × 40 × 10000 ≈ 16M combinations
 * (~24 bits). Brute-forcing a *specific* room across a 50-min lecture
 * window at ~100 req/s would take ~2 days even with no rate limiting —
 * well outside the threat model for a classroom poll. Still typeable for
 * a student copying off a slide.
 */
function randomJoinKey(): string {
  const pickFrom = (arr: readonly string[]): string =>
    arr[Math.floor(Math.random() * arr.length)] as string;
  const n = Math.floor(Math.random() * 10000);
  return `${pickFrom(ADJECTIVES)}-${pickFrom(NOUNS)}-${n.toString().padStart(4, "0")}`;
}

/** Admin key: 16 hex chars (64-bit entropy from crypto.getRandomValues). */
function randomAdminKey(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
