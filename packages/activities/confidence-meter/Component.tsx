import type { ConfidenceMeterConfig } from "./schema.js";
import type { ActivityProps } from "@kukui/core/types";
import { LivePreviewCard } from "@kukui/core/components/_live-preview";

/**
 * Engine / Studio-preview view of the Confidence Meter.
 *
 * Confidence Meter is Live-only — the slider's value only means
 * something next to a histogram of other learners' values. In the
 * single-learner engine context (SCORM zip, Studio Preview) the
 * `LivePreviewCard` renders the prompt + a banner explaining that the
 * interactive runtime opens in Kukui Live and posts success:1/1 so the
 * LMS marks the SCO complete.
 */
export default function Component({
  config,
  onSubmit,
  headingLevel = 1,
}: ActivityProps<ConfidenceMeterConfig>) {
  const scale = (config.scale ?? { min: 0, max: 100 }) as {
    min: number;
    max: number;
    unit?: string;
  };
  const unit = scale.unit ?? "";
  return (
    <LivePreviewCard
      title={config.title}
      prompt={config.prompt}
      kindLabel="Confidence Meter"
      description={`Students drag a slider from ${scale.min}${unit} to ${scale.max}${unit}; the instructor sees a real-time histogram + mean. Open this in Kukui Live during class.`}
      onSubmit={onSubmit}
      headingLevel={headingLevel}
      headerVariant={config.appearance?.header ?? "full"}
    />
  );
}
