import { lazy, Suspense, useMemo } from "react";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import type { IChangeEvent } from "@rjsf/core";
import type { ErrorSchema, RJSFSchema, WidgetProps } from "@rjsf/utils";
import { z } from "zod";
import { SchemaRegistry, type SchemaRegistryKey } from "@kukui/schemas";
import type { ActivityKind } from "@kukui/core";
import { UI_SCHEMAS } from "./uiSchemas.js";
import { ArrayFieldTemplate } from "./templates/ArrayFieldTemplate.js";
import { ObjectFieldTemplate } from "./templates/ObjectFieldTemplate.js";
import { FieldTemplate } from "./templates/FieldTemplate.js";
import { FileUploadWidget } from "./widgets/FileUploadWidget.js";
import { NodeSelectWidget } from "./widgets/NodeSelectWidget.js";
import { PasswordCopyWidget } from "./widgets/PasswordCopyWidget.js";

// Lazy-loaded — Tiptap + StarterKit + linkify is ~90-120 KB gz and only
// renders when the active activity has at least one `ui:widget: "html"`
// field. Wrapping the whole RJSF <Form> in Suspense keeps the form
// render-once and lets RJSF mount the widget normally; React resolves
// the lazy chunk lazily the first time it's needed.
const LazyRichTextWidget = lazy(() =>
  import("./widgets/RichTextWidget.js").then((m) => ({ default: m.RichTextWidget })),
);

function RichTextWidget(props: WidgetProps) {
  return <LazyRichTextWidget {...props} />;
}

/**
 * Auto-generated form per activity kind.
 *
 * The Zod schema is converted to JSON Schema via Zod 4's native
 * `z.toJSONSchema`, then rendered with RJSF. This means every field
 * across the seven activity types is editable without hand-writing one
 * form per kind.
 *
 * Limitations: discriminated unions render as `oneOf` selectors which are
 * a bit clunky; complex `additionalProperties: false` objects sometimes
 * confuse RJSF. The escape hatch is the JSON-tab fallback below.
 */
export function EditorForm({
  kind,
  value,
  onChange,
  extraErrors,
}: {
  kind: ActivityKind;
  value: unknown;
  onChange: (next: unknown) => void;
  /**
   * Zod-derived per-field errors merged into RJSF's error schema so each
   * issue shows up inline beneath the offending field. Zod is the source
   * of truth for the activity config; RJSF + AJV catches a subset (types,
   * required, format) that we still leave on for instant feedback.
   */
  extraErrors?: ErrorSchema;
}) {
  const jsonSchema = useMemo<RJSFSchema>(() => {
    const zod = SchemaRegistry[kind as SchemaRegistryKey];
    // Zod 4 ships its own JSON-Schema export. RJSF + AJV speak draft-7,
    // so target that explicitly (the default is draft-2020-12).
    const raw = z.toJSONSchema(zod, { target: "draft-7" }) as RJSFSchema;
    return injectArrayItemDefaults(injectStepConstraints(enrichVariantTitles(raw)));
  }, [kind]);

  const handleChange = (e: IChangeEvent) => {
    onChange(e.formData);
  };

  const uiSchema = useMemo(
    () => ({
      "ui:submitButtonOptions": { norender: true },
      // RJSF 5 supports a per-array `copyable` flag that exposes a copy
      // button on each item. Enabling it globally surfaces a Duplicate
      // affordance on every array (zones, draggables, choices, etc.)
      // without per-kind boilerplate. Per-kind uiSchemas can opt out by
      // setting `ui:options: { copyable: false }`.
      "ui:globalOptions": { copyable: true },
      // Schema-internal fields that should never appear in the form, even
      // when an activity has no per-kind uiSchema entry yet. Per-kind
      // entries can still override these.
      _comment: { "ui:widget": "hidden" },
      version: { "ui:widget": "hidden" },
      $schema: { "ui:widget": "hidden" },
      // `scoring` is owned by the Scoring tab; never show it in the Editor.
      scoring: { "ui:widget": "hidden" },
      ...UI_SCHEMAS[kind],
    }),
    [kind],
  );

  return (
    <div className="rjsf">
      <Suspense fallback={null}>
        <Form
          schema={jsonSchema}
          formData={value}
          validator={validator}
          onChange={handleChange}
          liveValidate
          showErrorList={false}
          extraErrors={extraErrors}
          uiSchema={uiSchema}
          templates={{
            ArrayFieldTemplate,
            ObjectFieldTemplate,
            FieldTemplate,
          }}
          widgets={{
            html: RichTextWidget,
            file: FileUploadWidget,
            nodeSelect: NodeSelectWidget,
            passwordCopy: PasswordCopyWidget,
          }}
          formContext={{ formData: value }}
        />
      </Suspense>
    </div>
  );
}

/**
 * Walk the JSON Schema tree and add a human-readable `title` to each
 * `anyOf` / `oneOf` variant where Zod's discriminator-as-const can supply
 * one. RJSF's variant-picker uses `variant.title` as the dropdown label;
 * without this it falls back to "Option 1" / "Option 2" which is useless.
 */
function enrichVariantTitles<T>(schema: T): T {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) {
    return schema.map(enrichVariantTitles) as unknown as T;
  }
  const obj = schema as Record<string, unknown>;
  for (const key of ["anyOf", "oneOf"] as const) {
    const variants = obj[key];
    if (Array.isArray(variants)) {
      obj[key] = variants.map((variant) => {
        if (variant && typeof variant === "object" && !Array.isArray(variant)) {
          const v = variant as Record<string, unknown>;
          if (typeof v.title !== "string") {
            const constName = findConstName(v);
            if (constName) v.title = capitalize(constName);
          }
          return enrichVariantTitles(v);
        }
        return variant;
      });
    }
  }
  for (const key of Object.keys(obj)) {
    obj[key] = enrichVariantTitles(obj[key]);
  }
  return obj as T;
}

/**
 * Walk the JSON Schema and add `multipleOf` to numeric fields whose
 * min/max declare a typical authoring range. The HTML number input picks
 * up `multipleOf` as `step`, which clamps manual entry to a sensible
 * precision and limits how many decimal places appear after a drag.
 *
 *   - 0..1 normalized (coords, fractions) → step 0.01
 *   - 0..100 percentages → step 1
 */
function injectStepConstraints<T>(schema: T): T {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) {
    return schema.map(injectStepConstraints) as unknown as T;
  }
  const obj = schema as Record<string, unknown>;
  if (
    obj.type === "number" &&
    typeof obj.minimum === "number" &&
    typeof obj.maximum === "number" &&
    typeof obj.multipleOf !== "number"
  ) {
    if (obj.minimum === 0 && obj.maximum === 1) obj.multipleOf = 0.01;
    else if (obj.minimum === 0 && obj.maximum === 100) obj.multipleOf = 1;
  }
  for (const key of Object.keys(obj)) {
    obj[key] = injectStepConstraints(obj[key]);
  }
  return obj as T;
}

/**
 * Walk the JSON Schema tree and inject sensible per-property defaults
 * into the items of every `array` schema, so RJSF's "Add" button creates
 * a fully-valid item instead of one missing required fields.
 *
 * Without this, clicking "+ Add zone" on a drag-and-drop form emits a
 * zone whose `id` and `rect` are undefined — failing the schema's
 * `id: string.min(1)` and `rect: { x,y,w,h: number 0..1 }` checks and
 * lighting up the form with red errors before the author has typed
 * anything. The defaults below cover the recurring shapes across all
 * activity kinds:
 *
 *   - `id`: an empty string default so RJSF emits the property; the
 *     author types over it. (Defaulting to a generated id is tempting,
 *     but RJSF would then duplicate it on every Add — keep it inert.)
 *   - `label`, `text`, `definition`, `term`, etc. (string + minLength 1)
 *     → empty string default. AJV still flags it, but the field is
 *     visible to type into rather than missing-required-property hidden.
 *   - `rect: { x, y, w, h }`: each gets 0.1 / 0.1 / 0.2 / 0.2 — a small
 *     visible rectangle near the top-left of the background image.
 *   - `position: { x, y }` (normalised 0..1): 0.5 / 0.5 — centred.
 *   - `position: { x, y, z }` (3D): 0,0,0 — model origin.
 *   - `correctZones: string[]` (min 1) and similar arrays-with-min: an
 *     empty array still violates min, but a populated default of "" lets
 *     the author see the field and fill it in. For now we keep the empty
 *     array; the prompt's other fields are the more painful gap.
 */
function injectArrayItemDefaults<T>(schema: T): T {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) {
    return schema.map(injectArrayItemDefaults) as unknown as T;
  }
  const obj = schema as Record<string, unknown>;
  if (obj.type === "array" && obj.items && typeof obj.items === "object") {
    seedDefaults(obj.items as Record<string, unknown>);
  }
  for (const key of Object.keys(obj)) {
    obj[key] = injectArrayItemDefaults(obj[key]);
  }
  return obj as T;
}

const RECT_DEFAULTS: Record<string, number> = { x: 0.1, y: 0.1, w: 0.2, h: 0.2 };

/**
 * Walk a single item schema (which is itself an object schema) and add
 * a `default` to each required-or-typed property that doesn't already
 * have one. Recurses into nested objects so e.g. a zone's `rect.x`
 * picks up its 0.1 default.
 */
function seedDefaults(itemSchema: Record<string, unknown>): void {
  const props = itemSchema.properties;
  if (!props || typeof props !== "object") return;
  for (const [name, raw] of Object.entries(props as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const propSchema = raw as Record<string, unknown>;
    if (propSchema.default !== undefined) continue;
    const type = propSchema.type;
    if (type === "string") {
      // Stringy id-like or text-like fields render best with an empty
      // string so the input shows up empty rather than disappearing.
      propSchema.default = "";
    } else if (type === "number" || type === "integer") {
      // Rect-component fields get the geometric defaults; others get 0.
      propSchema.default = RECT_DEFAULTS[name] ?? 0;
    } else if (type === "boolean") {
      propSchema.default = false;
    } else if (type === "array") {
      propSchema.default = [];
    } else if (type === "object") {
      // Recurse — and pre-build the nested object so its child fields
      // exist as soon as the array item is added.
      seedDefaults(propSchema);
      const nestedProps = propSchema.properties as Record<string, unknown> | undefined;
      if (nestedProps) {
        const nestedDefault: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(nestedProps)) {
          const d = (v as Record<string, unknown>).default;
          if (d !== undefined) nestedDefault[k] = d;
        }
        if (Object.keys(nestedDefault).length > 0) {
          propSchema.default = nestedDefault;
        }
      }
    }
  }
}

function findConstName(variant: Record<string, unknown>): string | null {
  const props = variant.properties;
  if (props && typeof props === "object") {
    for (const value of Object.values(props as Record<string, unknown>)) {
      if (value && typeof value === "object") {
        const c = (value as { const?: unknown }).const;
        if (typeof c === "string") return c;
      }
    }
  }
  return null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/([A-Z])/g, " $1");
}
