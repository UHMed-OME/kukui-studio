import type { ReactNode } from "react";
import "./StatusBadge.css";

export type StatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "error"
  | "primary";

export type StatusBadgeProps = {
  /** Semantic color. Each tone maps to a design token; default neutral. */
  tone?: StatusTone;
  /** Optional leading icon (aria-hidden). Color comes from the badge. */
  icon?: ReactNode;
  /** Label text — required so color is never the sole signal. */
  children: ReactNode;
  /**
   * Render for a dark/gradient surface (e.g. inside ActivityHeader's banner):
   * translucent-white pill instead of the token tint.
   */
  onDark?: boolean;
  className?: string;
};

/**
 * Small status pill: a tone color paired with an optional icon and a text
 * label. Shared across activities so completion / correctness / live state
 * reads consistently. Color is always paired with the text label (WCAG:
 * never the sole signal).
 */
export function StatusBadge({
  tone = "neutral",
  icon,
  children,
  onDark = false,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={[
        "kukui-badge",
        `kukui-badge--${tone}`,
        onDark ? "is-on-dark" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon ? (
        <span className="kukui-badge__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="kukui-badge__label">{children}</span>
    </span>
  );
}
