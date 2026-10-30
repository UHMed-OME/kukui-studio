import type { ComponentType } from "react";

/**
 * Sidebar icon for the leaderboard quiz: a three-step podium (tallest in the
 * middle) in the shared stroke-SVG family (1.8px stroke, 24px viewBox,
 * currentColor).
 */
export const Icon: ComponentType<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="4" width="6" height="16" />
    <rect x="3" y="11" width="6" height="9" />
    <rect x="15" y="14" width="6" height="6" />
    <rect x="9" y="4" width="6" height="16" fill="currentColor" stroke="none" opacity="0.18" />
  </svg>
);
