import { useMemo } from "react";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import type { IChangeEvent } from "@rjsf/core";
import type { RJSFSchema } from "@rjsf/utils";
import { z } from "zod";
import { SchemaRegistry, type SchemaRegistryKey } from "@kukui/schemas";
import type { ActivityKind } from "@kukui/core";
import { UI_SCHEMAS } from "./uiSchemas.js";
import { ArrayFieldTemplate } from "./templates/ArrayFieldTemplate.js";
import { ObjectFieldTemplate } from "./templates/ObjectFieldTemplate.js";

/**
 * Auto-generated form per activity kind.
 *
 * The Zod schema is converted to JSON Schema via zod-to-json-schema, then
 * rendered with RJSF. This means every field across the seven activity
 * types is editable without hand-writing one form per kind.
 *
 * Limitations: discriminated unions render as `oneOf` selectors which are
 * a bit clunky; complex `additionalProperties: false` objects sometimes
 * confuse RJSF. The escape hatch is the JSON-tab fallback below.
 */
export function EditorForm({
  kind,
  value,
  onChange,
}: {
  kind: ActivityKind;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const jsonSchema = useMemo<RJSFSchema>(() => {
    const zod = SchemaRegistry[kind as SchemaRegistryKey];
    // Zod 4 ships its own JSON-Schema export. RJSF + AJV speak draft-7,
    // so target that explicitly (the default is draft-2020-12).
    const raw = z.toJSONSchema(zod, { target: "draft-7" }) as RJSFSchema;
    return enrichVariantTitles(raw);
  }, [kind]);

  const handleChange = (e: IChangeEvent) => {
    onChange(e.formData);
  };

  const uiSchema = useMemo(
    () => ({
      "ui:submitButtonOptions": { norender: true },
      ...UI_SCHEMAS[kind],
    }),
    [kind],
  );

  return (
    <div className="rjsf">
      <Form
        schema={jsonSchema}
        formData={value}
        validator={validator}
        onChange={handleChange}
        liveValidate={false}
        showErrorList={false}
        uiSchema={uiSchema}
        templates={{
          ArrayFieldTemplate,
          ObjectFieldTemplate,
        }}
      />
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
