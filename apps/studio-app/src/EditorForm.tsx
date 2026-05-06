import { useMemo } from "react";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import type { IChangeEvent } from "@rjsf/core";
import type { RJSFSchema } from "@rjsf/utils";
import { zodToJsonSchema } from "zod-to-json-schema";
import { SchemaRegistry, type SchemaRegistryKey } from "@kukui/schemas";
import type { ActivityKind } from "@kukui/core";

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
    // zod-to-json-schema's exported types lag Zod 4's ZodObject shape;
    // runtime conversion still works against either. Cast through unknown.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return zodToJsonSchema(zod as any, { target: "jsonSchema7" }) as RJSFSchema;
  }, [kind]);

  const handleChange = (e: IChangeEvent) => {
    onChange(e.formData);
  };

  return (
    <div className="rjsf">
      <Form
        schema={jsonSchema}
        formData={value}
        validator={validator}
        onChange={handleChange}
        liveValidate={false}
        showErrorList={false}
        // RJSF's default Submit is unhelpful here — the toolbar handles save/download.
        uiSchema={{ "ui:submitButtonOptions": { norender: true } }}
      />
    </div>
  );
}
