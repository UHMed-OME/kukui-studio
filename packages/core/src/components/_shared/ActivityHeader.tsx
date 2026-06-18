import type { ReactNode } from "react";
import { KukuiGlyphIcon } from "./icons.js";
import "./ActivityHeader.css";

export type ActivityHeaderVariant = "full" | "minimal";

export type ActivityHeaderProps = {
  title: string;
  /** id for the heading, so the card can aria-labelledby it. */
  titleId?: string;
  headingLevel?: 1 | 2 | 3;
  /** Small meta line under the title (e.g. "Week 1 · Course"). */
  meta?: ReactNode;
  /** Optional sub-content under the title (e.g. a sanitized prompt). */
  prompt?: ReactNode;
  /** Leading icon before the title (e.g. <ActivityIcon value={config.icon} />). */
  icon?: ReactNode;
  /** Right-slot, typically a <StatusBadge>. */
  badge?: ReactNode;
  /**
   * "full" (default) = gradient banner with the kukui silhouette watermark.
   * "minimal" = plain title block, no gradient. Drive from
   * `config.appearance?.header`.
   */
  variant?: ActivityHeaderVariant;
  className?: string;
};

/**
 * Canonical activity header. Place as the first child of a card whose own
 * top padding is zero and which has `overflow: hidden` — the "full" banner
 * then bleeds edge-to-edge and clips to the card's radius.
 *
 * "full" renders the gradient banner (primary → primary-hover, white text)
 * with a low-opacity candlenut watermark. "minimal" renders a plain titled
 * block. Both expose a badge slot (StatusBadge) on the right. Color on the
 * banner is white text (matches the primary-button convention).
 */
export function ActivityHeader({
  title,
  titleId,
  headingLevel = 1,
  meta,
  prompt,
  icon,
  badge,
  variant = "full",
  className,
}: ActivityHeaderProps) {
  const HeadingTag = `h${headingLevel}` as "h1" | "h2" | "h3";
  return (
    <header
      className={[
        "kukui-actheader",
        `kukui-actheader--${variant}`,
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {variant === "full" ? (
        <KukuiGlyphIcon className="kukui-actheader__glyph" aria-hidden="true" />
      ) : null}
      <div className="kukui-actheader__row">
        {icon ? <span className="kukui-actheader__icon" aria-hidden="true">{icon}</span> : null}
        <HeadingTag id={titleId} className="kukui-actheader__title">
          {title}
        </HeadingTag>
        {badge ? <span className="kukui-actheader__badge">{badge}</span> : null}
      </div>
      {meta ? <p className="kukui-actheader__meta">{meta}</p> : null}
      {prompt ? <div className="kukui-actheader__prompt">{prompt}</div> : null}
    </header>
  );
}
