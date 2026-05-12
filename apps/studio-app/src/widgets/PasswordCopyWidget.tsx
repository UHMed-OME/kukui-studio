import { useState } from "react";
import type { WidgetProps } from "@rjsf/utils";

/**
 * Password-style field that hides its value by default (so the admin
 * key doesn't get shoulder-surfed during a screen-share) but exposes
 * Show / Hide + Copy affordances. Used for the live-activity
 * join + admin keys so they sit at the top of the form without
 * broadcasting their values to passers-by.
 *
 * Behaves like a normal RJSF text widget for typing — RJSF's
 * `onChange` fires on every keystroke just like a regular input.
 */
export function PasswordCopyWidget(props: WidgetProps) {
  const { id, value, onChange, disabled, readonly, placeholder, options } = props;
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const stringValue = typeof value === "string" ? value : "";
  const labelHint =
    (options?.copyHint as string | undefined) ?? "Copy to clipboard";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(stringValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked (insecure context, private mode) — silently
         drop. The Show toggle still lets the author read + copy by
         hand. */
    }
  };

  return (
    <div className="ks-password-field">
      <input
        id={id}
        type={visible ? "text" : "password"}
        className="ks-password-field__input"
        value={stringValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        readOnly={readonly}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        className="ks-password-field__btn"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide value" : "Reveal value"}
        title={visible ? "Hide value" : "Reveal value"}
      >
        {visible ? "Hide" : "Show"}
      </button>
      <button
        type="button"
        className="ks-password-field__btn"
        onClick={copy}
        disabled={stringValue.length === 0}
        aria-label={labelHint}
        title={labelHint}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
