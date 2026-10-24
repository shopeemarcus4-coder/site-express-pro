import { describe, expect, it } from "vitest";
import { createSiteProject } from "./presets";
import { imageAssets, imageChecklist } from "./imageAssets";

describe("individual image exports", () => {
  it("uses the approved slot names and reports missing originals", () => {
    const project = createSiteProject({ name: "Café" });
    project.appearance.heroImage = `data:image/png;base64,${btoa("hero")}`;
    project.appearance.heroImageMobile = `data:image/webp;base64,${btoa("mobile")}`;
    project.items = [{ id: "p1", title: "Bolo", description: "Bolo da casa" }];
    expect(imageAssets(project).map((asset) => asset.name)).toEqual([
      "capa-desktop.png",
      "capa-mobile.webp",
    ]);
    expect(imageChecklist(project)).toContain("item-1 (Bolo): AGUARDANDO FOTO ORIGINAL");
    expect(imageChecklist(project)).toContain("sobre-desktop: PENDENTE");
  });
});
