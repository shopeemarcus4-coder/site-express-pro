export type PlaceSearchResult = {
  placeId: string;
  name: string;
  address: string;
  category?: string | null;
};

export type PlacePhoto = {
  name: string;
  attributions: { displayName: string; uri: string | null }[];
};

export type ImportedPlaceDetails = {
  name: string;
  address: string;
  phone: string;
  website: string;
  mapsUrl: string;
  photos: PlacePhoto[];
};

function nonEmptyText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeWebsite(value: unknown): string | null {
  const text = nonEmptyText(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Only fields returned for the selected Google place enter the editable project draft. */
export function placeDetailsDraft(
  value: unknown,
  selected: PlaceSearchResult,
): ImportedPlaceDetails | null {
  if (!value || typeof value !== "object") return null;
  const details = value as Record<string, unknown>;
  if (details["placeId"] !== selected.placeId) return null;
  const name = nonEmptyText(details["name"]);
  if (!name) return null;
  const address = nonEmptyText(details["address"]);
  const phone = nonEmptyText(details["phone"]);
  const website = safeWebsite(details["website"]);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(selected.placeId)}`;
  const photos = Array.isArray(details["photos"])
    ? details["photos"].slice(0, 8).flatMap((value): PlacePhoto[] => {
        if (!value || typeof value !== "object") return [];
        const photo = value as Record<string, unknown>;
        if (
          typeof photo["name"] !== "string" ||
          !/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(photo["name"])
        )
          return [];
        const attributions = Array.isArray(photo["attributions"])
          ? photo["attributions"].flatMap((value): PlacePhoto["attributions"] => {
              if (!value || typeof value !== "object") return [];
              const author = value as Record<string, unknown>;
              if (typeof author["displayName"] !== "string") return [];
              const uri = safeWebsite(author["uri"]);
              return [{ displayName: author["displayName"], uri }];
            })
          : [];
        return [{ name: photo["name"], attributions }];
      })
    : [];
  return {
    name,
    address: address ?? selected.address,
    phone: phone ?? "",
    website: website ?? "",
    mapsUrl,
    photos,
  };
}

export function placePhotoUrl(name: string): string {
  return `/api/places/photo?name=${encodeURIComponent(name)}`;
}
