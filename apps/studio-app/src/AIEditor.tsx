import { useEffect, useMemo, useState } from "react";
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
      kind: "structured";
      summary: string;
      proposed: unknown;
      raw: string;
      timestamp: number;
    }
  | { kind: "text"; text: string; timestamp: number }
  | { kind: "error"; code: ChatCompletionsError["code"]; message: string };

/**
 * Diffable summary of what the model proposes to change. Walks top-level
 * keys only — anything deeper folds into "modified". Good enough for the
 * "Proposed changes" card; the user clicks Accept to see the full result
 * via the form / JSON tabs.
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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const MODE_LABELS: Record<Mode, string> = {
  generate: "Generate",
  edit: "Edit existing",
  explain: "Explain",
};

const MODE_HINTS: Record<Mode, string> = {
  generate:
    "Generate a new activity from a short description. Overwrites the current value when you accept.",
  edit: "Revise the current JSON based on your prompt. Preserves fields you didn't ask to change.",
  explain:
    "Read-only summary of the current activity. Doesn't change the form value.",
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
  const [mode, setMode] = useState<Mode>(() =>
    JSON.stringify(value) === JSON.stringify(STARTERS[kind]) ? "generate" : "edit",
  );
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<ResponseState>({ kind: "none" });

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
      Math.max(1, Math.ceil((prompt.length + (mode !== "generate" ? JSON.stringify(value).length : 0)) / 4)),
    [prompt, mode, value],
  );

  const handleGenerate = async () => {
    if (!usable) {
      onOpenSettings();
      return;
    }
    if (!prompt.trim()) return;
    setResponse({ kind: "pending" });

    try {
      if (mode === "explain") {
        const text = await callFreeText({
          kind,
          settings,
          userPrompt: prompt,
          currentJson: value,
        });
        setResponse({ kind: "text", text, timestamp: Date.now() });
        return;
      }

      const includeCurrent = mode === "edit";
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
            setResponse({
              kind: "structured",
              proposed: retryValid.data,
              raw: JSON.stringify(retry.json, null, 2),
              summary: summariseChanges(includeCurrent ? value : STARTERS[kind], retryValid.data),
              timestamp: Date.now(),
            });
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

      setResponse({
        kind: "structured",
        proposed: validation.data,
        raw: JSON.stringify(result.json, null, 2),
        summary: summariseChanges(includeCurrent ? value : STARTERS[kind], validation.data),
        timestamp: Date.now(),
      });
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

  const accept = () => {
    if (response.kind !== "structured") return;
    onChange(response.proposed);
    setResponse({ kind: "none" });
    setPrompt("");
  };

  const refine = async () => {
    if (response.kind !== "structured") return;
    // Re-prompt with the existing prompt + a follow-up the user types.
    // For v1 (single-shot refine without a dedicated follow-up textarea)
    // we just re-run the same prompt against the model's last output as
    // the new "current JSON" — gives the model a chance to iterate.
    const userPrompt = prompt;
    const baseline = response.proposed;
    setResponse({ kind: "pending" });
    try {
      const result = await callStructured({
        kind,
        settings,
        userPrompt,
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
      setResponse({
        kind: "structured",
        proposed: validation.data,
        raw: JSON.stringify(result.json, null, 2),
        summary: summariseChanges(baseline, validation.data),
        timestamp: Date.now(),
      });
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

  return (
    <div className="kukui-studio-ai">
      <div className="kukui-studio-ai__modes" role="radiogroup" aria-label="Mode">
        {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            className={[
              "kukui-studio-ai__mode-btn",
              mode === m ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setMode(m)}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <p className="kukui-studio-ai__meta">{MODE_HINTS[mode]}</p>

      <label className="kukui-studio-ai__field">
        <span className="kukui-studio-ai__label">
          {mode === "explain"
            ? "What do you want explained?"
            : mode === "edit"
              ? "What should change?"
              : "Describe the activity you want."}
        </span>
        <textarea
          className="kukui-studio-ai__textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            mode === "generate"
              ? "e.g. Multiple choice on iron-deficiency anemia, 4 options, USMLE step-1"
              : mode === "edit"
                ? "e.g. Rewrite distractors as specific misconceptions"
                : "e.g. What learning objective is this activity testing?"
          }
        />
      </label>

      <div className="kukui-studio-ai__row">
        <button
          type="button"
          className="kukui-studio-btn kukui-studio-btn--primary"
          onClick={handleGenerate}
          disabled={
            response.kind === "pending" || prompt.trim().length === 0
          }
        >
          {response.kind === "pending" ? (
            <span
              className="kukui-studio-ai__spinner"
              aria-hidden="true"
            />
          ) : (
            <SparkleIcon />
          )}
          <span>{response.kind === "pending" ? "Generating…" : mode === "explain" ? "Explain" : "Generate"}</span>
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

      {response.kind === "structured" ? (
        <div className="kukui-studio-ai__card">
          <h3 className="kukui-studio-ai__card-title">Proposed changes</h3>
          <p className="kukui-studio-ai__meta">{response.summary}</p>
          <pre className="kukui-studio-ai__card-body">{response.raw}</pre>
          <div className="kukui-studio-ai__card-actions">
            <button
              type="button"
              className="kukui-studio-btn kukui-studio-btn--primary"
              onClick={accept}
            >
              Accept
            </button>
            <button
              type="button"
              className="kukui-studio-btn kukui-studio-btn--ghost"
              onClick={refine}
            >
              Refine
            </button>
            <button
              type="button"
              className="kukui-studio-btn kukui-studio-btn--ghost"
              onClick={discard}
            >
              Discard
            </button>
          </div>
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
