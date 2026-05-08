import type { WidgetProps } from "@rjsf/utils";

type Node = {
  id?: string;
  prompt?: string;
  presentation?: string;
  label?: string;
};

/**
 * Dropdown widget for branching-scenario / ddx-tree node references
 * (`startNodeId`, `nextNodeId`). Reads the live `nodes` array from the
 * form's root via `formContext.formData`, then renders a select where
 * the option label is the node's prompt/presentation text — so authors
 * pick "What's your first move?" instead of trying to remember "n-1".
 *
 * The select stores the node's id (matching the schema contract); it's
 * just the rendered label that gets translated to human-readable text.
 */
export function NodeSelectWidget(props: WidgetProps) {
  const { value, onChange, disabled, readonly, id, required } = props;
  const formData = (props.formContext as { formData?: { nodes?: Node[] } } | undefined)
    ?.formData;
  const nodes = Array.isArray(formData?.nodes) ? formData.nodes : [];
  const safeValue = typeof value === "string" ? value : "";

  return (
    <select
      id={id}
      className="ks-node-select"
      value={safeValue}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-required={required}
    >
      <option value="">— Pick a step —</option>
      {nodes.map((n, i) => {
        const nodeId = n.id ?? `step-${i + 1}`;
        const label = previewLabel(n) || `Step ${i + 1}`;
        return (
          <option key={nodeId} value={nodeId}>
            {label}
          </option>
        );
      })}
    </select>
  );
}

function previewLabel(node: Node): string {
  const text = node.prompt ?? node.presentation ?? node.label ?? "";
  const stripped = text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length > 60 ? stripped.slice(0, 57) + "…" : stripped;
}
