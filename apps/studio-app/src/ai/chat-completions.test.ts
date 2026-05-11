import { describe, expect, it, vi } from "vitest";
import {
  callStructured,
  ChatCompletionsError,
  stripJsonFence,
} from "./chat-completions.js";
import { DEFAULT_SETTINGS, type AISettings } from "./settings.js";

const baseSettings: AISettings = {
  ...DEFAULT_SETTINGS,
  baseUrl: "https://api.example.com/v1",
  model: "test-model",
  apiKey: "sk-test",
};

function okResponse(json: unknown, body?: Partial<Record<string, unknown>>): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: typeof json === "string" ? json : JSON.stringify(json) } }],
      ...body,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function errorResponse(status: number, body: string = ""): Response {
  return new Response(body, { status });
}

describe("ai/chat-completions", () => {
  describe("stripJsonFence", () => {
    it("returns input unchanged when no fence is present", () => {
      expect(stripJsonFence('{"a":1}')).toBe('{"a":1}');
    });
    it("strips ```json fences", () => {
      expect(stripJsonFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
    });
    it("strips bare ``` fences", () => {
      expect(stripJsonFence('```\n{"a":1}\n```')).toBe('{"a":1}');
    });
  });

  describe("callStructured fallback chain", () => {
    it("succeeds with json_schema on first try when supported", async () => {
      // The drag-and-drop schema is small and exercised in fixtures, so
      // even a minimal valid object is useful here. We mock the fetch
      // entirely so the Zod validation in caller-land is bypassed.
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(okResponse({ ok: true }));
      const result = await callStructured({
        kind: "multiple-choice",
        settings: baseSettings,
        userPrompt: "test",
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      expect(result.mode).toBe("json_schema");
      expect(result.json).toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      // The first attempt should have included a `response_format` of
      // type json_schema in the body.
      const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
      expect(body.response_format.type).toBe("json_schema");
    });

    it("downgrades to json_object on a 400 from the schema mode", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(errorResponse(400, "schema not supported"))
        .mockResolvedValueOnce(okResponse({ ok: true }));
      const result = await callStructured({
        kind: "multiple-choice",
        settings: baseSettings,
        userPrompt: "test",
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      expect(result.mode).toBe("json_object");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const secondBody = JSON.parse(
        (fetchMock.mock.calls[1]![1] as RequestInit).body as string,
      );
      expect(secondBody.response_format.type).toBe("json_object");
    });

    it("downgrades all the way to free_text on repeated 422s", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(errorResponse(422, "no response_format"))
        .mockResolvedValueOnce(errorResponse(422, "no json_object either"))
        .mockResolvedValueOnce(okResponse({ ok: true }));
      const result = await callStructured({
        kind: "multiple-choice",
        settings: baseSettings,
        userPrompt: "test",
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      expect(result.mode).toBe("free_text");
      expect(fetchMock).toHaveBeenCalledTimes(3);
      const lastBody = JSON.parse(
        (fetchMock.mock.calls[2]![1] as RequestInit).body as string,
      );
      expect(lastBody.response_format).toBeUndefined();
    });

    it("caches the working mode in returned settings", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(errorResponse(400, ""))
        .mockResolvedValueOnce(okResponse({ ok: true }));
      const result = await callStructured({
        kind: "multiple-choice",
        settings: baseSettings,
        userPrompt: "test",
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      expect(result.nextSettings.outputModeCache).toMatchObject({
        [`${baseSettings.baseUrl}|${baseSettings.model}`]: "json_object",
      });
    });

    it("strips ```json fences from the response before parsing", async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        okResponse('```json\n{"ok":true}\n```'),
      );
      const result = await callStructured({
        kind: "multiple-choice",
        settings: baseSettings,
        userPrompt: "test",
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      expect(result.json).toEqual({ ok: true });
    });

    it("propagates 401 as unauthorized without downgrading", async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(errorResponse(401));
      await expect(
        callStructured({
          kind: "multiple-choice",
          settings: baseSettings,
          userPrompt: "test",
          fetchImpl: fetchMock as unknown as typeof fetch,
        }),
      ).rejects.toMatchObject({ code: "unauthorized" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("propagates 429 as rate-limited with retry-after", async () => {
      const res = new Response("{}", {
        status: 429,
        headers: { "retry-after": "30" },
      });
      const fetchMock = vi.fn().mockResolvedValueOnce(res);
      try {
        await callStructured({
          kind: "multiple-choice",
          settings: baseSettings,
          userPrompt: "test",
          fetchImpl: fetchMock as unknown as typeof fetch,
        });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ChatCompletionsError);
        const e = err as ChatCompletionsError;
        expect(e.code).toBe("rate-limited");
        expect(e.retryAfterMs).toBe(30000);
      }
    });

    it("surfaces CORS/network errors with a descriptive code", async () => {
      const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch"));
      try {
        await callStructured({
          kind: "multiple-choice",
          settings: baseSettings,
          userPrompt: "test",
          fetchImpl: fetchMock as unknown as typeof fetch,
        });
        expect.fail("should have thrown");
      } catch (err) {
        expect((err as ChatCompletionsError).code).toBe("cors");
      }
    });

    it("rejects when settings are unconfigured", async () => {
      await expect(
        callStructured({
          kind: "multiple-choice",
          settings: DEFAULT_SETTINGS,
          userPrompt: "test",
          fetchImpl: vi.fn() as unknown as typeof fetch,
        }),
      ).rejects.toMatchObject({ code: "no-settings" });
    });

    it("honours the cached mode and skips the probe", async () => {
      // Pre-cache `json_object` — the first attempt must be json_object
      // (not json_schema).
      const settings: AISettings = {
        ...baseSettings,
        outputModeCache: {
          [`${baseSettings.baseUrl}|${baseSettings.model}`]: "json_object",
        },
      };
      const fetchMock = vi.fn().mockResolvedValueOnce(okResponse({ ok: true }));
      const result = await callStructured({
        kind: "multiple-choice",
        settings,
        userPrompt: "test",
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      expect(result.mode).toBe("json_object");
      const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
      expect(body.response_format.type).toBe("json_object");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
