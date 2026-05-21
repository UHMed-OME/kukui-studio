import type { ComponentType } from "react";

/**
 * Sidebar icon for the image-annotation activity. Extracted from
 * apps/studio-app/src/activityIcons.tsx (LEGACY_ICONS). Matches the shared
 * stroke-SVG family there (1.8px stroke, 24px viewBox, currentColor):
 * a framed image with a small marker dot, a hill silhouette, and a corner
 * pen tip — suggesting "draw / annotate on an image".
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
    <rect x="3" y="3" width="14" height="14" rx="2" />
    <circle cx="8" cy="8" r="1.5" />
    <path d="M3 14l4-4 5 5" />
    <path d="M17 17h4v4z" />
  </svg>
);
