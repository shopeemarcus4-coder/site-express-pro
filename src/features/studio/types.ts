export type SiteArchetype = "gastronomia" | "servicos" | "produtos";

export type SiteSectionId =
  "hero" | "services" | "about" | "gallery" | "reviews" | "faq" | "contact" | "promo" | "video";

export interface SiteItem {
  id: string;
  title: string;
  description: string;
  image?: string | undefined;
  price?: string | undefined;
  category?: string | undefined;
  badge?: string | undefined;
}

export interface SiteReview {
  id: string;
  author: string;
  quote: string;
  source?: string | undefined;
}

export interface SiteFaq {
  id: string;
  question: string;
  answer: string;
}

export interface SiteSection {
  id: SiteSectionId;
  enabled: boolean;
}

export interface SitePalette {
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  ink: string;
  soft: string;
}

export interface SiteProject {
  id: string;
  name: string;
  slug: string;
  archetype: SiteArchetype;
  createdAt: string;
  updatedAt: string;
  isDemo: boolean;
  business: {
    name: string;
    category: string;
    city: string;
    state: string;
    address: string;
    whatsapp: string;
    mapsUrl: string;
    logoUrl: string;
  };
  appearance: {
    paletteId: string;
    palette: SitePalette;
    headingFont: "editorial" | "modern" | "classic";
    heroLayout: "immersive" | "split" | "showcase";
    heroImage: string;
    heroImageMobile?: string | undefined;
    aboutImage?: string | undefined;
    aboutImageMobile?: string | undefined;
    heroImageIllustrative?: boolean | undefined;
    heroImageMobileIllustrative?: boolean | undefined;
    aboutImageIllustrative?: boolean | undefined;
    aboutImageMobileIllustrative?: boolean | undefined;
    heroImageAlt: string;
    heroPosition: string;
  };
  content: {
    eyebrow: string;
    heroTitle: string;
    heroSubtitle: string;
    ctaLabel: string;
    servicesTitle: string;
    aboutTitle: string;
    aboutBody: string;
    galleryTitle: string;
    faqTitle: string;
    contactTitle: string;
    contactBody: string;
    promoTitle: string;
    promoBody: string;
    videoTitle: string;
    videoUrl: string;
  };
  marketing?:
    | {
        seoTitle: string;
        seoDescription: string;
      }
    | undefined;
  sections: SiteSection[];
  items: SiteItem[];
  gallery: string[];
  galleryIllustrative?: boolean[] | undefined;
  reviews: SiteReview[];
  faqs: SiteFaq[];
}

export interface BusinessInput {
  name: string;
  category?: string;
  city?: string;
  state?: string;
  address?: string;
  whatsapp?: string;
  mapsUrl?: string;
  logoUrl?: string;
  heroImage?: string;
  heroImageAlt?: string;
  archetype?: SiteArchetype;
  id?: string;
  isDemo?: boolean;
}
