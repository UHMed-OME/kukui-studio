# AI Editor tab — design

**Date:** 2026-05-11
**Status:** Design ready for review; no code yet.
**Depends on:** Phase 1 (Engine + SCORM packaging) shipped; Phase 2 Studio in active use.

## Goal

A third tab inside Studio's editor panel — alongside *Form Editor* and *Raw JSON* — that lets an author generate or revise an activity config from natural language using any **OpenAI-compatible** LLM endpoint they have access to. Bring-your-own base URL + API key; both stay in the author's browser. No backend on our side, no shared key, no vendor lock-in.

The OpenAI Chat Completions API shape is now a de facto standard — works against OpenAI directly, Anthropic via their compat shim, Groq, Together, OpenRouter, Azure OpenAI, local Ollama / vLLM, or whatever proxy a school's IT department stands up. Faculty / IT picks the provider that fits their institutional rules; Studio doesn't care which.

Example flows we want to make natural:
- *"Make me a multiple-choice activity on iron-deficiency anemia, four options, one correct, USMLE step-1 difficulty."* → produces a valid `MultipleChoiceConfig` ready to preview.
- *"For my drag-and-drop, rewrite the chip labels so they're plain language instead of jargon."* → edits the existing JSON in place.
- *"Explain what this activity is testing."* → human-readable summary of the current JSON, no constraint mode.

## Architectural shape

```
apps/studio-app/src/
  ai/
    chat-completions.ts          # OpenAI-compatible REST client (browser fetch)
                                 # — base URL + key + model from settings
                                 # — JSON-schema → JSON-object → free-text fallback chain
    prompts/
      system-base.ts             # global system prompt
      per-kind/
        multiple-choice.ts       # per-activity author-guidance prompt fragments
        flashcards.ts
        … (one per kind)
    schemas-as-json.ts           # Zod → JSON Schema cache (zod-to-json-schema)
    settings.ts                  # localStorage / sessionStorage settings slot
    presets.ts                   # curated list of known-good endpoints
                                 # (one-click "use this provider" presets)
    AIEditor.tsx                 # the tab UI shell
    AISettingsDialog.tsx         # BYO-key + base URL dialog (modal)
  App.tsx                        # adds "AI editor" to the existing tab row
  styles.css                     # ai-editor specific styles (kukui-studio-ai-*)
```

The AI tab is **a sibling of Form Editor and Raw JSON**, sharing the same `value` state. When the AI returns a new config, the tab calls the same `setValue` the other tabs use, so Form Editor / Raw JSON / Preview all update simultaneously.

## Locked decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Where the key + base URL live | User's browser only — `localStorage` (or `sessionStorage` if they pick "this session only"). Never sent to anything we operate. |
| 2 | Provider API shape | **OpenAI Chat Completions API.** Single client targets any endpoint that implements `POST /v1/chat/completions`. We don't ship a shared key or a default endpoint. |
| 3 | Recommended endpoints (presets in the settings dialog) | A short curated list with one-click setup: OpenAI direct, Groq (free tier, fast), Together, OpenRouter, Anthropic's OpenAI-compat shim, Azure OpenAI (institutional users fill in their resource URL), and a "Custom" option. Each preset just pre-fills base URL + a suggested model — the user still provides their own key. |
| 4 | Default model | None hard-coded. Each preset suggests a sensible default (e.g. `gpt-4o-mini` for OpenAI, `llama-3.1-70b-versatile` for Groq, `claude-3-5-sonnet-latest` for Anthropic-compat). User can override. |
| 5 | Output safety — three-tier fallback chain | (a) `response_format: { type: "json_schema", strict: true, json_schema: <fromZod> }` if the endpoint supports it (OpenAI gpt-4o family, some others). (b) Falls back to `response_format: { type: "json_object" }` with JSON Schema embedded in the system prompt (Groq, Together, most others). (c) Falls back to plain text generation with explicit JSON formatting instructions if the endpoint rejects `response_format` entirely (some local models, older endpoints). Every path ends with Zod-parsing the response and offering an automatic one-shot retry on failure. |
| 6 | Refinement | Single-turn replacement in v1 (the prompt always sees the current activity JSON + the user's request). Multi-turn chat deferred to v2. |
| 7 | Cost / quota | Each user pays / consumes their own quota on whatever endpoint they configured. We display the model name and estimated input token count before sending. |
| 8 | Origin pinning | We display a generic note in the settings dialog: "Most providers let you restrict an API key to specific HTTP referrers in their dashboard. If yours does, pasting `https://kukuistudio.com/*` (or whatever your Studio URL is) into the restriction field means a leaked key only works from your Studio." Not enforced by us. |
| 9 | Privacy | The AI tab's request payload (current JSON + user prompt) goes directly from the browser to whatever base URL the user configured. We never see it. Documented in the Privacy & data dialog. |

## Generation modes

Three modes, picked at the top of the AI tab:

1. **Generate** — empty / minimal starter + user prompt → full activity. The model receives the per-kind system prompt and the JSON Schema; constrained output guaranteed by `responseSchema`.
2. **Edit** — current activity JSON + user prompt → revised JSON. Same schema constraint. The model sees the existing config so it preserves what the user already authored unless explicitly told to change it.
3. **Explain** — current JSON → human-readable summary, learning objectives the activity probably targets, suggested distractors / improvements. Free-text output; no `responseSchema`. Read-only — doesn't mutate the form value.

Mode selector defaults to **Edit** when the activity has been modified from its starter (heuristic: form value differs from `STARTERS[kind]`), otherwise **Generate**.

## Prompt scaffolding

Each request is built as a standard Chat Completions payload:

```
{
  model: <from settings>,
  messages: [
    { role: "system", content: <system-base.ts + per-kind/<kind>.ts> },
    { role: "user",   content: <current JSON, when Edit/Explain> + <user prompt> }
  ],
  response_format: <see fallback chain below>
}
```

**Fallback chain** picks the strictest output mode the endpoint accepts. We try each in order, cache which mode worked for each `(base URL × model)` pair:

1. `response_format: { type: "json_schema", strict: true, json_schema: { name: "<kind>", schema: <fromZod> } }` — OpenAI's strict structured output. Output is guaranteed to match the schema. Best case.
2. `response_format: { type: "json_object" }` with the JSON Schema serialized into the system prompt as text — output is valid JSON, schema adherence depends on the model's training. Groq, Together, most second-tier providers.
3. No `response_format`; prompt the model with "Respond with JSON only, no commentary." — pure model behaviour, weakest guarantee. Some local / older endpoints.

After the response:

1. `JSON.parse` the assistant message (strip a `\`\`\`json` fence if the model added one)
2. `SchemaRegistry[kind].safeParse` — the same Zod validator the rest of Studio uses
3. If Zod flags an issue, surface inline with a **Refine** button that re-prompts the model with the Zod error text in a follow-up user message: *"Your previous output failed validation: <issue path>: <issue message>. Please correct only that field."*. One automatic retry, then human-in-the-loop.

The per-kind prompt fragments are short pedagogical primers (~10 lines each). E.g., `prompts/per-kind/multiple-choice.ts`:

```
You are generating a Multiple Choice activity for medical education.
- Aim for 4–5 answer options. One clearly correct.
- Distractors should test specific misconceptions, not be obviously wrong.
- Include a brief `tip` per answer explaining why it's right or wrong;
  this is shown to the learner after they submit.
- The `question` field is HTML; use `<p>` for prose, `<em>`/`<strong>`
  for emphasis. Do NOT embed images.
- Keep the question stem under ~50 words.
```

Activities that benefit most (priority order for prompt-fragment authoring): multiple-choice, fill-in-the-blanks, flashcards, branching-scenario, ddx-tree, reflection-prompt, matching-pairs, sequence-steps, categorization, highlight-text, lab-panel, osce. The image/3D/canvas activities (hotspot-2d, hotspot-3d, anatomy-labeling, image-annotation, image-comparison-slider, drag-and-drop, virtual-tour) can use AI for *labels and prompts* but the author still has to provide media — the per-kind prompt for these instructs the model to use placeholder URLs and call out the media gap in its response.

## UI design

**Tab row** (existing):
```
[ Form Editor ] [ Raw JSON ] [ AI editor ]
```

**AI editor pane** layout:

```
┌──────────────────────────────────────────────────────────┐
│  Mode:  ( ) Generate   (•) Edit existing   ( ) Explain   │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Rewrite the distractors so each tests a           │  │
│  │  specific misconception about iron transport       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  [ Generate ]                            gpt-4o-mini   · │
│                                              ~480 tokens │
│                                                          │
│  Last response (12s ago):                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Proposed changes:                                 │  │
│  │  • Replaced 4 distractors                          │  │
│  │  • Updated 3 answer tips                           │  │
│  │  • Question stem unchanged                         │  │
│  │                                                    │  │
│  │  [ Show diff ▸ ]                                   │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  [ Accept ] [ Refine ] [ Discard ]                       │
└──────────────────────────────────────────────────────────┘
```

**Settings dialog** (Settings → AI):
- **Provider preset selector**: dropdown of curated presets (OpenAI, Groq, Together, OpenRouter, Anthropic-compat, Azure OpenAI, Custom). Picking a preset fills in:
  - the Base URL field with the provider's default (e.g. `https://api.openai.com/v1`)
  - the Model field with a sensible default
  - the "Where to get a key" link with the provider's signup URL
  - Selecting **Custom** unlocks the Base URL field for direct editing
- Base URL input (read-only when a preset is picked except Custom)
- Model input (free-text; presets pre-fill but user can override)
- API key input (`<input type="password">`, masked, last-4 shown after save)
- Storage toggle (Persistent / This session only)
- "Where to get a key" link (deep-links to the active preset's API-key page)
- "Restrict key to this site" instructions: generic note + the literal referrer string for the user to paste into their provider's key-restriction UI (if the provider supports it)
- "Clear all" button (wipes key, base URL, and model from storage)
- Privacy footer: "Your key never leaves this browser. Kukui Studio sends requests directly from your browser to the endpoint you configured."

**Empty state** (no key configured): the AI tab shows a friendly prompt to configure a key, with a link to the settings dialog and a one-paragraph explanation of why we don't ship a shared key.

## Milestones

### A1 — BYO-key plumbing + presets *(1 day)*

- `apps/studio-app/src/ai/settings.ts` — typed read/write of `kukui:studio:ai-settings` localStorage / sessionStorage slot; shape includes `baseUrl`, `model`, `apiKey`, `storage`, plus a cached `outputModeCapability` per `(baseUrl, model)` so we don't re-detect on every request
- `ai/presets.ts` — curated provider preset table: OpenAI, Groq, Together, OpenRouter, Anthropic-compat, Azure OpenAI, Custom
- `AISettingsDialog.tsx` — preset dropdown, base URL, model, masked key input, storage toggle, deep link to active preset's signup page
- Privacy & data dialog updated to note: "requests go directly from your browser to whatever endpoint you configured"
- Footer Settings affordance (gear icon) opens the dialog

### A2 — AI tab shell *(1 day)*

- Tab added to `App.tsx` tab row
- `AIEditor.tsx` with mode toggle, prompt textarea, generate button, response card, accept/refine/discard
- Empty-state when no key configured (links to settings + explains why no shared key)
- Token-count estimate (client-side approximation, `prompt.length / 4`)

### A3 — Chat Completions client + fallback chain *(1 day)*

- `ai/chat-completions.ts` — fetch wrapper, OpenAI-compatible payload, three-tier `response_format` fallback chain (json_schema → json_object → free-text), caches which mode worked for each (baseUrl, model) pair in settings
- `ai/schemas-as-json.ts` — Zod → JSON Schema, cached per kind (uses `zod-to-json-schema`)
- `ai/prompts/system-base.ts` — global Kukui system prompt
- `ai/prompts/per-kind/<kind>.ts` — pedagogical prompt fragments for the 12 priority kinds
- Generate mode end-to-end (with one Zod retry on failure)

### A4 — Edit + Refine *(1 day)*

- Edit mode includes current JSON in the user message
- Diff preview (compact "what changed" summary, plus a "Show diff" expander)
- Refine button feeds the Zod error or the user's follow-up back to the model with the prior response as context
- Accept replaces the form value via the shared `setValue`

### A5 — Explain mode + error handling polish *(½ day)*

- Explain mode: no `response_format`, free-text streaming response into a scrollable card
- 429 quota → friendly "Your provider returned a rate-limit error. Try again in a few minutes or check your plan with <provider>." with `Retry-After` honored if present
- 401 / 403 → "Your API key was rejected by <provider>. Open Settings to update it." with a deep link
- Network failure → retry button, no data loss (user prompt preserved)
- Per-kind prompts filled in for the remaining 11 activity kinds (placeholder + media-gap call-out)

**Total:** ~4.5 days. Could be compressed into a one-week sprint if A3 (prompt authoring per kind) is parallelized.

## Privacy & data — what to add to the existing dialog

> "If you enable the AI editor, requests go directly from your browser to whatever LLM endpoint you configured (OpenAI, Groq, your institution's internal proxy, etc.). Kukui Studio never sees or proxies the request. Your API key and base URL are stored in your browser only (localStorage or sessionStorage — your choice in the settings dialog). The activity JSON you're working on, plus your prompt, are sent to the endpoint you picked; the response comes back to your browser only. Your provider's data-handling policies apply to that traffic — pick a provider whose policies match your institution's rules."

## Open decisions

| # | Decision | Recommendation |
|---|---|---|
| AI-1 | Which presets to ship in v1? | **Six + Custom:** OpenAI, Groq, Together, OpenRouter, Anthropic-compat (`/v1/chat/completions` on api.anthropic.com), Azure OpenAI, plus Custom. Excludes Gemini for now — Google's `generativelanguage.googleapis.com` is not OpenAI-compat; an OpenRouter / proxy detour is the cleanest way to reach Gemini until/if we add a second provider shape. |
| AI-2 | Default preset | **None.** The settings dialog opens with no preset selected, forcing the user to make an active choice (and giving us a chance to surface the privacy implications per preset). |
| AI-3 | Multi-turn refine chat | **No — single-shot in v1.** Refine resends the full context with the user's follow-up. Multi-turn is v2 if authors ask for it. |
| AI-4 | Should Explain mode mutate the form? | **No.** Read-only. If the user wants to act on the explanation, they switch to Edit mode and write a follow-up. |
| AI-5 | Token-count estimation accuracy | **Coarse client-side `length/4`** is fine. We're not billing — the user is. |
| AI-6 | Origin-pinning enforcement | **Recommendation only**, not enforcement. We display the referrer string; whether the provider supports HTTP-referrer restriction is up to them. |
| AI-7 | Logging / telemetry on AI usage | **None.** We don't operate analytics; the AI tab follows that same rule. |
| AI-8 | What happens when an endpoint returns CORS errors? | **Surface as a configuration error with a documentation link.** Some providers require CORS pre-flight to be enabled at the key level; some institutional proxies block browser-origin requests entirely. We can't fix this in the client — but we can detect it and tell the user clearly. |
| AI-9 | Cache the output-mode capability per (baseUrl, model)? | **Yes.** First request probes the strictest mode; downgrades on 400/422 and caches the working mode in the settings slot so subsequent requests skip the dance. User can clear the cache from the settings dialog ("Re-detect output mode"). |

## What this design deliberately defers

- **Server-side proxy / shared key.** Would require ops + billing + a privacy data-flow we don't want. Static-site stays static.
- **Streaming responses.** The Chat Completions API supports SSE streaming across most providers; we land non-streaming first and add streaming for Explain mode if the latency feels long.
- **Media generation (DALL-E / Imagen / etc.).** Out of scope. Authors source their own media.
- **Per-LMS prompt customization.** We don't customize prompts based on D2L vs Canvas vs Moodle — the activity content is LMS-agnostic.
- **Caching previous responses.** Each request is independent; we don't dedupe.
- **Cost dashboards.** The user checks usage in whichever provider dashboard they configured.

## References

- OpenAI Chat Completions API: <https://platform.openai.com/docs/api-reference/chat>
- OpenAI Structured Outputs (`response_format: json_schema`): <https://platform.openai.com/docs/guides/structured-outputs>
- Anthropic OpenAI-compatible endpoint: <https://docs.anthropic.com/en/api/openai-sdk>
- Groq API (OpenAI-compatible): <https://console.groq.com/docs/quickstart>
- Together OpenAI-compatible: <https://docs.together.ai/docs/openai-api-compatibility>
- OpenRouter: <https://openrouter.ai/docs>
- Azure OpenAI: <https://learn.microsoft.com/en-us/azure/ai-services/openai/reference>
- `zod-to-json-schema` lib: <https://www.npmjs.com/package/zod-to-json-schema>
- Engine Phase 1 plan: [`./2026-05-05-engine-phase-1-plan.md`](./2026-05-05-engine-phase-1-plan.md)
- Kukui Live plan: [`./2026-05-06-kukui-live-plan.md`](./2026-05-06-kukui-live-plan.md)
