import type { ObjectFieldTemplateProps } from "@rjsf/utils";

const COORD_KEYS = new Set(["x", "y", "z", "w", "h"]);

/**
 * Schema property names that, by convention, hold author-facing
 * override-style settings (button label overrides, behaviour toggles,
 * live-transport tweaks). Hide these under a `<details>` so new
 * authors aren't overwhelmed by a wall of options they don't need to
 * touch on the happy path. Per-kind uiSchemas can override this via
 * `ui:options: { advanced: false }`.
 */
const ADVANCED_BY_DEFAULT = new Set(["ui", "behaviour", "live"]);

/**
 * Render an RJSF object as a section card.
 * - Top-level `root` object renders flat (no card chrome) so the form fills
 *   the panel.
 * - Coordinate-shaped objects (props are a subset of {x, y, z, w, h}) render
 *   inline as a single row so authors don't scroll past four stacked
 *   single-number inputs per point/rect.
 * - Nested objects (behaviour, ui, model, camera, etc.) get their own card
 *   with a heading + subtle background, so the visual hierarchy makes the
 *   activity-config shape obvious at a glance.
 */
export function ObjectFieldTemplate(props: ObjectFieldTemplateProps) {
  const { idSchema, title, description, properties, uiSchema } = props;
  const isRoot = idSchema?.$id === "root";

  if (isRoot) {
    return (
      <div className="ks-object ks-object--root">
        {properties.map((p) => (
          <div key={p.name} className="ks-field">
            {p.content}
          </div>
        ))}
      </div>
    );
  }

  if (isCoordObject(properties)) {
    return (
      <div className="ks-coord-row" role="group" aria-label={title ?? "Coordinates"}>
        {properties.map((p) => (
          <div key={p.name} className="ks-coord-row__cell">
            {p.content}
          </div>
        ))}
      </div>
    );
  }

  // RJSF auto-generates array-item titles as `<arrayName>-<index>` when the
  // item schema has no explicit title. Those collide with the index badge
  // ArrayItem already shows ("#1", "#2"), so suppress them here.
  const showTitle = title && !isAutoArrayItemTitle(title);

  // Property keyed by the schema name (e.g. "ui", "behaviour", "live")
  // is collapsible-by-default if it's in our override allowlist OR the
  // uiSchema explicitly opts in. uiSchema can also opt OUT with
  // `ui:options: { advanced: false }`.
  const fieldName = idSchema?.$id?.split("_").pop() ?? "";
  const uiOptions = ((uiSchema ?? {}) as Record<string, unknown>)["ui:options"] as
    | { advanced?: boolean }
    | undefined;
  const isAdvanced =
    uiOptions?.advanced === true ||
    (uiOptions?.advanced !== false && ADVANCED_BY_DEFAULT.has(fieldName));

  if (isAdvanced) {
    return (
      <details className="ks-object ks-object--advanced">
        <summary className="ks-object__title ks-object__title--summary">
          {title ?? fieldName}
          <span className="ks-object__advanced-tag">Advanced</span>
        </summary>
        {description ? <p className="ks-object__desc">{description}</p> : null}
        <div className="ks-object__body">
          {properties.map((p) => (
            <div key={p.name} className="ks-field">
              {p.content}
            </div>
          ))}
        </div>
      </details>
    );
  }

  return (
    <section className="ks-object">
      {showTitle ? <h3 className="ks-object__title">{title}</h3> : null}
      {description ? <p className="ks-object__desc">{description}</p> : null}
      <div className="ks-object__body">
        {properties.map((p) => (
          <div key={p.name} className="ks-field">
            {p.content}
          </div>
        ))}
      </div>
    </section>
  );
}

function isAutoArrayItemTitle(title: string): boolean {
  return /-\d+$/.test(title);
}

function isCoordObject(properties: ObjectFieldTemplateProps["properties"]): boolean {
  if (properties.length < 2 || properties.length > 4) return false;
  return properties.every((p) => COORD_KEYS.has(p.name));
}
