/**
 * Curated provider presets — six well-known OpenAI-compatible endpoints
 * plus a Custom option. Picking a preset pre-fills the base URL and a
 * suggested model in the settings dialog; the user still provides their
 * own key.
 *
 * Note: Gemini is not OpenAI-compatible at `generativelanguage.googleapis.com`,
 * so it's reachable via OpenRouter (or a user-stood-up proxy) rather than
 * direct.
 */
export type ProviderPresetId =
  | "openai"
  | "groq"
  | "together"
  | "openrouter"
  | "anthropic"
  | "gemini"
  | "azure"
  | "custom";

export type ProviderPreset = {
  id: ProviderPresetId;
  label: string;
  /** Empty for `custom` and `azure` — those need the user to enter a base URL. */
  baseUrl: string;
  /** Suggested default model. */
  model: string;
  /** Deep link to the provider's key dashboard. */
  signupUrl: string;
  /** One-line description shown next to the picker. */
  description: string;
};

export const PRESETS: readonly ProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    signupUrl: "https://platform.openai.com/api-keys",
    description: "OpenAI direct, supports strict json_schema output.",
  },
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.1-70b-versatile",
    signupUrl: "https://console.groq.com/keys",
    description: "Fast inference with a generous free tier.",
  },
  {
    id: "together",
    label: "Together",
    baseUrl: "https://api.together.xyz/v1",
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    signupUrl: "https://api.together.ai/settings/api-keys",
    description: "Hosted open-weights with OpenAI-compatible JSON mode.",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o-mini",
    signupUrl: "https://openrouter.ai/keys",
    description: "Aggregator: one key reaches many model providers.",
  },
  {
    id: "anthropic",
    label: "Anthropic (OpenAI-compat)",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-3-5-sonnet-latest",
    signupUrl: "https://console.anthropic.com/settings/keys",
    description: "Anthropic's OpenAI-compatible Chat Completions shim.",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash",
    signupUrl: "https://aistudio.google.com/apikey",
    description:
      "Google AI Studio key, free tier with generous quota. Note: institutional Google Workspace tenants (incl. UH) often block AI Studio at the admin level; try Groq / Together / OpenRouter instead if the signup link is blocked.",
  },
  {
    id: "azure",
    label: "Azure OpenAI",
    baseUrl: "",
    model: "gpt-4o-mini",
    signupUrl: "https://portal.azure.com/",
    description: "Institutional: paste your resource URL and deployment.",
  },
  {
    id: "custom",
    label: "Custom",
    baseUrl: "",
    model: "",
    signupUrl: "",
    description: "Local model (Ollama, vLLM) or institutional proxy.",
  },
] as const;

export function findPreset(id: ProviderPresetId): ProviderPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/**
 * Match an existing baseUrl back to a preset id — used to restore the
 * dropdown selection when the dialog opens. Falls back to `custom`.
 */
export function presetForBaseUrl(baseUrl: string): ProviderPresetId {
  const trimmed = baseUrl.trim().replace(/\/$/, "");
  for (const p of PRESETS) {
    if (!p.baseUrl) continue;
    if (p.baseUrl.replace(/\/$/, "") === trimmed) return p.id;
  }
  return "custom";
}
