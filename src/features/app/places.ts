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

export type PlaceReview = {
  rating: number;
  text: string;
  author: { displayName: string; uri: string | null };
  relativeTime: string | null;
};

export function placeTemplate(category: string | null | undefined): {
  category: string;
  archetype: "gastronomia" | "servicos" | "produtos";
} {
  const type = category?.toLowerCase().trim() ?? "";
  const food = new Set([
    "restaurant",
    "cafe",
    "bakery",
    "bar",
    "meal_takeaway",
    "meal_delivery",
    "pizza_restaurant",
    "hamburger_restaurant",
    "coffee_shop",
    "ice_cream_shop",
  ]);
  const products = new Set([
    "store",
    "clothing_store",
    "shoe_store",
    "electronics_store",
    "florist",
    "furniture_store",
    "gift_shop",
    "grocery_store",
    "supermarket",
    "pet_store",
  ]);
  const labels: Record<string, string> = {
    restaurant: "Restaurante",
    cafe: "Café",
    bakery: "Padaria",
    bar: "Bar",
    dentist: "Clínica odontológica",
    doctor: "Consultório",
    beauty_salon: "Salão de beleza",
    store: "Loja",
    clothing_store: "Loja de roupas",
    supermarket: "Supermercado",
  };
  return {
    category: labels[type] ?? type.replaceAll("_", " "),
    archetype: food.has(type) ? "gastronomia" : products.has(type) ? "produtos" : "servicos",
  };
}

export type ImportedPlaceDetails = {
  name: string;
  address: string;
  phone: string;
  website: string;
  mapsUrl: string;
  photos: PlacePhoto[];
  rating: number | null;
  userRatingCount: number | null;
  reviews: PlaceReview[];
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
    ? details["photos"].slice(0, 10).flatMap((value): PlacePhoto[] => {
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
  const rating = details["rating"];
  const userRatingCount = details["userRatingCount"];
  const reviews = Array.isArray(details["reviews"])
    ? details["reviews"].slice(0, 5).flatMap((value): PlaceReview[] => {
        if (!value || typeof value !== "object") return [];
        const review = value as Record<string, unknown>;
        const author = review["author"] as Record<string, unknown> | null;
        if (
          typeof review["rating"] !== "number" ||
          review["rating"] < 1 ||
          review["rating"] > 5 ||
          typeof review["text"] !== "string" ||
          typeof author?.["displayName"] !== "string"
        )
          return [];
        return [
          {
            rating: review["rating"],
            text: review["text"],
            author: {
              displayName: author["displayName"],
              uri: safeWebsite(author["uri"]),
            },
            relativeTime: nonEmptyText(review["relativeTime"]),
          },
        ];
      })
    : [];
  return {
    name,
    address: address ?? selected.address,
    phone: phone ?? "",
    website: website ?? "",
    mapsUrl,
    photos,
    rating:
      typeof rating === "number" && Number.isFinite(rating) && rating >= 1 && rating <= 5
        ? rating
        : null,
    userRatingCount:
      typeof userRatingCount === "number" &&
      Number.isInteger(userRatingCount) &&
      userRatingCount >= 0
        ? userRatingCount
        : null,
    reviews,
  };
}

export function placePhotoUrl(name: string, width?: 360 | 1200): string {
  return `/api/places/photo?name=${encodeURIComponent(name)}${width === 1200 ? "&maxWidthPx=1200" : ""}`;
}
