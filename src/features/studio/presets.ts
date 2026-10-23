import type {
  BusinessInput,
  SiteArchetype,
  SitePalette,
  SiteProject,
  SiteSectionId,
} from "./types";

export const PALETTES: Record<SiteArchetype, { id: string; name: string; value: SitePalette }[]> = {
  gastronomia: [
    {
      id: "artesanal",
      name: "Artesanal",
      value: {
        primary: "#153e23",
        secondary: "#2d7819",
        accent: "#f3c94d",
        surface: "#f8f7f0",
        ink: "#1b2516",
        soft: "#efeada",
      },
    },
    {
      id: "brasa",
      name: "Brasa",
      value: {
        primary: "#431407",
        secondary: "#a84b0b",
        accent: "#efbd65",
        surface: "#fdf8f2",
        ink: "#231209",
        soft: "#f5e8da",
      },
    },
    {
      id: "noturna",
      name: "Noturna",
      value: {
        primary: "#102319",
        secondary: "#57732e",
        accent: "#e9c46a",
        surface: "#f6f5ef",
        ink: "#14201a",
        soft: "#e8e9dc",
      },
    },
  ],
  servicos: [
    {
      id: "marinho",
      name: "Autoridade",
      value: {
        primary: "#0f172a",
        secondary: "#1e3a8a",
        accent: "#c6a24b",
        surface: "#fafafa",
        ink: "#0f172a",
        soft: "#eef2f7",
      },
    },
    {
      id: "esmeralda",
      name: "Esmeralda",
      value: {
        primary: "#064e3b",
        secondary: "#047857",
        accent: "#c6a24b",
        surface: "#f7faf8",
        ink: "#0b1f17",
        soft: "#e4f0ea",
      },
    },
    {
      id: "royal",
      name: "Royal",
      value: {
        primary: "#111827",
        secondary: "#2563eb",
        accent: "#9ac1ff",
        surface: "#f9fafb",
        ink: "#111827",
        soft: "#eaeff7",
      },
    },
  ],
  produtos: [
    {
      id: "azul",
      name: "Vitrine azul",
      value: {
        primary: "#111827",
        secondary: "#2563eb",
        accent: "#92bcff",
        surface: "#f9fafb",
        ink: "#111827",
        soft: "#edf1f7",
      },
    },
    {
      id: "laranja",
      name: "Terracota",
      value: {
        primary: "#271911",
        secondary: "#bb5826",
        accent: "#f1a96c",
        surface: "#fdf9f4",
        ink: "#271911",
        soft: "#f7ebdd",
      },
    },
    {
      id: "verde",
      name: "Vitrine verde",
      value: {
        primary: "#0b1512",
        secondary: "#087d5c",
        accent: "#8bdfc0",
        surface: "#f6fbf8",
        ink: "#0b1512",
        soft: "#e2f3eb",
      },
    },
  ],
};

export const SECTION_LABELS: Record<SiteSectionId, string> = {
  hero: "Apresentação",
  services: "Serviços e produtos",
  about: "Sobre o negócio",
  gallery: "Galeria",
  reviews: "Avaliações confirmadas",
  faq: "Dúvidas frequentes",
  contact: "Contato",
  promo: "Campanha",
  video: "Vídeo institucional",
};

const SECTION_ORDER: SiteSectionId[] = [
  "hero",
  "services",
  "about",
  "gallery",
  "reviews",
  "faq",
  "contact",
  "promo",
  "video",
];

const archetypeCopy: Record<
  SiteArchetype,
  { title: string; subtitle: string; services: string; about: string; contact: string }
> = {
  gastronomia: {
    title: "Sabor que reúne pessoas",
    subtitle: "Conheça o que preparamos e fale diretamente com a nossa equipe.",
    services: "Feito para o seu momento",
    about: "Nossa história",
    contact: "Peça ou tire suas dúvidas",
  },
  servicos: {
    title: "Cuidado atento em cada detalhe",
    subtitle: "Conheça nosso trabalho e converse com a nossa equipe.",
    services: "Como podemos ajudar",
    about: "Conheça nosso espaço",
    contact: "Vamos conversar?",
  },
  produtos: {
    title: "Encontre o que você procura",
    subtitle: "Explore nossa seleção e fale diretamente com a nossa equipe.",
    services: "Nossa seleção",
    about: "Sobre a loja",
    contact: "Fale com a loja",
  },
};

export function slugify(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "meu-site"
  );
}

export function createSiteProject(input: BusinessInput): SiteProject {
  const archetype = input.archetype ?? "servicos";
  const copy = archetypeCopy[archetype];
  const palette = PALETTES[archetype][0]!;
  const now = new Date().toISOString();
  return {
    id:
      input.id ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `site-${Date.now()}`),
    name: input.name,
    slug: slugify(input.name),
    archetype,
    createdAt: now,
    updatedAt: now,
    isDemo: input.isDemo ?? false,
    business: {
      name: input.name,
      category: input.category ?? "",
      city: input.city ?? "",
      state: input.state ?? "",
      address: input.address ?? "",
      whatsapp: input.whatsapp ?? "",
      mapsUrl: input.mapsUrl ?? "",
      logoUrl: input.logoUrl ?? "",
    },
    appearance: {
      paletteId: palette.id,
      palette: palette.value,
      headingFont:
        archetype === "gastronomia" ? "editorial" : archetype === "servicos" ? "classic" : "modern",
      heroLayout:
        archetype === "gastronomia" ? "immersive" : archetype === "servicos" ? "split" : "showcase",
      heroImage: input.heroImage ?? "",
      heroImageAlt: input.heroImageAlt ?? "",
      heroPosition: "50% 50%",
    },
    content: {
      eyebrow: [input.category, input.city].filter(Boolean).join(" · "),
      heroTitle: copy.title,
      heroSubtitle: copy.subtitle,
      ctaLabel:
        archetype === "gastronomia"
          ? "Fazer um pedido"
          : archetype === "servicos"
            ? "Agendar conversa"
            : "Consultar produtos",
      servicesTitle: copy.services,
      aboutTitle: copy.about,
      aboutBody: "",
      galleryTitle: "Um olhar mais de perto",
      faqTitle: "Dúvidas frequentes",
      contactTitle: copy.contact,
      contactBody: "Estamos à disposição para conversar sobre o que você precisa.",
      promoTitle: "Uma novidade para você",
      promoBody: "",
      videoTitle: "Conheça mais sobre nós",
      videoUrl: "",
    },
    marketing: { seoTitle: "", seoDescription: "" },
    sections: SECTION_ORDER.map((id) => ({
      id,
      enabled: ["hero", "services", "about", "contact"].includes(id),
    })),
    items: [],
    gallery: [],
    reviews: [],
    faqs: [],
  };
}
