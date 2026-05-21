import type { QuickQuizConfig } from "@kukui/schemas";
import type { ActivityProps } from "../../types.js";
import { LivePreviewCard } from "../_live-preview/LivePreviewCard.js";

export function QuickQuiz({
  config,
  onSubmit,
  headingLevel = 1,
}: ActivityProps<QuickQuizConfig>) {
  return (
    <LivePreviewCard
      title={config.title}
      prompt={config.prompt}
      kindLabel="Quick Quiz"
      description={`Single multiple-choice question (${config.choices.length} options) — students answer in real time, the instructor sees the distribution + reveals the correct answer. Open this in Kukui Live during class.`}
      onSubmit={onSubmit}
      headingLevel={headingLevel}
    >
      <ul className="kukui-live-preview__choices" aria-label="Choices">
        {config.choices.map((choice, idx) => (
          <li key={choice.id} style={{ padding: "4px 0", fontSize: "var(--font-size-body, 15px)" }}>
            <strong>{String.fromCharCode(65 + idx)}.</strong> {choice.label}
          </li>
        ))}
      </ul>
    </LivePreviewCard>
  );
}
