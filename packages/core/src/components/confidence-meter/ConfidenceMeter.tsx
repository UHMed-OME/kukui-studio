import type { ConfidenceMeterConfig } from "@kukui/schemas";
import type { ActivityProps } from "../../types.js";
import { LivePreviewCard } from "../_live-preview/LivePreviewCard.js";

export function ConfidenceMeter({
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
    />
  );
}
