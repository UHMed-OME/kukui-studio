import { useEffect, useRef, useState, type ReactNode } from "react";
import { PencilIcon } from "../icons.js";

/**
 * Hover-to-edit inline field for the visual editors. A value renders read-only
 * on the canvas; hovering (or keyboard-focusing) the row reveals a pencil
 * button; activating it swaps the value for an inline input that commits on
 * blur / Enter and cancels on Escape.
 *
 * This is the primitive behind moving form fields onto the stage so the Editor
 * form can shrink. Layout-stable per the hard rules: the pencil occupies
 * reserved space (it fades in, never shifts neighbours), and the read ↔ edit
 * swap keeps the row's box the same height.
 *
 * Plain text only — callers serialise richer values (e.g. HTML prompt) to/from
 * text at the boundary. For values that can't be edited as plain text, render a
 * custom `display` and route the pencil elsewhere via `onRequestEdit`.
 */
export function InlineEdit({
  value,
  onCommit,
  ariaLabel,
  editLabel,
  placeholder = "",
  multiline = false,
  display,
  valueClassName,
  inputClassName,
  onRequestEdit,
}: {
  value: string;
  onCommit: (next: string) => void;
  /** Accessible name for the editor input. */
  ariaLabel: string;
  /** Accessible name for the pencil button, e.g. "Edit title". */
  editLabel: string;
  placeholder?: string;
  multiline?: boolean;
  /** Custom read-only rendering; defaults to the value (or placeholder when empty). */
  display?: ReactNode;
  /** Class applied to the read-only value text (drives size/weight per field). */
  valueClassName?: string;
  /** Class applied to the editor input/textarea. */
  inputClassName?: string;
  /**
   * When set, the pencil calls this instead of opening the inline editor — for
   * fields whose editor lives elsewhere (e.g. a rich-text field that defers to
   * the form). `onCommit` is then unused.
   */
  onRequestEdit?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      const el = inputRef.current;
      el?.focus();
      el?.select?.();
    }
  }, [editing]);

  const open = () => {
    if (onRequestEdit) {
      onRequestEdit();
      return;
    }
    setDraft(value);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(value);
  };

  if (editing) {
    const common = {
      ref: inputRef,
      className: ["ks-inline__input", inputClassName].filter(Boolean).join(" "),
      value: draft,
      placeholder,
      "aria-label": ariaLabel,
      onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
      onBlur: commit,
    };
    return (
      <div className="ks-inline ks-inline--editing">
        {multiline ? (
          <textarea
            {...common}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
              // Cmd/Ctrl+Enter commits a multiline field; plain Enter inserts a line.
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
            }}
          />
        ) : (
          <input
            {...common}
            type="text"
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
              if (e.key === "Enter") commit();
            }}
          />
        )}
      </div>
    );
  }

  const isEmpty = value.trim() === "";
  return (
    <div className="ks-inline">
      <span
        className={[
          "ks-inline__value",
          isEmpty ? "ks-inline__value--empty" : "",
          valueClassName,
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={open}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
      >
        {display ?? (isEmpty ? placeholder : value)}
      </span>
      <button
        type="button"
        className="ks-inline__edit"
        aria-label={editLabel}
        title={editLabel}
        onClick={open}
      >
        <PencilIcon />
      </button>
    </div>
  );
}
