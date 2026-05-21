import { useId } from "react";
import type { StrawPollConfig } from "./schema.js";
import type { ActivityProps } from "@kukui/core/types";
import { SafeHtml } from "@kukui/core";
import "./Component.css";

/**
 * Engine / Studio-preview view of a Straw Poll.
 *
 * Straw Poll is a Live-only activity — voting only makes sense with
 * other people in the room. In the single-learner engine context
 * (SCORM zip, Studio Preview "live mode"), there's nobody to vote
 * against, so this component renders the question and choices
 * read-only with a banner pointing the viewer at Kukui Live.
 *
 * SCORM round-trip: a "Continue" button posts success:1/1 so the LMS
 * marks the SCO complete. The interactive UI is reserved for
 * `StrawPollLive` in apps/live-mode.
 */
export default function Component({
  config,
  onSubmit,
  headingLevel = 1,
}: ActivityProps<StrawPollConfig>) {
  const HeadingTag = `h${headingLevel}` as "h1" | "h2" | "h3";
  const headingId = useId();

  return (
    <article className="kukui-sp" aria-labelledby={headingId}>
      <span className="kukui-sp__badge">Live activity</span>
      <HeadingTag id={headingId} className="kukui-sp__title">
        {config.title}
      </HeadingTag>
      <SafeHtml className="kukui-sp__prompt" html={config.prompt} />

      <p className="kukui-sp__hint">
        This is a Straw Poll — the instructor opens it in Kukui Live and connected
        students vote in real time. Outside Live (e.g. this preview), the question and
        choices are shown for reference.
      </p>

      <ul className="kukui-sp__choices" aria-label="Poll choices">
        {config.choices.map((choice, idx) => (
          <li key={choice.id} className="kukui-sp__choice">
            <span className="kukui-sp__choice-marker" aria-hidden="true">
              {String.fromCharCode(65 + idx)}
            </span>
            <div className="kukui-sp__choice-body">
              <span className="kukui-sp__choice-label">{choice.label}</span>
              {choice.description ? (
                <span className="kukui-sp__choice-desc">{choice.description}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="kukui-sp__complete"
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
