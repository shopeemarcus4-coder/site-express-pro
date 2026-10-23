import { afterEach, describe, expect, it, vi } from "vitest";
import { getPlaceDetails, placesEnabled, placesMessage, searchPlaces } from "./places";

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
