import { describe, expect, it } from "vitest";
import { createSiteProject } from "../studio/presets";
import { placeDetailsDraft, placePhotoUrl, placeTemplate, type PlaceSearchResult } from "./places";

const selected: PlaceSearchResult = {
  placeId: "ChIJtest123",
  name: "Café Luz",
  address: "Rua Um, 10",
  category: "cafe",
};

describe("Google Places project import", () => {
  it("selects the matching initial model from a Google business type", () => {
    expect(placeTemplate("restaurant")).toEqual({
      category: "Restaurante",
      archetype: "gastronomia",
    });
    expect(placeTemplate("dentist")).toEqual({
      category: "Clínica odontológica",
      archetype: "servicos",
    });
    expect(placeTemplate("clothing_store")).toEqual({
      category: "Loja de roupas",
      archetype: "produtos",
    });
  });
  it("copies only matching business details into editable draft fields", () => {
    const details = placeDetailsDraft(
      {
        placeId: "ChIJtest123",
        name: "Café Luz",
        address: "Rua Um, 10, São Paulo",
        phone: "+55 11 1234-5678",
        website: "https://cafeluz.example/",
        location: { latitude: -23.5, longitude: -46.6 },
      },
      selected,
    );
    expect(details).toMatchObject({
      name: "Café Luz",
      address: "Rua Um, 10, São Paulo",
      phone: "+55 11 1234-5678",
      website: "https://cafeluz.example/",
    });
    expect(details?.mapsUrl).toContain("query_place_id=ChIJtest123");
    const project = createSiteProject({
      name: details!.name,
      address: details!.address,
      mapsUrl: details!.mapsUrl,
    });
    expect(project.business.address).toBe("Rua Um, 10, São Paulo");
    expect(project.business.mapsUrl).toBe(details?.mapsUrl);
    expect(project.business.whatsapp).toBe("");
  });

  it("rejects details for another place and unsafe website protocols", () => {
    expect(placeDetailsDraft({ placeId: "another", name: "Outro" }, selected)).toBeNull();
    const details = placeDetailsDraft(
      {
        placeId: selected.placeId,
        name: selected.name,
        website: "javascript:alert(1)",
      },
      selected,
    );
    expect(details?.website).toBe("");
  });

  it("accepts only Google photo names and keeps the key out of browser URLs", () => {
    const details = placeDetailsDraft(
      {
        placeId: selected.placeId,
        name: selected.name,
        photos: [
          { name: "places/ChIJtest123/photos/PhotoA", attributions: [] },
          { name: "https://example.com/private.jpg" },
        ],
      },
      selected,
    );
    expect(details?.photos).toHaveLength(1);
    expect(placePhotoUrl(details!.photos[0]!.name)).toBe(
      "/api/places/photo?name=places%2FChIJtest123%2Fphotos%2FPhotoA",
    );
  });
});
