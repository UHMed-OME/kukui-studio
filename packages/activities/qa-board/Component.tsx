import type { QABoardConfig } from "./schema.js";
import type { ActivityProps } from "@kukui/core/types";
import { LivePreviewCard } from "@kukui/core/components/_live-preview";

/**
 * Engine / Studio-preview view of the Q&A Board.
 *
 * Q&A Board is Live-only — the question stream + upvote loop only
 * forms when classmates' submissions arrive over the mesh. In the
 * single-learner engine context (SCORM zip, Studio Preview) the
 * `LivePreviewCard` renders the prompt + a banner explaining that the
 * interactive runtime opens in Kukui Live and posts success:1/1 so the
 * LMS marks the SCO complete.
 */
export default function Component({
  config,
  onSubmit,
  headingLevel = 1,
}: ActivityProps<QABoardConfig>) {
  return (
    <LivePreviewCard
      title={config.title}
      prompt={config.prompt}
      kindLabel="Q&A Board"
      description="Students post questions during class; everyone can upvote; the instructor sees the list ranked by votes and can mark questions as answered. Open this in Kukui Live during class."
      onSubmit={onSubmit}
      headingLevel={headingLevel}
      headerVariant={config.appearance?.header ?? "full"}
    />
  );
}
