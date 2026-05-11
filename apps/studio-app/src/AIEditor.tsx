import { useEffect, useMemo, useRef, useState } from "react";
import { SchemaRegistry, type SchemaRegistryKey } from "@kukui/schemas";
import {
  callFreeText,
  callStructured,
  ChatCompletionsError,
} from "./ai/chat-completions.js";
import { type AISettings, hasUsableSettings, loadSettings } from "./ai/settings.js";
import { STARTERS } from "./starters.js";
import { SparkleIcon } from "./icons.js";

type Mode = "generate" | "edit" | "explain";

type ResponseState =
  | { kind: "none" }
  | { kind: "pending" }
  | {
      // Edit-mode change exceeded the destructive threshold — wait for
      // explicit confirmation before mutating the form value.
      kind: "confirming";
      proposed: unknown;
      summary: string;
      raw: string;
      changeRatio: number;
    }
  | {
      // Auto-applied: form value already swapped, banner shows what
      // happened with an Undo affordance. previousValue holds the
      // pre-AI state so Undo can restore it.
      kind: "applied";
      previousValue: unknown;
      summary: string;
      raw: string;
      appliedAt: number;
    }
  | { kind: "text"; text: string; timestamp: number }
  | { kind: "error"; code: ChatCompletionsError["code"]; message: string };

/**
 * Plain-English summary of top-level field changes for the applied
 * banner. Walks top-level keys only — deeper diffs fold into "Updated".
 */
function summariseChanges(before: unknown, after: unknown): string {
  if (!isPlainObject(before) || !isPlainObject(after)) {
    return "Replaced the entire activity.";
  }
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (!(k in before)) added.push(k);
    else if (!(k in after)) removed.push(k);
    else if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changed.push(k);
  }
  const parts: string[] = [];
  if (added.length) parts.push(`Added: ${added.join(", ")}`);
  if (removed.length) parts.push(`Removed: ${removed.join(", ")}`);
  if (changed.length) parts.push(`Updated: ${changed.join(", ")}`);
  return parts.length ? parts.join(" · ") : "No top-level fields changed.";
}

/**
 * Rough "how destructive is this edit?" heuristic. Returns 0..1 where
 * 1 means the proposal replaced everything. Counts a top-level key as
 * "changed" if its JSON-stringified value differs from before. Doesn't
 * recurse — fine for guardrail purposes since we're trying to catch
 * "you're about to nuke the whole activity," not measure deep diffs.
 */
function changeRatio(before: unknown, after: unknown): number {
  if (!isPlainObject(before) || !isPlainObject(after)) return 1;
  const beforeKeys = Object.keys(before);
  if (beforeKeys.length === 0) return 0;
  let changed = 0;
  for (const k of beforeKeys) {
    if (!(k in after)) {
      changed += 1;
      continue;
    }
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changed += 1;
  }
  return changed / beforeKeys.length;
}

const DESTRUCTIVE_THRESHOLD = 0.5;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Two surface labels left for the single-input model. The internal Mode
// is still tracked so the prompt-builder knows whether to include the
// current activity JSON (edit) or treat the prompt as a from-scratch
// description (generate). Inferred from value-vs-starter; the user
// doesn't see modes.
const MODE_HINTS: Record<Mode, string> = {
  generate:
    "Generate a new activity from a short description. Replaces your current draft. (Undo available right after.)",
  edit: "Revise the current activity based on your prompt. Preserves anything you didn't ask to change. Big rewrites ask for confirmation first.",
  explain:
    "Read-only summary of the current activity. Doesn't change anything.",
};

export function AIEditor({
  kind,
  value,
  onChange,
  onOpenSettings,
}: {
  kind: SchemaRegistryKey;
  value: unknown;
  onChange: (next: unknown) => void;
  onOpenSettings: () => void;
}) {
  const [settings, setSettings] = useState<AISettings>(() => loadSettings());
  const [prompt, setPrompt] = useState("");
  // The internal mode for the next request is inferred from whether the
  // form value differs from the starter. Authors don't see modes — the
  // input is "describe what you want" and Send figures out whether that
  // means "generate new" or "revise current." Explain is a separate
  // button that bypasses this and forces read-only.
  const inferredMode: Mode = useMemo(
    () =>
      JSON.stringify(value) === JSON.stringify(STARTERS[kind])
        ? "generate"
        : "edit",
    [value, kind],
  );
  const [response, setResponse] = useState<ResponseState>({ kind: "none" });
  const [showDetails, setShowDetails] = useState(false);
  // Latest "applied" banner needs to know whether to render full vs.
  // collapsed pill. Flips after 30s; resets when a new response lands.
  const [bannerCollapsed, setBannerCollapsed] = useState(false);

  // Always keep the LATEST onChange in a ref so the applied-state
  // closure in handleSuccessfulProposal isn't stale across renders.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Re-read settings whenever this tab mounts — the settings dialog might
  // have written new ones while we weren't visible.
  useEffect(() => {
    setSettings(loadSettings());
  }, [kind]);

  const usable = hasUsableSettings(settings);

  // Default mode tracks the activity's "is starter?" status whenever kind
  // flips. Doesn't reset if the user has manually picked a mode for this
  // session (kept simple — small UX cost).
  useEffect(() => {
    setResponse({ kind: "none" });
  }, [kind]);

  const tokenEstimate = useMemo(
    () =>
      Math.max(1, Math.ceil((prompt.length + (inferredMode !== "generate" ? JSON.stringify(value).length : 0)) / 4)),
    [prompt, inferredMode, value],
  );

  /**
   * Apply-then-undo flow: when a valid proposal lands, either swap it in
   * immediately (most edits) or pause for confirm (destructive ones,
   * Edit mode only — Generate always replaces so confirming there is
   * just noise).
   */
  const finalizeProposal = (
    activeMode: Mode,
    baseline: unknown,
    proposed: unknown,
    raw: string,
  ) => {
    const summary = summariseChanges(baseline, proposed);
    const ratio = changeRatio(baseline, proposed);
    if (activeMode === "edit" && ratio >= DESTRUCTIVE_THRESHOLD) {
      setResponse({
        kind: "confirming",
        proposed,
        summary,
        raw,
        changeRatio: ratio,
      });
      return;
    }
    onChangeRef.current(proposed);
    setBannerCollapsed(false);
    setResponse({
      kind: "applied",
      previousValue: value,
      summary,
      raw,
      appliedAt: Date.now(),
    });
  };

  const confirmDestructive = () => {
    if (response.kind !== "confirming") return;
    onChangeRef.current(response.proposed);
    setBannerCollapsed(false);
    setResponse({
      kind: "applied",
      previousValue: value,
      summary: response.summary,
      raw: response.raw,
      appliedAt: Date.now(),
    });
  };

  const cancelDestructive = () => {
    if (response.kind !== "confirming") return;
    setResponse({ kind: "none" });
  };

  const undoLastApplied = () => {
    if (response.kind !== "applied") return;
    onChangeRef.current(response.previousValue);
    setResponse({ kind: "none" });
  };

  const tryAnotherPrompt = () => {
    setResponse({ kind: "none" });
    setPrompt("");
  };

  // Banner auto-collapses to a pill after 30s; new responses reset it.
  useEffect(() => {
    if (response.kind !== "applied") return;
    const id = window.setTimeout(() => setBannerCollapsed(true), 30000);
    return () => window.clearTimeout(id);
  }, [response.kind, "appliedAt" in response ? response.appliedAt : 0]);

  const handleGenerate = async (modeOverride?: Mode) => {
    if (!usable) {
      onOpenSettings();
      return;
    }
    if (!prompt.trim()) return;
    const activeMode: Mode = modeOverride ?? inferredMode;
    setResponse({ kind: "pending" });

    try {
      if (activeMode === "explain") {
        const text = await callFreeText({
          kind,
          settings,
          userPrompt: prompt,
          currentJson: value,
        });
        setResponse({ kind: "text", text, timestamp: Date.now() });
        return;
      }

      const includeCurrent = activeMode === "edit";
      const result = await callStructured({
        kind,
        settings,
        userPrompt: prompt,
        currentJson: includeCurrent ? value : undefined,
      });
      setSettings(result.nextSettings);

      // Zod-validate the model's output against the canonical schema.
      const validation = SchemaRegistry[kind].safeParse(result.json);
      if (!validation.success) {
        // Automatic one-shot retry with the Zod error fed back to the model.
        const issue = validation.error.issues[0];
        const refinement = `Your previous output failed validation: ${(issue?.path ?? []).join(".") || "(root)"}: ${issue?.message ?? "schema mismatch"}. Please correct ONLY that field; preserve everything else.`;
        try {
          const retry = await callStructured({
            kind,
            settings: result.nextSettings,
            userPrompt: prompt,
            currentJson: includeCurrent ? value : undefined,
            refinement,
          });
          const retryValid = SchemaRegistry[kind].safeParse(retry.json);
          if (retryValid.success) {
            setSettings(retry.nextSettings);
            const baseline = includeCurrent ? value : STARTERS[kind];
            finalizeProposal(
              activeMode,
              baseline,
              retryValid.data,
              JSON.stringify(retry.json, null, 2),
            );
            return;
          }
          setResponse({
            kind: "error",
            code: "schema-rejected",
            message: `Model output failed validation twice. Last error: ${retryValid.error.issues[0]?.message ?? "unknown"}. Try rephrasing or pick a stronger model.`,
          });
          return;
        } catch (err) {
          setResponse({
            kind: "error",
            code: err instanceof ChatCompletionsError ? err.code : "server",
            message:
              err instanceof Error
                ? err.message
                : "Retry failed.",
          });
          return;
        }
      }

      const baseline = includeCurrent ? value : STARTERS[kind];
      finalizeProposal(
        activeMode,
        baseline,
        validation.data,
        JSON.stringify(result.json, null, 2),
      );
    } catch (err) {
      setResponse({
        kind: "error",
        code: err instanceof ChatCompletionsError ? err.code : "server",
        message:
          err instanceof ChatCompletionsError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Something went wrong.",
      });
    }
  };

  const refineFromApplied = async () => {
    if (response.kind !== "applied") return;
    // Treat "Refine" from the applied banner as: re-run the same prompt
    // against the newly-applied JSON as the new baseline. The model gets
    // a chance to iterate without the user re-typing.
    if (!prompt.trim()) return;
    const baseline = value;
    setResponse({ kind: "pending" });
    try {
      const result = await callStructured({
        kind,
        settings,
        userPrompt: prompt,
        currentJson: baseline,
        refinement: "Please refine the previous output further based on the same request.",
      });
      setSettings(result.nextSettings);
      const validation = SchemaRegistry[kind].safeParse(result.json);
      if (!validation.success) {
        setResponse({
          kind: "error",
          code: "schema-rejected",
          message: `Refinement failed validation: ${validation.error.issues[0]?.message ?? "unknown"}.`,
        });
        return;
      }
      // Refine always runs against the current activity (we apply first,
      // then iterate), so it's an edit by definition.
      finalizeProposal("edit", baseline, validation.data, JSON.stringify(result.json, null, 2));
    } catch (err) {
      setResponse({
        kind: "error",
        code: err instanceof ChatCompletionsError ? err.code : "server",
        message:
          err instanceof Error ? err.message : "Refine failed.",
      });
    }
  };

  const discard = () => {
    setResponse({ kind: "none" });
  };

  if (!usable) {
    return (
      <div className="kukui-studio-ai">
        <div className="kukui-studio-ai__empty">
          <h2 className="kukui-studio-ai__empty-title">AI editor isn't configured yet</h2>
          <p className="kukui-studio-ai__empty-body">
            Kukui Studio runs entirely in your browser, so we don't ship a shared key — every
            author brings their own. Open settings to point Studio at OpenAI, Groq, Together,
            OpenRouter, Anthropic, Azure OpenAI, or your institution's internal proxy. Your key
            stays in this browser only.
          </p>
          <button
            type="button"
            className="kukui-studio-btn kukui-studio-btn--primary"
            onClick={onOpenSettings}
          >
            <SparkleIcon />
            <span>Open AI settings</span>
          </button>
        </div>
      </div>
    );
  }

  const isPending = response.kind === "pending";
  const sendLabel =
    inferredMode === "generate" ? "Generate activity" : "Apply changes";
  const sendHint =
    inferredMode === "generate"
      ? "Send writes a new activity from your description."
      : "Send revises your current activity. Big rewrites ask to confirm first.";

  return (
    <div className="kukui-studio-ai">
      <p className="kukui-studio-ai__meta">{sendHint} You can also ask the AI to just explain what's there without changing anything.</p>

      <label className="kukui-studio-ai__field">
        <span className="kukui-studio-ai__label">
          Describe what you want
        </span>
        <textarea
          className="kukui-studio-ai__textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            inferredMode === "generate"
              ? "e.g. Multiple choice on iron-deficiency anemia, 4 options, USMLE step-1"
              : "e.g. Rewrite the distractors as specific misconceptions"
          }
        />
      </label>

      <div className="kukui-studio-ai__row">
        <button
          type="button"
          className="kukui-studio-btn kukui-studio-btn--primary"
          onClick={() => handleGenerate()}
          disabled={isPending || prompt.trim().length === 0}
        >
          {isPending ? (
            <span className="kukui-studio-ai__spinner" aria-hidden="true" />
          ) : (
            <SparkleIcon />
          )}
          <span>{isPending ? "Generating…" : sendLabel}</span>
        </button>
        <button
          type="button"
          className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
          onClick={() => handleGenerate("explain")}
          disabled={isPending || prompt.trim().length === 0}
          title="Read-only: returns a plain-English explanation. Doesn't change your activity."
        >
          Just explain
        </button>
        <button
          type="button"
          className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
          onClick={onOpenSettings}
          title="AI editor settings"
        >
          Settings
        </button>
        <div className="kukui-studio-ai__meta">
          <span>{settings.model}</span>
          <span className="kukui-studio-ai__meta-sep">·</span>
          <span>~{tokenEstimate} tokens</span>
        </div>
      </div>

      {response.kind === "pending" ? (
        <div
          className="kukui-studio-ai__progress"
          role="status"
          aria-live="polite"
        >
          <span className="kukui-studio-ai__spinner kukui-studio-ai__spinner--lg" aria-hidden="true" />
          <div className="kukui-studio-ai__progress-text">
            <strong>Generating with {settings.model}…</strong>
            <span className="kukui-studio-ai__progress-sub">
              This usually takes 5–15 seconds. Larger schemas may take longer.
            </span>
          </div>
        </div>
      ) : null}

      {response.kind === "error" ? (
        <div className="kukui-studio-ai__error" role="alert">
          {response.message}
          {response.code === "unauthorized" ? (
            <>
              {" "}
              <button
                type="button"
                className="kukui-studio-footer__btn"
                onClick={onOpenSettings}
              >
                Open settings
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {response.kind === "confirming" ? (
        <div className="kukui-studio-ai__confirm" role="alertdialog" aria-labelledby="kukui-ai-confirm-title">
          <h3 id="kukui-ai-confirm-title" className="kukui-studio-ai__confirm-title">
            This is a big rewrite — apply it?
          </h3>
          <p className="kukui-studio-ai__confirm-body">
            About {Math.round(response.changeRatio * 100)}% of your activity's top-level
            fields would change ({response.summary}). Anything you didn't ask the AI to
            touch will be replaced too. You can undo right after applying.
          </p>
          <div className="kukui-studio-ai__card-actions">
            <button
              type="button"
              className="kukui-studio-btn kukui-studio-btn--primary"
              onClick={confirmDestructive}
            >
              Apply changes
            </button>
            <button
              type="button"
              className="kukui-studio-btn kukui-studio-btn--ghost"
              onClick={cancelDestructive}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {response.kind === "applied" ? (
        <div
          className={[
            "kukui-studio-ai__banner",
            bannerCollapsed ? "kukui-studio-ai__banner--collapsed" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          role="status"
          aria-live="polite"
        >
          {bannerCollapsed ? (
            <button
              type="button"
              className="kukui-studio-ai__banner-pill"
              onClick={undoLastApplied}
              title="Undo the last AI change"
            >
              <span aria-hidden="true">↶</span>
              <span>Undo last AI change</span>
            </button>
          ) : (
            <>
              <div className="kukui-studio-ai__banner-text">
                <strong>
                  <span aria-hidden="true">✓</span> Applied to your activity
                </strong>
                <span className="kukui-studio-ai__banner-summary">{response.summary}</span>
              </div>
              <div className="kukui-studio-ai__banner-actions">
                <button
                  type="button"
                  className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
                  onClick={undoLastApplied}
                >
                  Undo
                </button>
                <button
                  type="button"
                  className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
                  onClick={refineFromApplied}
                  disabled={!prompt.trim()}
                  title={
                    prompt.trim()
                      ? "Re-run the same prompt against the new baseline"
                      : "Type a follow-up prompt to refine"
                  }
                >
                  Refine
                </button>
                <button
                  type="button"
                  className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
                  onClick={tryAnotherPrompt}
                >
                  Try another prompt
                </button>
              </div>
              <details
                className="kukui-studio-ai__details"
                open={showDetails}
                onToggle={(e) => setShowDetails(e.currentTarget.open)}
              >
                <summary>Show technical details</summary>
                <pre className="kukui-studio-ai__details-body">{response.raw}</pre>
              </details>
            </>
          )}
        </div>
      ) : null}

      {response.kind === "text" ? (
        <div className="kukui-studio-ai__card">
          <h3 className="kukui-studio-ai__card-title">Explanation</h3>
          <div className="kukui-studio-ai__card-body kukui-studio-ai__card-body--text">
            {response.text}
          </div>
          <div className="kukui-studio-ai__card-actions">
            <button
              type="button"
              className="kukui-studio-btn kukui-studio-btn--ghost"
              onClick={discard}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
