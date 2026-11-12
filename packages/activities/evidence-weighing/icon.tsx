import type { ComponentType } from "react";

/**
 * Sidebar icon for the evidence-weighing activity. Matches the shared stroke-SVG family from
 * apps/studio-app/src/activityIcons.tsx (LEGACY_ICONS) (1.8px stroke, 24px viewBox, currentColor):
 * a solid label tile being dragged onto a dashed drop zone, with a short pickup arrow between them.
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
    <path d="M12 3v18" />
    <path d="M5 7h14" />
    <path d="M5 7l-3 6h6l-3-6Z" />
    <path d="M19 7l-3 6h6l-3-6Z" />
    <path d="M8 21h8" />
  </svg>
);
