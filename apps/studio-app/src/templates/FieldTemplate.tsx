import { useId, type ReactNode } from "react";
import type { FieldTemplateProps, UiSchema } from "@rjsf/utils";

/**
 * RJSF FieldTemplate that renders the label + an optional ⓘ tooltip icon
 * beside it, sourced from `ui:help`. The tooltip is CSS-only (visible on
 * hover/focus of the icon button), so it works with keyboard navigation
 * and screen readers via aria-describedby.
 *
 * Falls back to RJSF's default rendering for fields whose label RJSF
 * suppresses (`displayLabel === false`, e.g. checkboxes whose label is
 * rendered inline next to the input).
 */
export function FieldTemplate(props: FieldTemplateProps) {
  const {
    id,
    label,
    children,
    errors,
    description,
    displayLabel,
    required,
    classNames,
    uiSchema,
  } = props;

  const helpText = readHelp(uiSchema);

  return (
    <div className={["ks-field", classNames].filter(Boolean).join(" ")}>
      {displayLabel && label ? (
        <div className="ks-field__label-row">
          <label htmlFor={id} className="ks-field__label">
            {label}
            {required ? <span className="ks-field__required">*</span> : null}
          </label>
          {helpText ? <Tooltip text={helpText} /> : null}
        </div>
      ) : null}
      {description ? <div className="ks-field__desc">{description}</div> : null}
      {children}
      {errors}
    </div>
  );
}

function readHelp(uiSchema: UiSchema | undefined): string | null {
  if (!uiSchema) return null;
  const help = (uiSchema as Record<string, unknown>)["ui:help"];
  return typeof help === "string" ? help : null;
}

function Tooltip({ text }: { text: string }) {
  const id = useId();
  return (
    <span className="ks-tooltip">
      <button
        type="button"
        className="ks-tooltip__btn"
        aria-describedby={id}
        aria-label="Field help"
        tabIndex={0}
      >
        ⓘ
      </button>
      <span id={id} role="tooltip" className="ks-tooltip__bubble">
        {text as ReactNode}
      </span>
    </span>
  );
}
