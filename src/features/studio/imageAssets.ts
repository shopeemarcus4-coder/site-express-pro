import type { SiteProject } from "./types";

export type ImageAsset = { name: string; content: Uint8Array };

function imageAsset(name: string, image: string): ImageAsset | null {
  const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!match) return null;
  const extension = match[1] === "jpeg" ? "jpg" : match[1]!;
  const raw = atob(match[2]!);
  return {
    name: name.replace(/\.[^.]+$/, `.${extension}`),
    content: Uint8Array.from(raw, (character) => character.charCodeAt(0)),
  };
}

export function imageAssets(project: SiteProject): ImageAsset[] {
  const source = [
    ["capa-desktop.webp", project.appearance.heroImage],
    ["capa-mobile.webp", project.appearance.heroImageMobile || ""],
    ["sobre-desktop.webp", project.appearance.aboutImage || ""],
    ["sobre-mobile.webp", project.appearance.aboutImageMobile || ""],
    ["logo.webp", project.business.logoUrl],
    ...project.gallery.map((image, index) => [`galeria-${index + 1}.webp`, image]),
    ...project.items.map((item, index) => [`item-${index + 1}.webp`, item.image || ""]),
  ] as [string, string][];
  return source.flatMap(([name, image]) => {
    const asset = imageAsset(name, image);
    return asset ? [asset] : [];
  });
}

export function imageChecklist(project: SiteProject): string[] {
  const slots = [
    ["capa-desktop", project.appearance.heroImage],
    ["capa-mobile", project.appearance.heroImageMobile],
    ["sobre-desktop", project.appearance.aboutImage],
    ["sobre-mobile", project.appearance.aboutImageMobile],
  ] as const;
  return [
    ...slots.map(([name, image]) => `${name}: ${image ? "PRONTO" : "PENDENTE"}`),
    ...project.items.map(
      (item, index) =>
        `item-${index + 1} (${item.title}): ${item.image ? "PRONTO" : "AGUARDANDO FOTO ORIGINAL"}`,
    ),
  ];
}
