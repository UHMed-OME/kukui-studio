import { useId } from "react";
import { SafeHtml } from "../../safe-html.js";
import { ActivityHeader, type ActivityHeaderVariant } from "../_shared/ActivityHeader.js";
import { StatusBadge } from "../_shared/StatusBadge.js";
import { DotIcon } from "../_shared/icons.js";
import "./LivePreviewCard.css";

/**
 * Static engine / Studio-preview surface for a Live-only activity.
 * Each activity that runs in Kukui Live (Straw Poll, Confidence
 * Meter, Word Cloud, Q&A Board, Quick Quiz) gets a tiny per-kind
 * wrapper that fills in the right copy and forwards to this shared
 * card so they all look consistent in the engine SCO / Studio
 * preview while the real interactive runtime lives in @kukui/live.
 *
 * SCORM round-trip: a Continue button posts success:1/1 so the LMS
 * marks the SCO complete when the activity is delivered as an
 * async-engine zip. The actual interactive UI is rendered by
 * the per-activity Live component in apps/live-mode.
 */
export function LivePreviewCard({
  title,
  prompt,
  kindLabel,
  description,
  onSubmit,
  headingLevel = 1,
  headerVariant = "full",
  children,
}: {
  title: string;
  prompt: string;
  kindLabel: string;
  description?: string;
  onSubmit: (s: { raw: number; max: number; success: boolean; suspendData?: string }) => void;
  headingLevel?: 1 | 2 | 3;
  /** From config.appearance?.header — full gradient banner or minimal. */
  headerVariant?: ActivityHeaderVariant;
  children?: React.ReactNode;
}) {
  const headingId = useId();

  return (
    <article className="kukui-live-preview" aria-labelledby={headingId}>
      <ActivityHeader
        title={title}
        titleId={headingId}
        headingLevel={headingLevel}
        variant={headerVariant}
        prompt={<SafeHtml html={prompt} />}
        badge={
          <StatusBadge tone="info" icon={<DotIcon />}>
            Live · {kindLabel}
          </StatusBadge>
        }
      />

      <p className="kukui-live-preview__hint">
        {description ??
          "This activity runs in Kukui Live — the instructor opens it during class and connected students participate in real time. Outside Live (this preview), the prompt is shown for reference."}
      </p>

      {children}

      <button
        type="button"
        className="kukui-live-preview__complete"
        onClick={() =>
          onSubmit({
            raw: 1,
            max: 1,
            success: true,
            suspendData: JSON.stringify({ acknowledged: true }),
          })
        }
      >
        Continue
      </button>
    </article>
  );
}
