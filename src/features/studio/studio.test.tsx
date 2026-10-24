import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createSiteProject, PALETTES } from "./presets";
import { SitePreview } from "./SitePreview";
import { siteProjectSchema } from "../../lib/server/site-project";
import { buildStandaloneHtml } from "./exportHtml";
import { JSDOM } from "jsdom";
import { safeImageSrc } from "./media";

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

  it("keeps custom SEO text in the safe public site projection", () => {
    const project = createSiteProject({ name: "Ateliê", city: "Recife" });
    project.marketing = {
      seoTitle: "Ateliê em Recife",
      seoDescription: "Conheça o trabalho do Ateliê em Recife.",
    };
    const published = siteProjectSchema.parse(project);
    expect(published.marketing).toEqual(project.marketing);
  });

  it("uses a confirmed address for a map and truthful export metadata", () => {
    const project = createSiteProject({
      name: "Clínica Exemplo",
      archetype: "servicos",
      address: "Rua Um, 10",
      city: "Londrina",
    });
    const html = buildStandaloneHtml(project);
    const dom = new JSDOM(html);
    const document = dom.window.document;
    expect(document.querySelector("iframe")?.getAttribute("src")).toContain(
      "Rua%20Um%2C%2010%2C%20Londrina",
    );
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content")).toContain(
      "Clínica Exemplo",
    );
    const schema = JSON.parse(
      document.querySelector('script[type="application/ld+json"]')!.textContent!,
    ) as Record<string, unknown>;
    expect(schema).toMatchObject({
      name: "Clínica Exemplo",
      address: { streetAddress: "Rua Um, 10", addressLocality: "Londrina" },
    });
    expect(schema).not.toHaveProperty("aggregateRating");
    dom.window.close();
  });

  it("exports working category filters in standalone HTML", () => {
    const project = createSiteProject({ name: "Ateliê", archetype: "gastronomia" });
    project.items = [
      { id: "a", title: "Prato da casa", description: "", category: "Pratos" },
      { id: "b", title: "Bolo", description: "", category: "Doces" },
    ];
    const dom = new JSDOM(buildStandaloneHtml(project), { runScripts: "dangerously" });
    const document = dom.window.document;
    const doces = document.querySelector<HTMLButtonElement>('[data-sx-filter="Doces"]');
    doces?.click();
    expect(document.querySelector<HTMLElement>('[data-sx-category="Pratos"]')?.hidden).toBe(true);
    expect(document.querySelector<HTMLElement>('[data-sx-category="Doces"]')?.hidden).toBe(false);
    dom.window.close();
  });

  it("rejects unsafe image schemes", () => {
    expect(safeImageSrc("javascript:alert(1)")).toBeNull();
    expect(safeImageSrc("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
  });
});
