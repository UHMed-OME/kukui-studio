/**
 * Zod → JSON Schema conversion for the OpenAI structured-output payload.
 *
 * Originally targeted the third-party `zod-to-json-schema` library, but
 * that package's types still expect Zod v3 — feeding it our Zod v4
 * schemas trips a structural type mismatch. Zod 4 ships its own
 * `z.toJSONSchema` API, which produces the same shape and supports the
 * same draft variants we need. We use that instead.
 *
 * Cached per kind because re-serializing a deep Zod schema on every
 * request is wasteful — the schemas are static at module-load time.
 */
import { z } from "zod";
import { SchemaRegistry, type SchemaRegistryKey } from "@kukui/schemas";

const cache = new Map<SchemaRegistryKey, Record<string, unknown>>();

export function getJsonSchema(kind: SchemaRegistryKey): Record<string, unknown> {
  const cached = cache.get(kind);
  if (cached) return cached;
  const schema = SchemaRegistry[kind];
  // `target: "draft-07"` is the dialect OpenAI's structured-output endpoint
  // actually consumes. `unrepresentable: "any"` keeps the conversion alive
  // when a deep Zod construct doesn't have a JSON Schema equivalent (gets
  // emitted as `{}` instead of throwing).
  const json = z.toJSONSchema(schema, {
    target: "draft-07",
    unrepresentable: "any",
    // `inline` keeps everything in one object — no $ref needed.
    reused: "inline",
  }) as Record<string, unknown>;
  cache.set(kind, json);
  return json;
}

/** Test seam — flush the cache between runs. */
export function _clearJsonSchemaCache(): void {
  cache.clear();
}
