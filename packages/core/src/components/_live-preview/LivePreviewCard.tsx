import { useId } from "react";
import { SafeHtml } from "../../safe-html.js";
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
  children,
}: {
  title: string;
  prompt: string;
  kindLabel: string;
  description?: string;
  onSubmit: (s: { raw: number; max: number; success: boolean; suspendData?: string }) => void;
  headingLevel?: 1 | 2 | 3;
  children?: React.ReactNode;
}) {
  const HeadingTag = `h${headingLevel}` as "h1" | "h2" | "h3";
  const headingId = useId();

  return (
    <article className="kukui-live-preview" aria-labelledby={headingId}>
      <span className="kukui-live-preview__badge">Live activity · {kindLabel}</span>
      <HeadingTag id={headingId} className="kukui-live-preview__title">
        {title}
      </HeadingTag>
      <SafeHtml className="kukui-live-preview__prompt" html={prompt} />

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
