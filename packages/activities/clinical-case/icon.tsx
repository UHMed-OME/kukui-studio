import type { ComponentType } from "react";

/**
 * Sidebar icon for the clinical-case activity. Matches the shared stroke-SVG
 * family (1.8px stroke, 24px viewBox, currentColor): a document with a heart /
 * vitals trace — a clinical case file. Placeholder; refine later.
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
    <path d="M6 2h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
    <polyline points="14 2 14 6 18 6" />
    <polyline points="8 14 10 14 11 12 13 16 14 14 16 14" />
  </svg>
);
