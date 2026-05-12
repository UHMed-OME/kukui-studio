import type { WordCloudConfig } from "@kukui/schemas";
import type { ActivityProps } from "../../types.js";
import { LivePreviewCard } from "../_live-preview/LivePreviewCard.js";

export function WordCloud({
  config,
  onSubmit,
  headingLevel = 1,
}: ActivityProps<WordCloudConfig>) {
  const max = config.submissionsPerStudent ?? 1;
  return (
    <LivePreviewCard
      title={config.title}
      prompt={config.prompt}
      kindLabel="Word Cloud"
      description={`Students each submit ${max === 1 ? "one short response" : `up to ${max} short responses`}; everyone watches an emergent frequency tally. Open this in Kukui Live during class.`}
      onSubmit={onSubmit}
      headingLevel={headingLevel}
    />
  );
}
