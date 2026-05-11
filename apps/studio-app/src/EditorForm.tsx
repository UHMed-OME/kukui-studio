import { lazy, Suspense, useMemo } from "react";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import type { IChangeEvent } from "@rjsf/core";
import type { ErrorSchema, RJSFSchema } from "@rjsf/utils";
import { z } from "zod";
import { SchemaRegistry, type SchemaRegistryKey } from "@kukui/schemas";
import type { ActivityKind } from "@kukui/core";
import { UI_SCHEMAS } from "./uiSchemas.js";
import { ArrayFieldTemplate } from "./templates/ArrayFieldTemplate.js";
import { ObjectFieldTemplate } from "./templates/ObjectFieldTemplate.js";
import { FieldTemplate } from "./templates/FieldTemplate.js";
import { FileUploadWidget } from "./widgets/FileUploadWidget.js";
import { NodeSelectWidget } from "./widgets/NodeSelectWidget.js";

// Lazy-loaded — Tiptap + StarterKit + linkify is ~90-120 KB gz and only
// renders when the active activity has at least one `ui:widget: "html"`
// field. Wrapping the whole RJSF <Form> in Suspense keeps the form
// render-once and lets RJSF mount the widget normally; React resolves
// the lazy chunk lazily the first time it's needed.
const RichTextWidget = lazy(() =>
  import("./widgets/RichTextWidget.js").then((m) => ({ default: m.RichTextWidget })),
);

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
    return injectStepConstraints(enrichVariantTitles(raw));
  }, [kind]);

  const handleChange = (e: IChangeEvent) => {
    onChange(e.formData);
  };

  const uiSchema = useMemo(
    () => ({
      "ui:submitButtonOptions": { norender: true },
      // Schema-internal fields that should never appear in the form, even
      // when an activity has no per-kind uiSchema entry yet. Per-kind
      // entries can still override these.
      _comment: { "ui:widget": "hidden" },
      version: { "ui:widget": "hidden" },
      $schema: { "ui:widget": "hidden" },
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
