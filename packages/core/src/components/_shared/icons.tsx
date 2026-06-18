import type { SVGProps } from "react";

/**
 * Shared inline icons for activity chrome (status badges, headers).
 *
 * The kukui glyph is a brand-aware candlenut silhouette (currentColor, no
 * gradient) — promoted here from studio-app so engine + live can use it too
 * (e.g. the ActivityHeader watermark overlay). The status glyphs are small
 * stroke icons that replace the scattered ✓/✗ unicode characters with a
 * consistent set; each is `aria-hidden` by default (badges carry the text
 * label, so color/icon is never the sole signal).
 */

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps, children: React.ReactNode, stroke = true) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill={stroke ? "none" : "currentColor"}
      stroke={stroke ? "currentColor" : "none"}
      strokeWidth={stroke ? 2 : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Candlenut silhouette (brand mark). Fills with currentColor. */
export function KukuiGlyphIcon(props: IconProps) {
  return (
    <svg
      viewBox="-5 -5 74 74"
      width={18}
      height={18}
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
      {...props}
    >
      <g transform="rotate(35 32 32)">
        <path d="M24 6 C 16 7, 8 15, 6 26 C 4 39, 12 57, 32 60 C 52 57, 60 39, 58 26 C 56 15, 48 7, 40 6 C 37 8, 35 13, 32 14 C 29 13, 27 8, 24 6 Z" />
      </g>
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return base(props, <polyline points="20 6 9 17 4 12" />);
}

export function XIcon(props: IconProps) {
  return base(props, (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ));
}

/** Filled dot — for "in progress" / neutral status. */
export function DotIcon(props: IconProps) {
  return base(props, <circle cx="12" cy="12" r="5" />, false);
}

export function ClockIcon(props: IconProps) {
  return base(props, (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </>
  ));
}

/** Trophy — for "complete" / passed. */
export function TrophyIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
      <path d="M7 6H4v1a3 3 0 0 0 3 3" />
      <path d="M17 6h3v1a3 3 0 0 1-3 3" />
      <line x1="12" y1="13" x2="12" y2="17" />
      <path d="M9 20h6" />
      <path d="M10 17h4l1 3H9z" />
    </>
  ));
}
