import { afterEach, describe, expect, it, vi } from "vitest";
import { Route as DetailsRoute } from "./details";
import { Route as PhotoRoute } from "./photo";
import { Route } from "./search";

const handlers = Route.options.server?.handlers as unknown as {
  GET: (context: { request: Request }) => Promise<Response>;
  POST: (context: { request: Request }) => Promise<Response>;
};
const detailHandler = (
  DetailsRoute.options.server?.handlers as unknown as {
    POST: (context: { request: Request }) => Promise<Response>;
  }
).POST;
const photoHandler = (
  PhotoRoute.options.server?.handlers as unknown as {
    GET: (context: { request: Request }) => Promise<Response>;
  }
).GET;

type CloudflareRequest = Request & {
  runtime: { name: "cloudflare"; cloudflare: { env: Record<string, unknown> } };
};

function request(
  env: Record<string, unknown>,
  method = "GET",
  body?: unknown,
  url = "https://site.example/api/places/search",
): CloudflareRequest {
  return Object.assign(
    new Request(url, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        cookie: `sx_session=${"a".repeat(48)}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    { runtime: { name: "cloudflare" as const, cloudflare: { env } } },
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("guest company search without account storage", () => {
  it("reports availability without needing a D1 binding, even with an obsolete cookie", async () => {
    const response = await handlers.GET({
      request: request({
        GOOGLE_PLACES_API_KEY: "secret",
        SITE_EXPRESS_ENABLE_PLACES: "1",
        SITE_EXPRESS_ENABLE_PUBLIC_PLACES: "1",
        SITE_EXPRESS_ENABLE_PLACES_PHOTOS: "1",
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      configured: true,
      availableWithoutAccount: true,
      photosEnabled: true,
      reviewsEnabled: false,
      contactFieldsEnabled: false,
    });
  });

  it("searches Google without touching D1 when guest search was explicitly enabled", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        places: [{ id: "ChIJtest", displayName: { text: "Café Luz" } }],
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const response = await handlers.POST({
      request: request(
        {
          GOOGLE_PLACES_API_KEY: "secret",
          SITE_EXPRESS_ENABLE_PLACES: "1",
          SITE_EXPRESS_ENABLE_PUBLIC_PLACES: "1",
        },
        "POST",
        { query: "Café Luz" },
      ),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      results: [{ placeId: "ChIJtest", name: "Café Luz" }],
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("imports details and photo references without account storage", async () => {
    const env = {
      GOOGLE_PLACES_API_KEY: "secret",
      SITE_EXPRESS_ENABLE_PLACES: "1",
      SITE_EXPRESS_ENABLE_PUBLIC_PLACES: "1",
      SITE_EXPRESS_ENABLE_PLACES_PHOTOS: "1",
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          id: "ChIJtest",
          displayName: { text: "Café Luz" },
          photos: [
            {
              name: "places/ChIJtest/photos/PhotoA",
              authorAttributions: [{ displayName: "Ana" }],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } }),
      );
    vi.stubGlobal("fetch", fetcher);

    const details = await detailHandler({ request: request(env, "POST", { placeId: "ChIJtest" }) });
    expect(details.status).toBe(200);
    expect(await details.json()).toMatchObject({
      business: {
        name: "Café Luz",
        photos: [{ name: "places/ChIJtest/photos/PhotoA", attributions: [{ displayName: "Ana" }] }],
      },
    });

    const photoRequest = request(
      env,
      "GET",
      undefined,
      "https://site.example/api/places/photo?name=places%2FChIJtest%2Fphotos%2FPhotoA&maxWidthPx=1200",
    );
    const photo = await photoHandler({ request: photoRequest });
    expect(photo.status).toBe(200);
    expect(photo.headers.get("content-type")).toBe("image/jpeg");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]![0]).toContain("maxWidthPx=1200");
  });
});
