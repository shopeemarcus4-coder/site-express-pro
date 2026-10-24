import { z } from "zod";

const SEARCH_FIELDS = "places.id,places.displayName,places.formattedAddress,places.primaryType";
const DETAILS_FIELDS = "id,displayName,formattedAddress,location";
const DETAILS_CONTACT_FIELDS = ",internationalPhoneNumber,websiteUri";
const DETAILS_PHOTO_FIELDS = ",photos";
const GOOGLE_PLACES_BASE = "https://places.googleapis.com/v1";

export const placesSearchInput = z.object({
  query: z.string().trim().min(2).max(120),
});

export const placesDetailsInput = z.object({
  placeId: z
    .string()
    .trim()
    .min(4)
    .max(256)
    .regex(/^[A-Za-z0-9_-]+$/),
});

export type PlaceSearchResult = {
  placeId: string;
  name: string;
  address: string;
  category: string | null;
};

export type PlaceBusiness = PlaceSearchResult & {
  phone: string | null;
  website: string | null;
  location: { latitude: number; longitude: number } | null;
  photos: PlacePhoto[];
};

export type PlacePhoto = {
  name: string;
  attributions: { displayName: string; uri: string | null }[];
};

type Fetcher = typeof fetch;

export class PlacesError extends Error {
  constructor(
    public readonly code:
      "not_configured" | "invalid_key" | "quota_exceeded" | "unavailable" | "bad_response",
    public readonly status: number,
  ) {
    super(code);
  }
}

export function placesEnabled(
  env: {
    SITE_EXPRESS_ENABLE_PLACES?: string | undefined;
    GOOGLE_PLACES_API_KEY?: string | undefined;
  } = process.env,
): boolean {
  return env.SITE_EXPRESS_ENABLE_PLACES === "1" && Boolean(env.GOOGLE_PLACES_API_KEY?.trim());
}

export function placePhotosEnabled(
  env: {
    SITE_EXPRESS_ENABLE_PLACES?: string | undefined;
    SITE_EXPRESS_ENABLE_PLACES_PHOTOS?: string | undefined;
    GOOGLE_PLACES_API_KEY?: string | undefined;
  } = process.env,
): boolean {
  return placesEnabled(env) && env.SITE_EXPRESS_ENABLE_PLACES_PHOTOS === "1";
}

export const placePhotoName = z
  .string()
  .max(512)
  .regex(/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/);

function requiredKey(key: string | undefined): string {
  if (!key?.trim()) throw new PlacesError("not_configured", 503);
  return key.trim();
}

function errorFromResponse(status: number): PlacesError {
  if (status === 403 || status === 401) return new PlacesError("invalid_key", 502);
  if (status === 429) return new PlacesError("quota_exceeded", 503);
  return new PlacesError("unavailable", 502);
}

async function googleRequest(
  path: string,
  key: string,
  fieldMask: string,
  fetcher: Fetcher,
  init: RequestInit = {},
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(`${GOOGLE_PLACES_BASE}${path}`, {
      ...init,
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": fieldMask,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new PlacesError("unavailable", 502);
  }
  if (!response.ok) throw errorFromResponse(response.status);
  try {
    return await response.json();
  } catch {
    throw new PlacesError("bad_response", 502);
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function string(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizePlace(value: unknown): PlaceSearchResult | null {
  const place = record(value);
  const name = string(record(place?.["displayName"])?.["text"]);
  const id = string(place?.["id"]);
  if (!place || !id || !name) return null;
  return {
    placeId: id,
    name,
    address: string(place["formattedAddress"]) ?? "",
    category: string(place["primaryType"]),
  };
}

export async function searchPlaces(
  query: string,
  key = placesEnabled() ? process.env["GOOGLE_PLACES_API_KEY"] : undefined,
  fetcher: Fetcher = fetch,
): Promise<PlaceSearchResult[]> {
  const validQuery = placesSearchInput.parse({ query }).query;
  const data = await googleRequest("/places:searchText", requiredKey(key), SEARCH_FIELDS, fetcher, {
    method: "POST",
    body: JSON.stringify({
      textQuery: validQuery,
      languageCode: "pt-BR",
      regionCode: "BR",
      maxResultCount: 8,
    }),
  });
  const places = record(data)?.["places"];
  if (places === undefined) return [];
  if (!Array.isArray(places)) throw new PlacesError("bad_response", 502);
  return places.map(normalizePlace).filter((value): value is PlaceSearchResult => value !== null);
}

export async function getPlaceDetails(
  placeId: string,
  key = placesEnabled() ? process.env["GOOGLE_PLACES_API_KEY"] : undefined,
  fetcher: Fetcher = fetch,
  options: { contactFieldsEnabled?: boolean; photoFieldsEnabled?: boolean } = {},
): Promise<PlaceBusiness> {
  const validId = placesDetailsInput.parse({ placeId }).placeId;
  const contactFieldsEnabled =
    options.contactFieldsEnabled ??
    process.env["SITE_EXPRESS_ENABLE_PLACES_CONTACT_FIELDS"] === "1";
  const photoFieldsEnabled = options.photoFieldsEnabled ?? placePhotosEnabled();
  const fieldMask =
    DETAILS_FIELDS +
    (contactFieldsEnabled ? DETAILS_CONTACT_FIELDS : "") +
    (photoFieldsEnabled ? DETAILS_PHOTO_FIELDS : "");
  const data = await googleRequest(
    `/places/${encodeURIComponent(validId)}`,
    requiredKey(key),
    fieldMask,
    fetcher,
  );
  const place = normalizePlace(data);
  const raw = record(data);
  if (!place || !raw) throw new PlacesError("bad_response", 502);
  const rawLocation = record(raw["location"]);
  const latitude = rawLocation?.["latitude"];
  const longitude = rawLocation?.["longitude"];
  return {
    ...place,
    phone: contactFieldsEnabled ? string(raw["internationalPhoneNumber"]) : null,
    website: contactFieldsEnabled ? string(raw["websiteUri"]) : null,
    location:
      typeof latitude === "number" &&
      typeof longitude === "number" &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
        ? { latitude, longitude }
        : null,
    photos: photoFieldsEnabled
      ? (Array.isArray(raw["photos"]) ? raw["photos"] : [])
          .slice(0, 8)
          .map(normalizePhoto)
          .filter((photo): photo is PlacePhoto => photo !== null)
      : [],
  };
}

function normalizePhoto(value: unknown): PlacePhoto | null {
  const raw = record(value);
  const name = string(raw?.["name"]);
  if (!name || !placePhotoName.safeParse(name).success) return null;
  const attributions = Array.isArray(raw?.["authorAttributions"])
    ? raw["authorAttributions"]
        .map((value): PlacePhoto["attributions"][number] | null => {
          const author = record(value);
          const displayName = string(author?.["displayName"]);
          if (!displayName) return null;
          const uri = string(author?.["uri"]);
          return {
            displayName,
            uri: uri && /^https:\/\//i.test(uri) ? uri : null,
          };
        })
        .filter((value): value is PlacePhoto["attributions"][number] => value !== null)
    : [];
  return { name, attributions };
}

export async function getPlacePhoto(
  name: string,
  key = placePhotosEnabled() ? process.env["GOOGLE_PLACES_API_KEY"] : undefined,
  fetcher: Fetcher = fetch,
): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const validName = placePhotoName.parse(name);
  let response: Response;
  try {
    response = await fetcher(`${GOOGLE_PLACES_BASE}/${validName}/media?maxWidthPx=360`, {
      headers: { "X-Goog-Api-Key": requiredKey(key) },
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    if (error instanceof PlacesError) throw error;
    throw new PlacesError("unavailable", 502);
  }
  if (!response.ok) throw errorFromResponse(response.status);
  const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType))
    throw new PlacesError("bad_response", 502);
  if (Number(response.headers.get("content-length") ?? 0) > 4_000_000)
    throw new PlacesError("bad_response", 502);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 4_000_000) throw new PlacesError("bad_response", 502);
  return { bytes, contentType };
}

export function placesMessage(error: unknown): { message: string; status: number; code: string } {
  if (error instanceof PlacesError) {
    switch (error.code) {
      case "not_configured":
        return {
          message: "A busca do Google ainda não foi configurada. Cadastre a empresa manualmente.",
          status: 503,
          code: error.code,
        };
      case "invalid_key":
        return {
          message:
            "A chave do Google Places não autorizou esta consulta. Cadastre a empresa manualmente ou revise a configuração.",
          status: 502,
          code: error.code,
        };
      case "quota_exceeded":
        return {
          message:
            "O limite do Google Places foi atingido. Tente mais tarde ou cadastre a empresa manualmente.",
          status: 503,
          code: error.code,
        };
      default:
        return {
          message:
            "Não conseguimos consultar o Google Places agora. Cadastre a empresa manualmente.",
          status: error.status,
          code: error.code,
        };
    }
  }
  if (
    error instanceof z.ZodError ||
    error instanceof SyntaxError ||
    (error instanceof Error && ["too_large", "content_type"].includes(error.message))
  ) {
    return {
      message: "Confira os dados da busca e tente novamente.",
      status: 400,
      code: "invalid_input",
    };
  }
  return {
    message: "Não conseguimos consultar o Google Places agora. Cadastre a empresa manualmente.",
    status: 502,
    code: "unavailable",
  };
}
