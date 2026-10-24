import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { D1SiteExpressStore } from "../../../lib/server/d1";
import { Route } from "./image";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

const handlers = Route.options.server?.handlers as unknown as {
  GET: (context: { request: Request }) => Promise<Response>;
  POST: (context: { request: Request }) => Promise<Response>;
};

const fakeDatabase = {
  prepare: vi.fn(),
  batch: vi.fn(),
  exec: vi.fn(),
};

function request(
  env: Record<string, unknown>,
  method = "GET",
  options: { ip?: string | null; body?: unknown } = {},
): Request {
  const headers: Record<string, string> = { Origin: "https://site.example" };
  if (options.ip !== null) headers["CF-Connecting-IP"] = options.ip ?? "203.0.113.3";
  if (options.body) headers["Content-Type"] = "application/json";
  return Object.assign(
    new Request("https://site.example/api/ai/image", {
      method,
      headers,
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    }),
    { runtime: { name: "cloudflare", cloudflare: { env } } },
  );
}

const flags = {
  GEMINI_API_KEY: "fake-private-key",
  SITE_EXPRESS_ENABLE_AI_IMAGES: "1",
  SITE_EXPRESS_ENABLE_PUBLIC_AI_IMAGES: "1",
};
const imageRequest = { mode: "generate", prompt: "Cena ilustrativa de uma loja local." };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("guest Gemini image endpoint", () => {
  it("reports unavailable and never calls Gemini without an explicit opt-in and D1", async () => {
    const optOut = await handlers.GET({
      request: request({ ...flags, SITE_EXPRESS_ENABLE_PUBLIC_AI_IMAGES: "0" }),
    });
    expect(await optOut.json()).toMatchObject({ configured: false });
    const noDatabase = await handlers.GET({ request: request(flags) });
    expect(await noDatabase.json()).toMatchObject({ configured: false });
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const response = await handlers.POST({
      request: request(flags, "POST", { body: imageRequest }),
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("D1") });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("enforces the durable quota before contacting Gemini", async () => {
    const env = { ...flags, SITE_EXPRESS_DB: fakeDatabase };
    const quota = vi
      .spyOn(D1SiteExpressStore.prototype, "consumeGuestImageQuota")
      .mockResolvedValue(false);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const status = await handlers.GET({ request: request(env) });
    expect(await status.json()).toMatchObject({
      configured: true,
      dailyLimit: 4,
      globalDailyLimit: 20,
    });
    const response = await handlers.POST({ request: request(env, "POST", { body: imageRequest }) });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "quota_exceeded" });
    expect(quota).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(String),
      4,
      20,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("generates only with a trusted Cloudflare address and available quota", async () => {
    const env = { ...flags, SITE_EXPRESS_DB: fakeDatabase };
    vi.spyOn(D1SiteExpressStore.prototype, "consumeGuestImageQuota").mockResolvedValue(true);
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        candidates: [
          { content: { parts: [{ inlineData: { mimeType: "image/png", data: btoa("image") } }] } },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const missingIp = await handlers.POST({
      request: request(env, "POST", { ip: null, body: imageRequest }),
    });
    expect(missingIp.status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
    const response = await handlers.POST({ request: request(env, "POST", { body: imageRequest }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      image: expect.stringMatching(/^data:image\/png;base64,/),
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
