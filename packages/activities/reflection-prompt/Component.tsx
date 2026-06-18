import { useEffect, useId, useMemo, useState } from "react";
import type { ReflectionPromptConfig } from "./schema.js";
import type { ActivityProps } from "@kukui/core/types";
import { ActivityHeader, SafeHtml, StatusBadge, DotIcon, CheckIcon } from "@kukui/core";
import "./Component.css";

type Stage = "writing" | "submitted";

/**
 * Default character cap. Plain prose at this length LZ-compresses to well
 * under SCORM 1.2's 4096-char `cmi.suspend_data` ceiling (even worst-case
 * incompressible text stays within budget), so a reflection up to this size
 * always survives a save/resume round-trip. Authors can override via
 * `config.maxChars`.
 */
const DEFAULT_MAX_CHARS = 4000;

type State = {
  stage: Stage;
  text: string;
};

/**
 * Counts whitespace-delimited words in a string. Defensive: empty / whitespace
 * only → 0, never 1 (the naive `split(/\s+/).length` returns 1 for "").
 */
function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function parseSuspend(s: string | undefined): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State> & { text?: unknown };
    if (parsed && typeof parsed.text === "string") {
      return {
        stage: parsed.stage === "submitted" ? "submitted" : "writing",
        text: parsed.text,
      };
    }
  } catch {
    /* noop */
  }
  return null;
}

function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<ReflectionPromptConfig>) {
  const [state, setState] = useState<State>(
    () => parseSuspend(suspendData) ?? { stage: "writing", text: "" },
  );

  const headingId = useId();
  const textareaId = useId();
  const wordCountId = useId();

  // Reset local state when `config` changes externally (Studio Preview edit,
  // AI Accept, draft load, etc.). Reference equality on the `config` prop —
  // engine context loads JSON once and never mutates the ref, so this only
  // fires in Studio Preview. Replaces the now-removed JSON.stringify(value)
  // remount key.
  useEffect(() => {
    setState(parseSuspend(suspendData) ?? { stage: "writing", text: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const minWords = config.minWords ?? 0;
  const maxChars = config.maxChars ?? DEFAULT_MAX_CHARS;
  const placeholder = config.placeholder ?? "";
  const submitLabel = config.ui?.submitButtonLabel ?? "Submit";

  const wordCount = useMemo(() => countWords(state.text), [state.text]);
  const meetsMin = wordCount >= minWords;
  // Surface the character budget only as the learner approaches it, so short
  // reflections see an uncluttered field. The textarea's `maxLength` hard-caps
  // input at `maxChars`, so the limit can be reached but never exceeded.
  const charsUsed = state.text.length;
  const nearCharLimit = charsUsed >= maxChars * 0.85;
  const atCharLimit = charsUsed >= maxChars;

  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  const submitted = state.stage === "submitted";

  const headerBadge = submitted ? (
    <StatusBadge tone="success" icon={<CheckIcon />}>
      Complete
    </StatusBadge>
  ) : (
    <StatusBadge tone="neutral" icon={<DotIcon />}>
      In progress
    </StatusBadge>
  );

  const handleChange = (value: string) => {
    if (submitted) return;
    setState((s) => ({ ...s, text: value }));
  };

  const submit = () => {
    if (submitted) return;
    if (!meetsMin) return;
    const next: State = { stage: "submitted", text: state.text };
    setState(next);
    onSubmit({
      raw: 1,
      max: 1,
      success: true,
      suspendData: JSON.stringify({ text: next.text }),
    });
  };

  return (
    <div className="kukui-rp">
      <article className="kukui-rp__card" aria-labelledby={headingId}>
        <ActivityHeader
          title={config.title}
          titleId={headingId}
          headingLevel={headingLevel}
          variant={config.appearance?.header ?? "full"}
          prompt={config.prompt ? <SafeHtml html={config.prompt} /> : undefined}
          badge={headerBadge}
        />

        <label className="kukui-rp__sr-only" htmlFor={textareaId}>
          Your reflection
        </label>
        <textarea
          id={textareaId}
          className="kukui-rp__textarea"
          value={state.text}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          readOnly={submitted}
          disabled={submitted}
          maxLength={maxChars}
          aria-describedby={wordCountId}
          aria-label="Your reflection"
        />

        <div
          id={wordCountId}
          className="kukui-rp__wordcount"
          role="status"
          aria-live="polite"
        >
          <span className="kukui-rp__wordcount-current">
            {wordCount} {wordCount === 1 ? "word" : "words"}
          </span>
          {minWords > 0 ? (
            <span className="kukui-rp__wordcount-min">
              {" "}
              (min: {minWords} words)
            </span>
          ) : null}
          {nearCharLimit ? (
            <span
              className={[
                "kukui-rp__charcount",
                atCharLimit ? "is-limit" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {" · "}
              {charsUsed} / {maxChars} characters
              {atCharLimit ? " (limit reached)" : ""}
            </span>
          ) : null}
        </div>

        <div
          className={[
            "kukui-rp__confirmation",
            submitted ? "is-visible" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          role="status"
          aria-live="polite"
        >
          {submitted ? "Reflection submitted" : ""}
        </div>

        <div className="kukui-rp__actions">
          <button
            type="button"
            className="kukui-rp__primary"
            disabled={submitted || !meetsMin}
            onClick={submit}
          >
            {submitLabel}
          </button>
        </div>
      </article>
    </div>
  );
}

export default Component;
