import type { ObjectFieldTemplateProps } from "@rjsf/utils";

/**
 * Render an RJSF object as a section card.
 * - Top-level `root` object renders flat (no card chrome) so the form fills
 *   the panel.
 * - Nested objects (behaviour, ui, model, camera, etc.) get their own card
 *   with a heading + subtle background, so the visual hierarchy makes the
 *   activity-config shape obvious at a glance.
 */
export function ObjectFieldTemplate(props: ObjectFieldTemplateProps) {
  const { idSchema, title, description, properties } = props;
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

  return (
    <section className="ks-object">
      {title ? <h3 className="ks-object__title">{title}</h3> : null}
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
