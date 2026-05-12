import { useEffect, useMemo, useRef, useState } from "react";
import {
  SchemaRegistry,
  type SchemaRegistryKey,
  migrateToScoring,
} from "@kukui/schemas";
import {
  callStructured,
  ChatCompletionsError,
} from "./ai/chat-completions.js";
import { type AISettings, hasUsableSettings, loadSettings } from "./ai/settings.js";
import { STARTERS } from "./starters.js";
import { GearIcon, SparkleIcon } from "./icons.js";

type Mode = "generate" | "edit";

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

/**
 * Per-kind example prompt strings. Surfaces in the textarea placeholder
 * so a first-time author has a concrete starting point that matches the
 * activity they actually picked. The `gen` example is what to type when
 * authoring from scratch; `edit` is what to type when revising an
 * existing draft. Missing kinds fall through to a generic placeholder.
 *
 * Keep these short and clinical/educational — JABSOM is the canonical
 * audience and the system prompts already lean medical-ed.
 */
const PLACEHOLDER_EXAMPLES: Partial<
  Record<SchemaRegistryKey, { gen: string; edit: string }>
> = {
  "multiple-choice": {
    gen: "e.g. USMLE step-1 question on iron-deficiency anemia, 4 options, one correct",
    edit: "e.g. Rewrite the distractors so each tests a specific misconception",
  },
  "fill-in-the-blanks": {
    gen: "e.g. Three sentences on the cardiac cycle with two blanks each",
    edit: "e.g. Make the blanks shorter and accept common misspellings",
  },
  "question-set": {
    gen: "e.g. Six-question set covering acid-base balance, mix of MC and fill-in",
    edit: "e.g. Add two more questions on metabolic acidosis",
  },
  flashcards: {
    gen: "e.g. 12 Q/A flashcards on common ECG findings — prompt on front, answer on back",
    edit: "e.g. Add 3 more Q/A cards covering atrial fibrillation",
  },
  "matching-pairs": {
    gen: "e.g. Antibiotic class on the left, mechanism of action on the right, 6 pairs",
    edit: "e.g. Swap the left/right columns and add 2 more pairs",
  },
  "drag-and-drop": {
    gen: "e.g. Labels for the organelles, drop zones over a plant-cell diagram",
    edit: "e.g. Rename the labels to use more clinical language",
  },
  "sequence-steps": {
    gen: "e.g. The 7 steps of an arterial blood-gas draw, in order",
    edit: "e.g. Add a step for waste disposal at the end",
  },
  categorization: {
    gen: "e.g. Sort 10 lab values into 'normal', 'elevated', or 'low' bins",
    edit: "e.g. Add three more items to the 'elevated' bin",
  },
  "anatomy-labeling": {
    gen: "e.g. Labels for the six major branches of the abdominal aorta",
    edit: "e.g. Replace the labels with arterial-supply territories",
  },
  "image-comparison-slider": {
    gen: "e.g. Healthy vs fractured wrist X-ray with a draggable seam",
    edit: "e.g. Update the captions to highlight the fracture line",
  },
  "image-annotation": {
    gen: "e.g. Chest X-ray with three expected pathology regions marked",
    edit: "e.g. Add a fourth expected region for the lung hilum",
  },
  "highlight-text": {
    gen: "e.g. SOAP note paragraph; learner highlights all subjective findings",
    edit: "e.g. Make the prompt more clinical and add a second sentence",
  },
  "reflection-prompt": {
    gen: "e.g. End-of-rotation reflection on a memorable patient encounter, 150 word min",
    edit: "e.g. Reword the prompt to focus on team dynamics instead",
  },
  "branching-scenario": {
    gen: "e.g. Triage scenario — 5 nodes, 2 terminal outcomes, chest-pain patient",
    edit: "e.g. Add a wrong-turn branch that ends in a missed STEMI",
  },
  "ddx-tree": {
    gen: "e.g. Differential for new-onset dyspnea in an adult — 4 branches, 3 diagnoses",
    edit: "e.g. Make the PE branch require an ABG before terminating",
  },
  osce: {
    gen: "e.g. 3-phase OSCE encounter for acute abdominal pain — History → Exam → Plan",
    edit: "e.g. Add an anti-guess penalty and tighten the expected-action list",
  },
  "lab-panel": {
    gen: "e.g. Basic metabolic panel with hyponatremia, learner flags abnormals + picks interpretation",
    edit: "e.g. Swap in hyperkalemia values and update the interpretation choices",
  },
  "concept-map": {
    gen: "e.g. Concept map of the RAAS pathway — 6 nodes, 5 directed edges",
    edit: "e.g. Add aldosterone as a node and connect it to sodium reabsorption",
  },
  "interactive-video": {
    gen: "e.g. 2-min cardiac auscultation video with 3 timed multiple-choice interactions",
    edit: "e.g. Move the second interaction earlier and make it a fill-in-the-blank",
  },
  "audio-recording": {
    gen: "e.g. Spanish-language H&P intro practice, 30–60 second clip",
    edit: "e.g. Replace the reference audio with a slower-paced version",
  },
  "hotspot-2d": {
    gen: "e.g. Click the mitral valve on a labeled heart diagram",
    edit: "e.g. Add a distractor region over the tricuspid valve",
  },
  "hotspot-3d": {
    gen: "e.g. Pick the SA node on a 3D model of the cardiac conduction system",
    edit: "e.g. Tighten the correct-region tolerance",
  },
  "virtual-tour": {
    gen: "e.g. Virtual tour of an ICU bay with 4 clickable overlays — monitor, vent, IV pole, bed",
    edit: "e.g. Add a fifth overlay over the crash cart",
  },
  crossword: {
    gen: "e.g. 8-term crossword on cardiology vocabulary — chamber names, vessels, and conduction-system structures",
    edit: "e.g. Replace two of the simpler terms with pathology vocabulary like 'stenosis' and 'aneurysm'",
  },
  "straw-poll": {
    gen: "e.g. End-of-lecture confidence check with 4 levels from 'could teach it back' to 'need a re-teach'",
    edit: "e.g. Replace the middle two options with more specific gap descriptors",
  },
};

function getPlaceholder(kind: SchemaRegistryKey, mode: Mode): string {
  const hint = PLACEHOLDER_EXAMPLES[kind];
  if (!hint) {
    return mode === "generate"
      ? "Describe what you want me to write."
      : "Describe what should change.";
  }
  return mode === "generate" ? hint.gen : hint.edit;
}

export function AIEditor({
  kind,
  value,
  onChange,
  isDirty,
  onOpenSettings,
  settingsVersion = 0,
}: {
  kind: SchemaRegistryKey;
  value: unknown;
  onChange: (next: unknown) => void;
  /**
   * Whether the current activity has diverged from STARTERS[kind]. App.tsx
   * owns this — flipped true on any mutation, reset on kind change / reset.
   * Drives generate-vs-edit inference without a per-render deep compare.
   */
  isDirty: boolean;
  onOpenSettings: () => void;
  /**
   * Monotonically incremented by App.tsx whenever the AI settings dialog
   * saves or clears. Forces this component to re-read settings without a
   * page reload — fixes the "applying AI settings results in no user
   * feedback" bug.
   */
  settingsVersion?: number;
}) {
  const [settings, setSettings] = useState<AISettings>(() => loadSettings());
  const [prompt, setPrompt] = useState("");
  // The internal mode for the next request is inferred from whether the
  // form value has been touched since the activity was loaded. Authors
  // don't see modes — the input is "describe what you want" and Send
  // figures out whether that means "generate new" (clean starter) or
  // "revise current" (dirty).
  const inferredMode: Mode = isDirty ? "edit" : "generate";
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

  // Re-read settings whenever this tab mounts, the kind switches, or the
  // settings dialog reports a save (settingsVersion bump). Without the
  // version dep, applying a new API key requires a page reload before the
  // AI Assist UI flips out of the empty state (issue #1).
  useEffect(() => {
    setSettings(loadSettings());
  }, [kind, settingsVersion]);

  const usable = hasUsableSettings(settings);

  // Clear any in-flight response state when the author switches to a
  // different activity — stale "applied" banners or errors from a previous
  // kind would be confusing against the new form.
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
    proposedRaw: unknown,
    raw: string,
  ) => {
    // Normalize the LLM's output to the new scoring shape. The model
    // tends to produce the pre-Scoring-tab shape (singlePoint etc.)
    // because the samples it was prompted with use the old shape; the
    // migrator runs idempotently so already-new-shape output passes
    // through unchanged.
    const proposed = migrateToScoring(proposedRaw, kind);
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
  const sendLabel = inferredMode === "generate" ? "Create" : "Apply changes";
  const fieldLabel =
    inferredMode === "generate" ? "What should it be about?" : "What should change?";
  const placeholder = getPlaceholder(kind, inferredMode);

  return (
    <div className="kukui-studio-ai">
      <label className="kukui-studio-ai__field">
        <span className="kukui-studio-ai__label">{fieldLabel}</span>
        <textarea
          className="kukui-studio-ai__textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholder}
        />
      </label>

      <div className="kukui-studio-ai__row">
        <div className="kukui-studio-ai__primary-group">
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
            <span>{isPending ? "Working…" : sendLabel}</span>
          </button>
          <button
            type="button"
            className="kukui-studio-ai__icon-btn"
            onClick={onOpenSettings}
            title="AI editor settings"
            aria-label="AI editor settings"
          >
            <GearIcon />
          </button>
        </div>
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

    </div>
  );
}
