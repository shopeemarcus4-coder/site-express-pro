import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createSiteProject, PALETTES } from "./presets";
import { SitePreview } from "./SitePreview";

describe("studio site generation", () => {
  it("starts with truthful empty evidence sections for every archetype", () => {
    for (const archetype of ["gastronomia", "servicos", "produtos"] as const) {
      const project = createSiteProject({ name: "Meu negócio", archetype });
      expect(project.reviews).toEqual([]);
      expect(project.items).toEqual([]);
      expect(project.gallery).toEqual([]);
      expect(project.appearance.palette).toEqual(PALETTES[archetype][0]?.value);
      const html = renderToStaticMarkup(<SitePreview project={project} />);
      expect(html).toContain("Meu negócio");
      expect(html).not.toContain("O que dizem sobre nós");
      expect(html).not.toContain("Conte aqui");
      expect(html).not.toContain("Adicione um número");
    }
  });

  it("uses a real WhatsApp destination with Brazil's country prefix", () => {
    const project = createSiteProject({ name: "Ateliê", whatsapp: "(11) 99999-1234" });
    const html = renderToStaticMarkup(<SitePreview project={project} />);
    expect(html).toContain("https://wa.me/5511999991234");
  });
});
