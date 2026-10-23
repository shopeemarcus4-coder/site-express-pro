import { describe, expect, it } from "vitest";
import { createSiteProject } from "../studio/presets";
import { placeDetailsDraft, type PlaceSearchResult } from "./places";

const selected: PlaceSearchResult = {
  placeId: "ChIJtest123",
  name: "Café Luz",
  address: "Rua Um, 10",
  category: "cafe",
};

describe("Google Places project import", () => {
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
});
