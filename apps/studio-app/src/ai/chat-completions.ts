/**
 * OpenAI-compatible Chat Completions client.
 *
 * Browser fetch — base URL, API key, and model come from settings.ts.
 *
 * Three-tier `response_format` fallback chain:
 *   1. `json_schema` — strict structured output. OpenAI gpt-4o family and a
 *      few others. Output is guaranteed to match the schema.
 *   2. `json_object` — output is valid JSON; schema adherence depends on the
 *      model. Groq, Together, most second-tier providers.
 *   3. free-text — no `response_format`. Some local / older endpoints reject
 *      `response_format` entirely. We instruct the model to respond with JSON
 *      only and parse defensively.
 *
 * The working mode is cached per (baseUrl, model) so subsequent requests
 * skip the dance.
 */
import type { SchemaRegistryKey } from "@kukui/schemas";
import {
  type AISettings,
  type OutputMode,
  getCachedMode,
  saveSettings,
  setCachedMode,
} from "./settings.js";
import { getJsonSchema } from "./schemas-as-json.js";
import { systemPromptFor } from "./prompts/index.js";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StructuredCallOptions = {
  /** Activity kind drives both the per-kind prompt and the JSON Schema. */
  kind: SchemaRegistryKey;
  /** Settings (key, baseUrl, model, cache). */
  settings: AISettings;
  /** User-facing prompt — what the author typed. */
  userPrompt: string;
  /**
   * Optional current activity JSON, included for Edit / Refine modes so
   * the model preserves the parts the user didn't ask to change.
   */
  currentJson?: unknown;
  /**
   * Optional follow-up message (e.g. Zod error feedback for an automatic
   * retry). Appended as a final user message.
   */
  refinement?: string;
  /** Fetch override (test seam). */
  fetchImpl?: typeof fetch;
};

export type StructuredCallResult = {
  /** Parsed JSON returned by the model. Caller still has to Zod-validate. */
  json: unknown;
  /** Which output mode actually worked. */
  mode: OutputMode;
  /** Settings with the (possibly updated) cache, ready to persist. */
  nextSettings: AISettings;
};

/** Errors we surface back to the UI with stable codes for branching. */
export class ChatCompletionsError extends Error {
  code:
    | "no-settings"
    | "unauthorized"
    | "rate-limited"
    | "cors"
    | "network"
    | "bad-response"
    | "parse"
    | "schema-rejected"
    | "server";
  status?: number;
  retryAfterMs?: number;

  constructor(
    code: ChatCompletionsError["code"],
    message: string,
    opts: { status?: number; retryAfterMs?: number; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "ChatCompletionsError";
    this.code = code;
    this.status = opts.status;
    this.retryAfterMs = opts.retryAfterMs;
    if (opts.cause) (this as unknown as { cause: unknown }).cause = opts.cause;
  }
}

/**
 * Redact obvious secret shapes from a string before we surface it to UI or
 * console. Provider error bodies sometimes echo the inbound request — if a
 * misconfigured proxy or a verbose 400 response returns the Authorization
 * header or an `sk-…` key fragment, we must not display it.
 */
export function redactSecrets(s: string): string {
  return s
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, "sk-[redacted]")
    .replace(/key=[A-Za-z0-9_-]{10,}/g, "key=[redacted]");
}

/** Detect parsing of `Retry-After` header for 429 handling. */
function parseRetryAfter(h: string | null): number | undefined {
  if (!h) return undefined;
  const seconds = Number(h);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  // HTTP-date variant — fall back to "try again in a moment."
  const ms = Date.parse(h) - Date.now();
  return ms > 0 ? ms : undefined;
}

/** Build the messages array shared by all three modes. */
function buildMessages(opts: StructuredCallOptions, mode: OutputMode): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPromptFor(opts.kind) },
  ];

  // For json_object and free_text we embed the JSON Schema as text in the
  // system message so the model knows the target shape. (json_schema mode
  // gets the schema directly in response_format, so the system prompt
  // doesn't need to repeat it.)
  if (mode !== "json_schema") {
    const schema = getJsonSchema(opts.kind);
    const note =
      mode === "free_text"
        ? "Respond with a JSON object only. No prose, no markdown fences, no commentary. The output must conform to this JSON Schema:"
        : "The output must conform to this JSON Schema:";
    messages.push({
      role: "system",
      content: `${note}\n\n${JSON.stringify(schema, null, 2)}`,
    });
  }

  const userParts: string[] = [];
  if (opts.currentJson !== undefined) {
    userParts.push(
      `Current activity JSON (preserve fields the user didn't ask to change):\n\`\`\`json\n${JSON.stringify(
        opts.currentJson,
        null,
        2,
      )}\n\`\`\``,
    );
  }
  userParts.push(`Author request: ${opts.userPrompt.trim()}`);
  if (opts.refinement) {
    userParts.push(`Follow-up: ${opts.refinement.trim()}`);
  }
  messages.push({ role: "user", content: userParts.join("\n\n") });
  return messages;
}

function buildResponseFormat(kind: SchemaRegistryKey, mode: OutputMode): unknown | undefined {
  if (mode === "json_schema") {
    // strict: false on purpose — OpenAI's strict mode requires every
    // property to appear in `required` and no `additionalProperties`,
    // which fights Zod schemas that use `.optional()` extensively (most
    // of ours do, esp. `behaviour` / `ui` blocks). We still send the
    // schema for the model to use as guidance and validate the response
    // with Zod on our side, so flipping strict off costs us nothing and
    // skips a guaranteed 400 from OpenAI's family of models.
    return {
      type: "json_schema",
      json_schema: {
        name: kind.replace(/-/g, "_"),
        strict: false,
        schema: getJsonSchema(kind),
      },
    };
  }
  if (mode === "json_object") {
    return { type: "json_object" };
  }
  return undefined;
}

function joinUrl(base: string, path: string): string {
  const trimmed = base.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${trimmed}${suffix}`;
}

/**
 * Strip `\`\`\`json` fences if the model wrapped its output. We do this
 * for all modes — even strict structured output has been observed to
 * occasionally emit fences when temperature drifts.
 */
export function stripJsonFence(s: string): string {
  const trimmed = s.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch && fenceMatch[1] !== undefined) return fenceMatch[1].trim();
  return trimmed;
}

/**
 * Best-effort assistant-content extractor. The official OpenAI shape is
 * `choices[0].message.content` (string). Some providers also surface tool
 * calls with the structured output in `message.tool_calls[0].function.arguments`.
 */
function extractContent(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new ChatCompletionsError("bad-response", "Provider returned a non-object body.");
  }
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new ChatCompletionsError("bad-response", "Provider returned no choices.");
  }
  const msg = (choices[0] as { message?: { content?: unknown; tool_calls?: unknown } }).message;
  if (!msg) throw new ChatCompletionsError("bad-response", "Provider response missing message.");
  if (typeof msg.content === "string" && msg.content.length > 0) return msg.content;
  // Some structured-output flavours stash the JSON in a tool-call argument.
  const toolCalls = Array.isArray(msg.tool_calls) ? (msg.tool_calls as unknown[]) : [];
  for (const tc of toolCalls) {
    const args = (tc as { function?: { arguments?: unknown } }).function?.arguments;
    if (typeof args === "string" && args.length > 0) return args;
  }
  throw new ChatCompletionsError("bad-response", "Provider response missing content.");
}

/**
 * Single attempt at the given output mode. Throws ChatCompletionsError on
 * non-2xx, network error, or parse failure. The fallback chain catches the
 * `schema-rejected` variant and downgrades.
 */
async function attempt(
  opts: StructuredCallOptions,
  mode: OutputMode,
): Promise<{ json: unknown }> {
  const { settings } = opts;
  const url = joinUrl(settings.baseUrl, "/chat/completions");
  const messages = buildMessages(opts, mode);
  const responseFormat = buildResponseFormat(opts.kind, mode);
  const body: Record<string, unknown> = {
    model: settings.model,
    messages,
    temperature: 0.6,
  };
  if (responseFormat) body.response_format = responseFormat;

  const f = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await f(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // Browser CORS rejections surface as `TypeError: Failed to fetch` —
    // there's no clean way to distinguish them from real network failures
    // from inside the fetch promise, so we lump them together and let
    // the UI surface a friendly "could be CORS, could be down" message.
    const msg = err instanceof Error ? err.message : String(err);
    const looksLikeCors = /failed to fetch|networkerror|cors/i.test(msg);
    throw new ChatCompletionsError(
      looksLikeCors ? "cors" : "network",
      looksLikeCors
        ? "Couldn't reach the provider. This is often a CORS restriction. Some institutional proxies block browser requests entirely."
        : "Network error reaching the provider.",
      { cause: err },
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new ChatCompletionsError(
      "unauthorized",
      "Your API key was rejected by the provider. Open settings to update it.",
      { status: res.status },
    );
  }
  if (res.status === 429) {
    throw new ChatCompletionsError(
      "rate-limited",
      "Provider returned a rate-limit error. Try again in a few minutes or check your plan.",
      { status: res.status, retryAfterMs: parseRetryAfter(res.headers.get("retry-after")) },
    );
  }
  if (res.status === 400 || res.status === 422) {
    // Schema rejected — surface as a downgrade-trigger. Redact common
    // secret shapes (Bearer tokens, OpenAI-style `sk-...` keys, `key=...`
    // query params) before slicing so we never echo an API key into UI
    // or console output.
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      /* noop */
    }
    const redacted = redactSecrets(detail);
    throw new ChatCompletionsError(
      "schema-rejected",
      `Provider rejected ${mode} output (${res.status}): ${redacted.slice(0, 200)}`,
      { status: res.status },
    );
  }
  if (!res.ok) {
    throw new ChatCompletionsError("server", `Provider returned ${res.status}.`, {
      status: res.status,
    });
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch (err) {
    throw new ChatCompletionsError("parse", "Couldn't parse provider response as JSON.", {
      cause: err,
    });
  }
  const content = extractContent(payload);
  const stripped = stripJsonFence(content);
  let json: unknown;
  try {
    json = JSON.parse(stripped);
  } catch (err) {
    throw new ChatCompletionsError(
      "parse",
      "Couldn't parse the model's output as JSON. Try again or switch to a model with better JSON adherence.",
      { cause: err },
    );
  }
  return { json };
}

const FALLBACK_CHAIN: readonly OutputMode[] = ["json_schema", "json_object", "free_text"] as const;

/**
 * Top-level call. Honours the cached mode when present; otherwise walks
 * the fallback chain from strictest to loosest, downgrading on 400/422
 * (`schema-rejected`). Updates the cache with the working mode.
 *
 * Other error classes (unauthorized, rate-limited, network/CORS, server)
 * are not downgrades — they propagate immediately.
 */
export async function callStructured(
  opts: StructuredCallOptions,
): Promise<StructuredCallResult> {
  const { settings } = opts;
  if (!settings.apiKey || !settings.baseUrl || !settings.model) {
    throw new ChatCompletionsError("no-settings", "AI editor isn't configured yet.");
  }

  const cached = getCachedMode(settings, settings.baseUrl, settings.model);
  // Cached mode pinned — but if the cached mode also gets schema-rejected
  // (rare but possible if the provider tightened things), we re-walk the
  // chain below it.
  const order: OutputMode[] = cached
    ? [cached, ...FALLBACK_CHAIN.filter((m) => m !== cached)]
    : [...FALLBACK_CHAIN];

  let lastError: ChatCompletionsError | null = null;
  for (const mode of order) {
    try {
      const { json } = await attempt(opts, mode);
      const nextSettings = setCachedMode(settings, settings.baseUrl, settings.model, mode);
      // Persist the cache so the next call (possibly from a fresh tab)
      // skips the dance. Best-effort — failures are non-fatal.
      try {
        saveSettings(nextSettings);
      } catch {
        /* noop */
      }
      return { json, mode, nextSettings };
    } catch (err) {
      if (err instanceof ChatCompletionsError && err.code === "schema-rejected") {
        lastError = err;
        continue; // downgrade
      }
      throw err;
    }
  }
  throw (
    lastError ??
    new ChatCompletionsError(
      "schema-rejected",
      "Every output mode was rejected by the provider.",
    )
  );
}
