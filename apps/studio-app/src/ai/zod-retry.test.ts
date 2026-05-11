/**
 * Validates the Zod-error refinement flow: when the model's first output
 * fails schema validation, we feed the error back as a follow-up message
 * and try once more. This test exercises the chat-completions client
 * directly, mocking fetch — the AIEditor component wires the retry
 * around the same primitive.
 */
import { describe, expect, it, vi } from "vitest";
import { SchemaRegistry } from "@kukui/schemas";
import { callStructured } from "./chat-completions.js";
import { DEFAULT_SETTINGS, type AISettings } from "./settings.js";

const settings: AISettings = {
  ...DEFAULT_SETTINGS,
  baseUrl: "https://api.example.com/v1",
  model: "test-model",
  apiKey: "sk-test",
};

function okResponse(json: unknown): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(json) } }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("zod-retry flow", () => {
  it("feeds Zod errors back into the model on retry", async () => {
    // First response is structurally invalid for any of our schemas
    // (missing required fields). Second response is a minimal valid
    // reflection-prompt config.
    const invalid = { not: "valid" };
    const valid = {
      version: "1.0",
      title: "Quick reflection",
      prompt: "<p>Describe a clinical encounter where you felt unprepared.</p>",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse(invalid))
      .mockResolvedValueOnce(okResponse(valid));

    // First call — expect Zod to reject after a successful HTTP fetch.
    const first = await callStructured({
      kind: "reflection-prompt",
      settings,
      userPrompt: "make me a reflection",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const firstValidation = SchemaRegistry["reflection-prompt"].safeParse(first.json);
    expect(firstValidation.success).toBe(false);

    // Simulate the AIEditor's retry: call again with a refinement string.
    const second = await callStructured({
      kind: "reflection-prompt",
      settings: first.nextSettings,
      userPrompt: "make me a reflection",
      refinement: "Your previous output was missing required fields. Try again.",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const secondValidation = SchemaRegistry["reflection-prompt"].safeParse(second.json);
    expect(secondValidation.success).toBe(true);

    // Two fetches total; the second has the refinement appended.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(
      (fetchMock.mock.calls[1]![1] as RequestInit).body as string,
    );
    const userMsg = secondBody.messages.find((m: { role: string }) => m.role === "user");
    expect(userMsg.content).toMatch(/Follow-up:/);
    expect(userMsg.content).toMatch(/missing required fields/);
  });
});
