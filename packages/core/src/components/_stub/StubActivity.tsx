import { useId } from "react";
import type { ActivityProps } from "../../types.js";
import type { StubConfig } from "@kukui/schemas";
import { PLANNED_DESCRIPTIONS, type PlannedActivityKind } from "../../planned.js";
import "./StubActivity.css";

export type StubKind = PlannedActivityKind;

/**
 * Placeholder activity rendered in Studio + SCORM zips for activity kinds
 * that are listed in the catalog but don't have a real implementation
 * yet. Shows the author's title + notes, and a single "Mark complete"
 * button so SCORM round-trips with success status (1/1) — useful for
 * authoring drafts that learners will see as a stand-in.
 *
 * Replaced by a real component once the activity ships.
 */
export function StubActivity({
  config,
  onSubmit,
  headingLevel = 1,
  kind,
}: ActivityProps<StubConfig> & { kind?: StubKind }) {
  const HeadingTag = `h${headingLevel}` as "h1" | "h2" | "h3";
  const headingId = useId();
  const description = config.description ?? (kind ? PLANNED_DESCRIPTIONS[kind] : undefined);

  return (
    <article className="kukui-stub" aria-labelledby={headingId}>
      <span className="kukui-stub__badge">In design</span>
      <HeadingTag id={headingId} className="kukui-stub__title">
        {config.title}
      </HeadingTag>
      {description ? <p className="kukui-stub__desc">{description}</p> : null}
      {config.notes ? (
        <details className="kukui-stub__notes">
          <summary>Author notes</summary>
          <p>{config.notes}</p>
        </details>
      ) : null}
      <p className="kukui-stub__hint">
        This activity type isn't implemented yet. Authors can save title and notes; learners
        will see this placeholder. Use the &ldquo;Mark complete&rdquo; button to round-trip a
        passing score for SCORM testing.
      </p>
      <button
        type="button"
        className="kukui-stub__complete"
        onClick={() =>
          onSubmit({ raw: 1, max: 1, success: true, suspendData: JSON.stringify({ stub: true }) })
        }
      >
        Mark complete (placeholder)
      </button>
    </article>
  );
}
