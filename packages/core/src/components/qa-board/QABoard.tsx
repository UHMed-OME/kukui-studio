import type { QABoardConfig } from "@kukui/schemas";
import type { ActivityProps } from "../../types.js";
import { LivePreviewCard } from "../_live-preview/LivePreviewCard.js";

export function QABoard({
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
    />
  );
}
