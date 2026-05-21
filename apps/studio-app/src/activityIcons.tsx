/**
 * One small stroke-SVG icon per Studio-surfaced activity kind. Style matches
 * `./icons.tsx` (1.8px stroke, 24px viewBox, currentColor) so the sidebar
 * iconography reads as one family with the toolbar icons.
 *
 * Icons are concepts, not literal pictograms — each suggests the activity's
 * interaction style at 16×16 (drag arrow, target dot, tree fork, etc.).
 *
 * <ActivityIcon> renders a 16×16 invisible placeholder when no icon is
 * registered for a kind, so a missing icon never collapses the sidebar
 * button's flex layout.
 */
import type { JSX, SVGProps } from "react";
import type { ActivityKind } from "@kukui/core";
import { ACTIVITY_MANIFESTS } from "@kukui/activities";

const baseProps: SVGProps<SVGSVGElement> = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

function Hotspot2dIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Hotspot3dIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 3l9 5v8l-9 5-9-5V8z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v8" />
      <circle cx="12" cy="9" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function VirtualTourIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <ellipse cx="12" cy="12" rx="9" ry="4" />
      <polyline points="6 9 3 12 6 15" />
      <polyline points="18 9 21 12 18 15" />
    </svg>
  );
}

function InteractiveVideoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <polygon
        points="10 9 16 12 10 15"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

function LabPanelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M9 3v13a3 3 0 0 0 6 0V3" />
      <line x1="8" y1="3" x2="16" y2="3" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </svg>
  );
}

function BranchingScenarioIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="5" r="2" />
      <circle cx="6" cy="17" r="2" />
      <circle cx="18" cy="17" r="2" />
      <line x1="11" y1="7" x2="7" y2="15" />
      <line x1="13" y1="7" x2="17" y2="15" />
    </svg>
  );
}

function DdxTreeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="3.5" r="1.5" />
      <circle cx="6" cy="11" r="1.5" />
      <circle cx="18" cy="11" r="1.5" />
      <circle cx="3" cy="20" r="1.5" />
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="15" cy="20" r="1.5" />
      <circle cx="21" cy="20" r="1.5" />
      <line x1="11" y1="4.5" x2="7" y2="10" />
      <line x1="13" y1="4.5" x2="17" y2="10" />
      <line x1="5" y1="12" x2="3.5" y2="18.5" />
      <line x1="7" y1="12" x2="8.5" y2="18.5" />
      <line x1="17" y1="12" x2="15.5" y2="18.5" />
      <line x1="19" y1="12" x2="20.5" y2="18.5" />
    </svg>
  );
}

function OsceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="5" y="4" width="14" height="17" rx="1.5" />
      <rect x="9" y="2" width="6" height="3" rx="0.5" />
      <polyline points="8 11 10 13 13 9" />
      <line x1="15" y1="11" x2="17" y2="11" />
      <line x1="8" y1="16" x2="17" y2="16" />
    </svg>
  );
}

function AudioRecordingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="21" />
      <line x1="9" y1="21" x2="15" y2="21" />
    </svg>
  );
}

function CrosswordIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
      <rect x="3" y="9" width="6" height="6" fill="currentColor" stroke="none" opacity="0.18" />
      <rect x="15" y="3" width="6" height="6" fill="currentColor" stroke="none" opacity="0.18" />
    </svg>
  );
}

function ConfidenceMeterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <line x1="4" y1="16" x2="20" y2="16" />
      <path d="M4 16 a8 8 0 0 1 16 0" />
      <line x1="12" y1="16" x2="17" y2="11" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WordCloudIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <ellipse cx="9" cy="12" rx="4" ry="2.5" />
      <ellipse cx="15.5" cy="8.5" rx="3" ry="1.8" />
      <ellipse cx="15" cy="15.5" rx="3.5" ry="2.2" />
      <ellipse cx="6" cy="17" rx="2" ry="1.2" />
    </svg>
  );
}

function QABoardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M3 5 h18 v10 h-7 l-4 3 v-3 H3z" />
      <line x1="7" y1="9" x2="13" y2="9" />
      <line x1="7" y1="12" x2="11" y2="12" />
      <circle cx="17.5" cy="9.5" r="0.7" fill="currentColor" stroke="none" />
      <line x1="16.5" y1="11.5" x2="16.5" y2="13" />
    </svg>
  );
}

function QuickQuizIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
      <line x1="7" y1="9" x2="11" y2="9" />
      <line x1="7" y1="13" x2="11" y2="13" />
      <line x1="7" y1="17" x2="11" y2="17" />
      <circle cx="14.5" cy="9" r="1.2" />
      <circle cx="14.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="17" r="1.2" />
    </svg>
  );
}

function StrawPollIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <line x1="4" y1="20" x2="20" y2="20" />
      <rect x="5" y="14" width="3" height="6" fill="currentColor" stroke="none" opacity="0.22" />
      <rect x="5" y="14" width="3" height="6" />
      <rect x="10.5" y="9" width="3" height="11" fill="currentColor" stroke="none" opacity="0.22" />
      <rect x="10.5" y="9" width="3" height="11" />
      <rect x="16" y="12" width="3" height="8" fill="currentColor" stroke="none" opacity="0.22" />
      <rect x="16" y="12" width="3" height="8" />
    </svg>
  );
}

function IsometricChatroomIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M3 4h12v8H8l-3 3v-3H3z" />
      <path d="M11 10h10v8h-3l-3 3v-3h-4z" />
    </svg>
  );
}

type IconComponent = (props: SVGProps<SVGSVGElement>) => JSX.Element;

const LEGACY_ICONS: Partial<Record<ActivityKind, IconComponent>> = {
  "hotspot-2d": Hotspot2dIcon,
  "hotspot-3d": Hotspot3dIcon,
  "virtual-tour": VirtualTourIcon,
  "interactive-video": InteractiveVideoIcon,
  "lab-panel": LabPanelIcon,
  "branching-scenario": BranchingScenarioIcon,
  "ddx-tree": DdxTreeIcon,
  osce: OsceIcon,
  "audio-recording": AudioRecordingIcon,
  crossword: CrosswordIcon,
  "straw-poll": StrawPollIcon,
  "confidence-meter": ConfidenceMeterIcon,
  "word-cloud": WordCloudIcon,
  "qa-board": QABoardIcon,
  "quick-quiz": QuickQuizIcon,
  "isometric-chatroom": IsometricChatroomIcon,
};

export function hasActivityIcon(kind: ActivityKind): boolean {
  return Boolean(ACTIVITY_MANIFESTS[kind]?.Icon || LEGACY_ICONS[kind]);
}

export function ActivityIcon({
  kind,
  ...rest
}: { kind: ActivityKind } & SVGProps<SVGSVGElement>) {
  // Prefer manifest-supplied icon (Plan 1+) over the hand-written legacy map.
  const ManifestIcon = ACTIVITY_MANIFESTS[kind]?.Icon;
  if (ManifestIcon) {
    return <ManifestIcon className={rest.className} />;
  }
  const LegacyIcon = LEGACY_ICONS[kind];
  if (LegacyIcon) {
    return <LegacyIcon {...rest} />;
  }
  // No icon registered — render the same invisible 16×16 placeholder the
  // file header promises so missing icons never collapse the sidebar's
  // flex layout.
  return (
    <span
      aria-hidden="true"
      className={rest.className}
      style={{
        display: "inline-block",
        width: 16,
        height: 16,
        flex: "0 0 16px",
      }}
    />
  );
}
