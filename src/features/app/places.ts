export type PlaceSearchResult = {
  placeId: string;
  name: string;
  address: string;
  category?: string | null;
};

export type ImportedPlaceDetails = {
  name: string;
  address: string;
  phone: string;
  website: string;
  mapsUrl: string;
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
  return {
    name,
    address: address ?? selected.address,
    phone: phone ?? "",
    website: website ?? "",
    mapsUrl,
  };
}
