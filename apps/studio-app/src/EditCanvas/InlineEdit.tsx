import { useEffect, useRef, useState } from "react";
import { PencilIcon } from "../icons.js";

/**
 * In-place editable field for the visual editors. The value renders as styled
 * text on the canvas with a small pencil cue beside it; clicking the text (or
 * the pencil) turns that same text editable in place — no separate input box
 * pops up — committing on blur / Enter and cancelling on Escape.
 *
 * Editing happens via `contentEditable` on the value element itself, so the
 * text never shifts into a "bubble" and the pencil hugs the content instead of
 * floating to the far right of the row. The element is left uncontrolled while
 * editing (we seed its text on entry and read it back on commit) so the caret
 * doesn't jump and an unrelated parent re-render mid-edit can't wipe the draft.
 *
 * Plain text only — callers serialise richer values (e.g. an HTML prompt) to and
 * from text at the boundary.
 */
export function InlineEdit({
  value,
  onCommit,
  ariaLabel,
  editLabel,
  placeholder = "",
  multiline = false,
  valueClassName,
}: {
  value: string;
  onCommit: (next: string) => void;
  /** Accessible name for the editable text. */
  ariaLabel: string;
  /** Accessible name for the pencil cue, e.g. "Edit title". */
  editLabel: string;
  placeholder?: string;
  /** Allow newlines (Enter inserts a line; Cmd/Ctrl+Enter commits). */
  multiline?: boolean;
  /** Class applied to the editable text (drives size/weight per field). */
  valueClassName?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [editing, setEditing] = useState(false);

  // Keep the DOM text in sync with `value` while NOT editing. During an edit we
  // leave the node alone (it's uncontrolled) so typing isn't fought by React.
  useEffect(() => {
    if (!editing && ref.current && ref.current.innerText !== value) {
      ref.current.innerText = value;
    }
  }, [value, editing]);

  // On entering edit mode, focus and drop the caret at the end of the text.
  useEffect(() => {
    if (!editing || !ref.current) return;
    const el = ref.current;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [editing]);

  const start = () => {
    if (ref.current) ref.current.innerText = value;
    setEditing(true);
  };

  const commit = () => {
    const raw = ref.current?.innerText ?? "";
    const next = multiline ? raw.replace(/\n+$/, "") : raw.replace(/\s*\n\s*/g, " ").trim();
    setEditing(false);
    if (next !== value) onCommit(next);
  };

  const cancel = () => {
    if (ref.current) ref.current.innerText = value;
    setEditing(false);
  };

  return (
    <span className={["ks-inline", editing ? "is-editing" : ""].filter(Boolean).join(" ")}>
      <span
        ref={ref}
        className={["ks-inline__value", valueClassName].filter(Boolean).join(" ")}
        contentEditable={editing}
        suppressContentEditableWarning
        // At rest it's a button (click to edit); while editing it's the textbox.
        role={editing ? "textbox" : "button"}
        aria-label={editing ? ariaLabel : editLabel}
        aria-multiline={editing && multiline ? true : undefined}
        data-placeholder={placeholder}
        tabIndex={0}
        onClick={editing ? undefined : start}
        onInput={(e) => {
          // contentEditable can leave a stray <br> after a full clear, which
          // defeats the :empty placeholder — normalise it back to truly empty.
          const el = e.currentTarget;
          if (el.textContent === "") el.innerHTML = "";
        }}
        onKeyDown={(e) => {
          if (!editing) {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              start();
            }
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          } else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={editing ? commit : undefined}
      />
      {!editing ? (
        <button
          type="button"
          className="ks-inline__edit"
          aria-label={editLabel}
          title={editLabel}
          onClick={start}
        >
          <PencilIcon />
        </button>
      ) : null}
    </span>
  );
}
