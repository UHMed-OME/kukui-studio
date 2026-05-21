import type { QuickQuizConfig } from "./schema.js";
import type { ActivityProps } from "@kukui/core/types";
import { LivePreviewCard } from "@kukui/core/components/_live-preview";

/**
 * Engine / Studio-preview view of the Quick Quiz.
 *
 * Quick Quiz is Live-first — the realtime instructor-paced answering
 * loop forms when classmates join the mesh. In the single-learner
 * engine context (SCORM zip, Studio Preview) the `LivePreviewCard`
 * renders the prompt + choices preview and a banner explaining that
 * the interactive runtime opens in Kukui Live; it posts success:1/1 so
 * the LMS marks the SCO complete.
 */
export default function Component({
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
