import type { ComponentType } from "react";

/**
 * Sidebar icon for the course-presentation activity. Matches the shared
 * stroke-SVG family (1.8px stroke, 24px viewBox, currentColor): a presentation
 * board on a stand with a slide line — a slide deck. Placeholder; refine later.
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
    <rect x="3" y="4" width="18" height="12" rx="1" />
    <polyline points="7 9 10 12 14 8 17 11" />
    <line x1="12" y1="16" x2="12" y2="19" />
    <line x1="9" y1="21" x2="15" y2="21" />
  </svg>
);
