import { useEffect, useRef, useState } from "react";
import type { SchemaRegistry, SchemaRegistryKey } from "@kukui/schemas";
import { humanizeFieldLabel, humanizeMessage } from "./validation/humanizeIssue.js";

/**
 * Validation summary in the panel header. When the form is clean, renders
 * a neutral "Valid" pill. When issues exist, the pill becomes a button
 * that opens a popover listing every Zod issue; clicking an issue scrolls
 * the offending field into view and focuses it.
 */
export function ValidationBadge({
  result,
  disabled,
}: {
  result: ReturnType<(typeof SchemaRegistry)[SchemaRegistryKey]["safeParse"]>;
  /**
   * Form view exposes per-field errors, so the popover is most useful
   * there. In Raw JSON view the popover would still scroll, but the field
   * IDs don't exist — show the count but suppress the popover.
   */
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Click-outside / Escape to dismiss.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (e.target instanceof Node && rootRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Auto-close when issues disappear (form went valid while popover open).
  useEffect(() => {
    if (result.success && open) setOpen(false);
  }, [result.success, open]);

  if (result.success) {
    return (
      <span className="kukui-studio-badge kukui-studio-badge--ok" role="status">
        Valid
      </span>
    );
  }

  const issues = result.error.issues as Array<{
    path: ReadonlyArray<PropertyKey>;
    message: string;
    code?: string;
  }>;
  const count = issues.length;
  const label = `${count} validation issue${count === 1 ? "" : "s"}`;

  const focusIssue = (path: ReadonlyArray<PropertyKey>) => {
    // RJSF wraps every field id as `root_<dot-path>` with `.` → `_`.
    // Form-wide issues (empty path) just target the form root.
    const id =
      path.length === 0
        ? "root"
        : `root_${path.map((p) => String(p)).join("_")}`;
    // Defer to next frame so the popover closing doesn't steal focus
    // from the field we're about to scroll into view.
    setOpen(false);
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (typeof (el as HTMLElement).focus === "function") {
        (el as HTMLElement).focus({ preventScroll: true });
      }
    });
  };

  if (disabled) {
    return (
      <span
        className="kukui-studio-badge kukui-studio-badge--err"
        role="status"
        title="Switch to the Form editor to jump to a specific field."
      >
        {label}
      </span>
    );
  }

  return (
    <div className="kukui-studio-validation" ref={rootRef}>
      <button
        type="button"
        className="kukui-studio-badge kukui-studio-badge--err kukui-studio-badge--button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="Show validation issues"
      >
        {label}
      </button>
      {open ? (
        <div
          className="kukui-studio-validation__popover"
          role="dialog"
          aria-label="Validation issues"
        >
          <div className="kukui-studio-validation__header">
            <span className="kukui-studio-validation__title">
              {label}
            </span>
            <button
              type="button"
              className="kukui-studio-validation__close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <ul className="kukui-studio-validation__list">
            {issues.map((issue, i) => (
              <li key={i} className="kukui-studio-validation__item">
                <button
                  type="button"
                  className="kukui-studio-validation__btn"
                  onClick={() => focusIssue(issue.path)}
                >
                  <span className="kukui-studio-validation__path">
                    {humanizeFieldLabel(issue.path)}
                  </span>
                  <span className="kukui-studio-validation__sep">:</span>{" "}
                  <span className="kukui-studio-validation__msg">
                    {humanizeMessage(issue)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
