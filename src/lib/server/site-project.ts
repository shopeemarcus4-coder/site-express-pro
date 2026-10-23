import { z } from "zod";
import type { SiteProject } from "../../features/studio/types";

const text = z.string().max(10_000);
const shortText = z.string().max(500);
const item = z.object({
  id: shortText.min(1),
  title: shortText,
  description: text,
  image: text.optional(),
  price: shortText.optional(),
});
const review = z.object({
  id: shortText.min(1),
  author: shortText,
  quote: text,
  source: shortText.optional(),
});
const faq = z.object({ id: shortText.min(1), question: shortText, answer: text });

// This schema is the only source used for the public projection. Unknown editor fields are stripped.
export const siteProjectSchema: z.ZodType<SiteProject> = z.object({
  id: shortText.min(1),
  name: shortText.min(1),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  archetype: z.enum(["gastronomia", "servicos", "produtos"]),
  createdAt: shortText,
  updatedAt: shortText,
  isDemo: z.boolean(),
  business: z.object({
    name: shortText.min(1),
    category: shortText,
    city: shortText,
    state: shortText,
    address: text,
    whatsapp: shortText,
    mapsUrl: text,
    logoUrl: text,
  }),
  appearance: z.object({
    paletteId: shortText,
    palette: z.object({
      primary: shortText,
      secondary: shortText,
      accent: shortText,
      surface: shortText,
      ink: shortText,
      soft: shortText,
    }),
    headingFont: z.enum(["editorial", "modern", "classic"]),
    heroLayout: z.enum(["immersive", "split", "showcase"]),
    heroImage: text,
    heroImageAlt: text,
    heroPosition: shortText,
  }),
  content: z.object({
    eyebrow: text,
    heroTitle: shortText.min(1),
    heroSubtitle: text,
    ctaLabel: shortText,
    servicesTitle: shortText,
    aboutTitle: shortText,
    aboutBody: text,
    galleryTitle: shortText,
    faqTitle: shortText,
    contactTitle: shortText,
    contactBody: text,
    promoTitle: shortText,
    promoBody: text,
    videoTitle: shortText,
    videoUrl: text,
  }),
  sections: z
    .array(
      z.object({
        id: z.enum([
          "hero",
          "services",
          "about",
          "gallery",
          "reviews",
          "faq",
          "contact",
          "promo",
          "video",
        ]),
        enabled: z.boolean(),
      }),
    )
    .max(20),
  items: z.array(item).max(100),
  gallery: z.array(text).max(100),
  reviews: z.array(review).max(100),
  faqs: z.array(faq).max(100),
});
