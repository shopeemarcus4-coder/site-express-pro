import { describe, expect, it, vi } from "vitest";
import {
  createBusinessImage,
  imageAiEnabled,
  imageAiMessage,
  publicImageAiEnabled,
} from "./images";

const original = `data:image/png;base64,${btoa("original photo")}`;
const generated = btoa("new image");

describe("optional Gemini image generation", () => {
  it("requires a separate opt-in flag and server key", () => {
    expect(imageAiEnabled({ SITE_EXPRESS_ENABLE_AI_IMAGES: "0", GEMINI_API_KEY: "key" })).toBe(
      false,
    );
    expect(imageAiEnabled({ SITE_EXPRESS_ENABLE_AI_IMAGES: "1", GEMINI_API_KEY: "" })).toBe(false);
    expect(imageAiEnabled({ SITE_EXPRESS_ENABLE_AI_IMAGES: "1", GEMINI_API_KEY: "key" })).toBe(
      true,
    );
    expect(
      publicImageAiEnabled({
        SITE_EXPRESS_ENABLE_AI_IMAGES: "1",
        SITE_EXPRESS_ENABLE_PUBLIC_AI_IMAGES: "0",
        GEMINI_API_KEY: "key",
      }),
    ).toBe(false);
    expect(
      publicImageAiEnabled({
        SITE_EXPRESS_ENABLE_AI_IMAGES: "1",
        SITE_EXPRESS_ENABLE_PUBLIC_AI_IMAGES: "1",
        GEMINI_API_KEY: "key",
      }),
    ).toBe(true);
  });

  it("sends an authorized photo with its edit request and reads image output", async () => {
    const fetcher = vi.fn().mockImplementation(async () =>
      Response.json({
        candidates: [
          { content: { parts: [{ inlineData: { mimeType: "image/png", data: generated } }] } },
        ],
      }),
    );
    const result = await createBusinessImage(
      { mode: "enhance", prompt: "Melhore a iluminação da loja.", sourceImage: original },
      "test-key",
      fetcher as unknown as typeof fetch,
    );
    expect(result).toBe(`data:image/png;base64,${generated}`);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("gemini-2.5-flash-image:generateContent");
    const payload = JSON.parse(init.body as string);
    expect(payload.generationConfig.responseModalities).toEqual(["IMAGE"]);
    expect(payload.contents[0].parts[1].inlineData).toEqual({
      mimeType: "image/png",
      data: btoa("original photo"),
    });
  });

  it("generates without a photo and rejects invalid source and output", async () => {
    const fetcher = vi.fn().mockImplementation(async () =>
      Response.json({
        candidates: [
          { content: { parts: [{ inlineData: { mimeType: "image/png", data: generated } }] } },
        ],
      }),
    );
    await createBusinessImage(
      { mode: "generate", prompt: "Uma fotografia da fachada de uma cafeteria." },
      "key",
      fetcher as unknown as typeof fetch,
    );
    const payload = JSON.parse((fetcher.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(payload.contents[0].parts).toHaveLength(1);
    await createBusinessImage(
      {
        mode: "generate",
        slot: "heroMobile",
        prompt: "Uma cena ilustrativa de cafeteria local.",
        referenceImage: original,
      },
      "key",
      fetcher as unknown as typeof fetch,
    );
    const responsivePayload = JSON.parse(
      (fetcher.mock.calls[1] as [string, RequestInit])[1].body as string,
    );
    expect(responsivePayload.contents[0].parts[1].inlineData.mimeType).toBe("image/png");
    expect(responsivePayload.contents[0].parts[0].text).toContain("referência de composição");
    await expect(
      createBusinessImage(
        { mode: "enhance", prompt: "Melhore a iluminação da loja." },
        "key",
        fetcher as unknown as typeof fetch,
      ),
    ).rejects.toBeDefined();
    await expect(
      createBusinessImage(
        {
          mode: "generate",
          prompt: "Uma fotografia da fachada de uma cafeteria.",
          sourceImage: original,
        },
        "key",
        fetcher as unknown as typeof fetch,
      ),
    ).rejects.toBeDefined();
    const invalid = vi.fn().mockResolvedValue(
      Response.json({
        candidates: [
          { content: { parts: [{ inlineData: { mimeType: "text/html", data: generated } }] } },
        ],
      }),
    );
    await expect(
      createBusinessImage(
        { mode: "generate", prompt: "Uma fotografia da fachada de uma cafeteria." },
        "key",
        invalid as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: "bad_response" });
  });

  it("reports quota errors without exposing API response contents", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 429 }));
    await expect(
      createBusinessImage(
        { mode: "generate", prompt: "Uma fotografia da fachada de uma cafeteria." },
        "key",
        fetcher as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: "quota_exceeded" });
    expect(imageAiMessage(new Error("too_large"))).toMatchObject({
      status: 400,
      code: "invalid_input",
    });
    const invalidRequest = vi.fn().mockResolvedValue(new Response(null, { status: 400 }));
    await expect(
      createBusinessImage(
        { mode: "generate", prompt: "Uma fotografia ilustrativa de uma cafeteria." },
        "key",
        invalidRequest as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
  });
});
