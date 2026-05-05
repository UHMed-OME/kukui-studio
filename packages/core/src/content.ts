import { z } from "zod";

/**
 * Loads a JSON config from a URL and validates it against the supplied Zod
 * schema. Returns the parsed-and-typed config; throws a `ContentLoadError`
 * with a useful message on any failure.
 */
export async function loadContent<S extends z.ZodTypeAny>(
  url: string,
  schema: S,
): Promise<z.infer<S>> {
  let response: Response;
  try {
    response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  } catch (cause) {
    throw new ContentLoadError(`Network error fetching ${url}`, { cause });
  }
  if (!response.ok) {
    throw new ContentLoadError(
      `Fetch ${url} returned ${response.status} ${response.statusText}`,
    );
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch (cause) {
    throw new ContentLoadError(`Invalid JSON at ${url}`, { cause });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ContentLoadError(`Schema validation failed for ${url}`, {
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}

export class ContentLoadError extends Error {
  readonly issues?: readonly z.ZodIssue[];
  constructor(
    message: string,
    options?: { cause?: unknown; issues?: readonly z.ZodIssue[] },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "ContentLoadError";
    if (options?.issues) this.issues = options.issues;
  }
}
