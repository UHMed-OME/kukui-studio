import type { FieldTemplateProps, UiSchema } from "@rjsf/utils";
import { Tooltip } from "../Tooltip.js";

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
    rawErrors,
    description,
    displayLabel,
    required,
    classNames,
    uiSchema,
  } = props;

  // Hidden widget → render nothing. Without this guard, RJSF still wraps
  // the (invisible) input in a label row, so authors see floating "id*"
  // labels above empty space for fields that should be entirely silent.
  const widget = (uiSchema as Record<string, unknown> | undefined)?.["ui:widget"];
  if (widget === "hidden") return null;

  const helpText = readHelp(uiSchema);
  // Dedupe — RJSF + the Zod extraErrors path can produce overlapping
  // messages for the same issue (e.g. "Required" from AJV plus the more
  // specific Zod message). Showing both is noisy; collapse to unique
  // strings while preserving order.
  const errors = uniq(rawErrors ?? []);
  const hasErrors = errors.length > 0;
  const errorId = hasErrors ? `${id}__errors` : undefined;

  return (
    <div
      className={[
        "ks-field",
        hasErrors ? "ks-field--has-error" : "",
        classNames,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-invalid={hasErrors ? true : undefined}
      aria-describedby={errorId}
    >
      {displayLabel && label ? (
        <div className="ks-field__label-row">
          <label htmlFor={id} className="ks-field__label">
            {label}
            {required ? <span className="ks-field__required">*</span> : null}
          </label>
          {helpText ? <Tooltip text={helpText} label="Field help" /> : null}
        </div>
      ) : null}
      {description ? <div className="ks-field__desc">{description}</div> : null}
      {children}
      {hasErrors ? (
        <ul
          id={errorId}
          className="kukui-studio-field-error"
          role="alert"
        >
          {errors.map((msg, i) => (
            <li key={i}>{msg}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function uniq(xs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

function readHelp(uiSchema: UiSchema | undefined): string | null {
  if (!uiSchema) return null;
  const help = (uiSchema as Record<string, unknown>)["ui:help"];
  return typeof help === "string" ? help : null;
}

