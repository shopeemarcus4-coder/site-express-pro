import { afterEach, describe, expect, it, vi } from "vitest";
import { integrationEnv } from "./runtime-env";

afterEach(() => vi.unstubAllEnvs());

describe("integration secrets", () => {
  it("reads Cloudflare secrets instead of local process variables", () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "local-key");
    const request = new Request("https://example.com/api/places/search") as Request & {
      runtime?: { name: string; cloudflare: { env: Record<string, unknown> } };
    };
    request.runtime = {
      name: "cloudflare",
      cloudflare: {
        env: {
          GOOGLE_PLACES_API_KEY: "worker-key",
          SITE_EXPRESS_ENABLE_PLACES: "1",
          GEMINI_API_KEY: "worker-gemini-key",
          SITE_EXPRESS_ENABLE_AI_IMAGES: "1",
          SITE_EXPRESS_ENABLE_PUBLIC_AI_IMAGES: "1",
          SITE_EXPRESS_IMAGE_GLOBAL_DAILY_LIMIT: "20",
        },
      },
    };
    expect(integrationEnv(request).GOOGLE_PLACES_API_KEY).toBe("worker-key");
    expect(integrationEnv(request).SITE_EXPRESS_ENABLE_PLACES).toBe("1");
    expect(integrationEnv(request).GEMINI_API_KEY).toBe("worker-gemini-key");
    expect(integrationEnv(request).SITE_EXPRESS_ENABLE_AI_IMAGES).toBe("1");
    expect(integrationEnv(request).SITE_EXPRESS_ENABLE_PUBLIC_AI_IMAGES).toBe("1");
    expect(integrationEnv(request).SITE_EXPRESS_IMAGE_GLOBAL_DAILY_LIMIT).toBe("20");
    request.runtime.cloudflare.env = {};
    expect(integrationEnv(request).GOOGLE_PLACES_API_KEY).toBeUndefined();
  });
});
