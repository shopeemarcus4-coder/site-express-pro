import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPlaceDetails,
  getPlacePhoto,
  placeReviewsEnabled,
  placesEnabled,
  publicPlacesEnabled,
  placesMessage,
  searchPlaces,
} from "./places";

afterEach(() => vi.unstubAllEnvs());

describe("Google Places integration", () => {
  it("requires an explicit enable switch and key before any request", async () => {
    vi.stubEnv("SITE_EXPRESS_ENABLE_PLACES", "0");
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "configured-key");
    const fetcher = vi.fn();
    expect(placesEnabled()).toBe(false);
    await expect(
      searchPlaces("cafés em São Paulo", undefined, fetcher as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: "not_configured", status: 503 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("requires a separate switch before exposing paid search to guests", () => {
    expect(
      publicPlacesEnabled({
        SITE_EXPRESS_ENABLE_PLACES: "1",
        GOOGLE_PLACES_API_KEY: "key",
      }),
    ).toBe(false);
    expect(
      publicPlacesEnabled({
        SITE_EXPRESS_ENABLE_PLACES: "1",
        SITE_EXPRESS_ENABLE_PUBLIC_PLACES: "1",
        GOOGLE_PLACES_API_KEY: "key",
      }),
    ).toBe(true);
  });

  it("requests only search fields needed by the business picker", async () => {
    const response = Response.json({
      places: [
        {
          id: "ChIJtest123",
          displayName: { text: "Café Luz" },
          formattedAddress: "Rua Um, 10",
          primaryType: "cafe",
        },
      ],
    });
    const fetcher = vi.fn().mockResolvedValue(response);
    const results = await searchPlaces(
      "  Café Luz  ",
      "test-key",
      fetcher as unknown as typeof fetch,
    );
    expect(results).toEqual([
      { placeId: "ChIJtest123", name: "Café Luz", address: "Rua Um, 10", category: "cafe" },
    ]);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://places.googleapis.com/v1/places:searchText");
    expect((init.headers as Record<string, string>)["X-Goog-FieldMask"]).toBe(
      "places.id,places.displayName,places.formattedAddress,places.primaryType",
    );
    expect(JSON.parse(init.body as string)).toMatchObject({
      textQuery: "Café Luz",
      maxResultCount: 8,
    });
  });

  it("reads optional details without inventing phone, website, or coordinates", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ id: "ChIJtest123", displayName: { text: "Café Luz" } }));
    const result = await getPlaceDetails(
      "ChIJtest123",
      "test-key",
      fetcher as unknown as typeof fetch,
    );
    expect(result).toMatchObject({
      placeId: "ChIJtest123",
      name: "Café Luz",
      phone: null,
      website: null,
      location: null,
      rating: null,
      userRatingCount: null,
      reviews: [],
    });
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://places.googleapis.com/v1/places/ChIJtest123");
    expect((init.headers as Record<string, string>)["X-Goog-FieldMask"]).toBe(
      "id,displayName,formattedAddress,location",
    );
  });

  it("requests higher-cost contact fields only with a separate opt-in", async () => {
    vi.stubEnv("SITE_EXPRESS_ENABLE_PLACES_CONTACT_FIELDS", "1");
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        id: "ChIJtest123",
        displayName: { text: "Café Luz" },
        internationalPhoneNumber: "+55 11 1234-5678",
        websiteUri: "https://example.com",
      }),
    );
    const result = await getPlaceDetails(
      "ChIJtest123",
      "test-key",
      fetcher as unknown as typeof fetch,
    );
    expect(result.phone).toBe("+55 11 1234-5678");
    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["X-Goog-FieldMask"]).toContain(
      "internationalPhoneNumber,websiteUri",
    );
  });

  it("loads multiple photo references only with a separate photo opt-in", async () => {
    vi.stubEnv("SITE_EXPRESS_ENABLE_PLACES", "1");
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    vi.stubEnv("SITE_EXPRESS_ENABLE_PLACES_PHOTOS", "1");
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        id: "ChIJtest123",
        displayName: { text: "Café Luz" },
        photos: [
          {
            name: "places/ChIJtest123/photos/PhotoA",
            authorAttributions: [{ displayName: "Ana", uri: "https://example.com/ana" }],
          },
          { name: "places/ChIJtest123/photos/PhotoB" },
          { name: "https://attacker.example/photo" },
        ],
      }),
    );
    const result = await getPlaceDetails("ChIJtest123", "test-key", fetcher);
    expect(result.photos).toEqual([
      {
        name: "places/ChIJtest123/photos/PhotoA",
        attributions: [{ displayName: "Ana", uri: "https://example.com/ana" }],
      },
      { name: "places/ChIJtest123/photos/PhotoB", attributions: [] },
    ]);
    expect(fetcher.mock.calls[0]![1].headers["X-Goog-FieldMask"]).toContain("photos");
  });

  it("returns every available Google photo reference up to the API cap of ten", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        id: "ChIJtest123",
        displayName: { text: "Café Luz" },
        photos: Array.from({ length: 12 }, (_, index) => ({
          name: `places/ChIJtest123/photos/Photo${index}`,
        })),
      }),
    );
    const result = await getPlaceDetails("ChIJtest123", "test-key", fetcher, {
      photoFieldsEnabled: true,
    });
    expect(result.photos).toHaveLength(10);
  });

  it("requests real rating and attributed reviews only after the separate opt-in", async () => {
    expect(
      placeReviewsEnabled({ SITE_EXPRESS_ENABLE_PLACES: "1", GOOGLE_PLACES_API_KEY: "key" }),
    ).toBe(false);
    const payload = {
      id: "ChIJtest123",
      displayName: { text: "Café Luz" },
      rating: 4.7,
      userRatingCount: 112,
      reviews: [
        {
          rating: 5,
          text: { text: "Atendimento excelente" },
          authorAttribution: { displayName: "Ana", uri: "https://maps.google.com/ana" },
          publishTime: "2026-10-21T12:00:00Z",
          relativePublishTimeDescription: "há 3 dias",
        },
        { rating: 4, text: { text: "Sem autor" } },
        {
          rating: 5,
          text: { text: "URL insegura" },
          authorAttribution: { displayName: "Bia", uri: "javascript:alert(1)" },
        },
      ],
    };
    const fetcher = vi.fn().mockImplementation(async () => Response.json(payload));
    const disabled = await getPlaceDetails("ChIJtest123", "test-key", fetcher, {
      reviewFieldsEnabled: false,
    });
    expect(disabled).toMatchObject({ rating: null, userRatingCount: null, reviews: [] });
    expect(fetcher.mock.calls[0]![1].headers["X-Goog-FieldMask"]).not.toContain("reviews");

    const enabled = await getPlaceDetails("ChIJtest123", "test-key", fetcher, {
      reviewFieldsEnabled: true,
    });
    expect(fetcher.mock.calls[1]![1].headers["X-Goog-FieldMask"]).toContain(
      "rating,userRatingCount,reviews",
    );
    expect(enabled.rating).toBe(4.7);
    expect(enabled.userRatingCount).toBe(112);
    expect(enabled.reviews).toEqual([
      {
        rating: 5,
        text: "Atendimento excelente",
        author: { displayName: "Ana", uri: "https://maps.google.com/ana" },
        publishedAt: "2026-10-21T12:00:00Z",
        relativeTime: "há 3 dias",
      },
      {
        rating: 5,
        text: "URL insegura",
        author: { displayName: "Bia", uri: null },
        publishedAt: null,
        relativeTime: null,
      },
    ]);
  });

  it("fetches a bounded image without exposing the API key in the URL", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "image/jpeg" },
      }),
    );
    const photo = await getPlacePhoto("places/ChIJtest123/photos/PhotoA", "test-key", fetcher);
    expect(photo.contentType).toBe("image/jpeg");
    expect(fetcher.mock.calls[0]![0]).toBe(
      "https://places.googleapis.com/v1/places/ChIJtest123/photos/PhotoA/media?maxWidthPx=360",
    );
    expect(fetcher.mock.calls[0]![1].headers["X-Goog-Api-Key"]).toBe("test-key");
    await expect(
      getPlacePhoto("https://attacker.example/photo", "test-key", fetcher),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("supports a 1200px preview only when that size is explicitly requested", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } }),
      );
    await getPlacePhoto("places/ChIJtest123/photos/PhotoA", "test-key", fetcher, 1200);
    expect(fetcher.mock.calls[0]![0]).toBe(
      "https://places.googleapis.com/v1/places/ChIJtest123/photos/PhotoA/media?maxWidthPx=1200",
    );
  });

  it("maps quota and malformed input to actionable errors", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 429 }));
    await expect(
      searchPlaces("restaurantes", "test-key", fetcher as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: "quota_exceeded" });
    expect(placesMessage(new SyntaxError("invalid JSON"))).toMatchObject({
      code: "invalid_input",
      status: 400,
    });
  });
});
