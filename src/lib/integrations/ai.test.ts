import { afterEach, describe, expect, it, vi } from "vitest";
import { aiEnabled, aiMessage, rewriteCopy } from "./ai";

afterEach(() => vi.unstubAllEnvs());

describe("optional Gemini copy rewriting", () => {
  it("stays inactive unless explicitly enabled with a key", async () => {
    vi.stubEnv("SITE_EXPRESS_ENABLE_AI", "0");
    vi.stubEnv("GEMINI_API_KEY", "configured-key");
    const fetcher = vi.fn();
    expect(aiEnabled()).toBe(false);
    await expect(
      rewriteCopy(
        { text: "Uma apresentação de empresa." },
        undefined,
        fetcher as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: "not_configured", status: 503 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("limits output tokens and requests text without invented claims", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        candidates: [
          { content: { parts: [{ text: "Sua empresa, com presença digital clara." }] } },
        ],
      }),
    );
    const output = await rewriteCopy(
      { text: "Sua empresa com presença digital.", tone: "direto" },
      "test-key",
      fetcher as unknown as typeof fetch,
    );
    expect(output).toBe("Sua empresa, com presença digital clara.");
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("gemini-2.5-flash:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
    const payload = JSON.parse(init.body as string);
    expect(payload.generationConfig.maxOutputTokens).toBe(512);
    expect(payload.contents[0].parts[0].text).toContain("Não invente fatos");
  });

  it("reports blocked, quota, and invalid input explicitly", async () => {
    const blockedFetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ promptFeedback: { blockReason: "SAFETY" } }));
    await expect(
      rewriteCopy(
        { text: "Um texto de exemplo válido." },
        "test-key",
        blockedFetcher as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: "blocked", status: 422 });
    const quotaFetcher = vi.fn().mockResolvedValue(new Response(null, { status: 429 }));
    await expect(
      rewriteCopy(
        { text: "Um texto de exemplo válido." },
        "test-key",
        quotaFetcher as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: "quota_exceeded", status: 503 });
    expect(aiMessage(new SyntaxError("invalid JSON"))).toMatchObject({
      code: "invalid_input",
      status: 400,
    });
  });
});
