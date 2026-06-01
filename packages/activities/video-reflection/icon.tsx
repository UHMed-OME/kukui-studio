import type { ComponentType } from "react";

/**
 * Sidebar icon for the video-reflection activity. Matches the shared
 * stroke-SVG family (1.8px stroke, 24px viewBox, currentColor): a video
 * camera, evoking a recorded response.
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
    <rect x="2" y="6" width="13" height="12" rx="2" />
    <path d="M15 10l6-3v10l-6-3" />
  </svg>
);
