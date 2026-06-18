import type { WordCloudConfig } from "./schema.js";
import type { ActivityProps } from "@kukui/core/types";
import { LivePreviewCard } from "@kukui/core/components/_live-preview";

/**
 * Engine / Studio-preview view of the Word Cloud.
 *
 * Word Cloud is Live-only — the cloud only forms when classmates'
 * submissions stream in. In the single-learner engine context (SCORM
 * zip, Studio Preview) the `LivePreviewCard` renders the prompt + a
 * banner explaining that the interactive runtime opens in Kukui Live
 * and posts success:1/1 so the LMS marks the SCO complete.
 */
export default function Component({
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
      headerVariant={config.appearance?.header ?? "full"}
    />
  );
}
