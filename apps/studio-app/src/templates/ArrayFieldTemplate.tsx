import type { ArrayFieldTemplateProps, ArrayFieldTemplateItemType } from "@rjsf/utils";

/**
 * Card-based array editor. Each item gets:
 *   - An index badge (1, 2, 3…)
 *   - The item form
 *   - Move-up / move-down arrows + a remove button in the corner
 * The Add button is a wide outlined affordance below the list.
 *
 * Title resolution: `props.title` arrives as the raw property name when the
 * uiSchema only sets `ui:title` (RJSF passes the schema title or property
 * name, ignoring `ui:title` for arrays in some paths). Read the uiSchema
 * title explicitly so authors get a polished label without having to mirror
 * it into the JSON Schema.
 */
export function ArrayFieldTemplate(props: ArrayFieldTemplateProps) {
  const { schema, items, canAdd, onAddClick, uiSchema } = props;
  const uiTitle = (uiSchema as Record<string, unknown> | undefined)?.["ui:title"];
  const title = typeof uiTitle === "string" ? uiTitle : props.title;
  const description = schema?.description;

  return (
    <div className="ks-array">
      {title ? <h3 className="ks-array__title">{title}</h3> : null}
      {description ? <p className="ks-array__desc">{description}</p> : null}
      {items && items.length > 0 ? (
        <ul className="ks-array__list">
          {items.map((item, idx) => (
            <ArrayItem
              key={item.key}
              item={item}
              index={idx + 1}
              itemLabel={titleCase(singular(title))}
            />
          ))}
        </ul>
      ) : (
        <p className="ks-array__empty">No items yet — use Add below.</p>
      )}
      {canAdd ? (
        <button
          type="button"
          className="ks-array__add"
          onClick={(e) => {
            e.preventDefault();
            onAddClick();
          }}
        >
          + Add {singular(title)}
        </button>
      ) : null}
    </div>
  );
}

function ArrayItem({
  item,
  index,
  itemLabel,
}: {
  item: ArrayFieldTemplateItemType;
  index: number;
  itemLabel: string;
}) {
  const {
    children,
    hasCopy,
    hasMoveDown,
    hasMoveUp,
    hasRemove,
    onCopyIndexClick,
    onDropIndexClick,
    onReorderClick,
  } = item;
  return (
    <li className="ks-array-item">
      <div className="ks-array-item__bar">
        <span className="ks-array-item__index">{itemLabel} {index}</span>
        <div className="ks-array-item__actions">
          {hasMoveUp ? (
            <button
              type="button"
              aria-label="Move up"
              title="Move up"
              className="ks-icon-btn"
              onClick={(e) => {
                e.preventDefault();
                onReorderClick(item.index, item.index - 1)(e);
              }}
            >
              ↑
            </button>
          ) : null}
          {hasMoveDown ? (
            <button
              type="button"
              aria-label="Move down"
              title="Move down"
              className="ks-icon-btn"
              onClick={(e) => {
                e.preventDefault();
                onReorderClick(item.index, item.index + 1)(e);
              }}
            >
              ↓
            </button>
          ) : null}
          {hasCopy ? (
            <button
              type="button"
              aria-label="Duplicate item"
              title="Duplicate item"
              className="ks-icon-btn"
              onClick={(e) => {
                e.preventDefault();
                onCopyIndexClick(item.index)(e);
              }}
            >
              ⎘
            </button>
          ) : null}
          {hasRemove ? (
            <button
              type="button"
              aria-label="Remove item"
              title="Remove item"
              className="ks-icon-btn ks-icon-btn--danger"
              onClick={(e) => {
                e.preventDefault();
                onDropIndexClick(item.index)(e);
              }}
            >
              ✕
            </button>
          ) : null}
        </div>
      </div>
      <div className="ks-array-item__body">{children}</div>
    </li>
  );
}

function singular(title: string | undefined): string {
  if (!title) return "item";
  // Crude: trim trailing "s" if there is one.
  if (title.toLowerCase().endsWith("s")) return title.slice(0, -1).toLowerCase();
  return title.toLowerCase();
}

/** First-letter uppercase so item-badges render "Card 1", not "card 1". */
function titleCase(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
