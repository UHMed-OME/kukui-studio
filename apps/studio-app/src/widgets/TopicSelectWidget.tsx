import type { WidgetProps } from "@rjsf/utils";

type Topic = { id?: string; label?: string };

/**
 * Dropdown for a question's `topicId`. Reads the live `topics` array from the
 * form's root via `formContext.formData`, so a topic added above shows up here
 * immediately. Stores the topic id; shows its name (falls back to the id if the topic has no name yet).
 */
export function TopicSelectWidget(props: WidgetProps) {
  const { value, onChange, disabled, id, required } = props;
  const formData = (props.formContext as { formData?: { topics?: Topic[] } } | undefined)?.formData;
  const topics = (Array.isArray(formData?.topics) ? formData.topics : []).filter((t) => t.id);
  const current = typeof value === "string" ? value : "";
  // Keep a value that no longer matches any topic visible instead of silently dropping it.
  const stale = current !== "" && !topics.some((t) => t.id === current);

  return (
    <select
      id={id}
      className="ks-node-select"
      value={current}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-required={required}
    >
      <option value="">Pick a topic</option>
      {topics.map((t) => (
        <option key={t.id} value={t.id}>
          {t.label || t.id}
        </option>
      ))}
      {stale ? <option value={current}>{current} (not in Topics)</option> : null}
    </select>
  );
}
