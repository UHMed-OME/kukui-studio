import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Button + dropdown menu — used for the panel-actions Import / Export
 * controls where the same intent has multiple destinations (local
 * file, Google Drive, …).
 *
 * Closes on outside click, Escape, or after any item fires. The menu
 * is absolutely positioned relative to the button wrapper, so it
 * floats below without affecting layout.
 *
 * Items are plain objects; the consumer decides which to include
 * (e.g. hide the Drive option when not configured). An item with
 * `disabled: true` still renders but is non-interactive.
 */

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  /** Optional `title` tooltip on the item button. */
  title?: string;
  disabled?: boolean;
}

export function MenuButton({
  label,
  icon,
  items,
  title,
}: {
  label: string;
  icon?: ReactNode;
  items: MenuItem[];
  /** Tooltip on the trigger button itself. */
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div className="ks-menu" ref={wrapRef}>
      <button
        type="button"
        className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={title}
      >
        {icon}
        <span>{label}</span>
        <ChevronDownInline />
      </button>
      {open ? (
        <ul className="ks-menu__list" role="menu">
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                className="ks-menu__item"
                onClick={() => {
                  if (item.disabled) return;
                  item.onClick();
                  setOpen(false);
                }}
                disabled={item.disabled}
                title={item.title}
              >
                {item.icon ? <span className="ks-menu__icon">{item.icon}</span> : null}
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Inline so the menu chevron doesn't need a stable export elsewhere. */
function ChevronDownInline() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="ks-menu__chevron"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
