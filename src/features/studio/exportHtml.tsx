import { renderToStaticMarkup } from "react-dom/server";
import { SitePreview } from "./SitePreview";
import { safeImageSrc } from "./media";
import type { SiteProject } from "./types";
import studioCss from "../../styles/studio.css?raw";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ||
      character,
  );

export function buildStandaloneHtml(project: SiteProject) {
  const markup = renderToStaticMarkup(<SitePreview project={project} />);
  const holder = document.createElement("div");
  holder.innerHTML = markup;
  holder.querySelectorAll('[data-export-omit="true"]').forEach((node) => node.remove());
  holder.querySelectorAll("[data-edit-field],[data-empty]").forEach((node) => {
    node.removeAttribute("data-edit-field");
    node.removeAttribute("data-empty");
  });
  const description =
    project.marketing?.seoDescription.trim() ||
    [project.business.category, project.business.city].filter(Boolean).join(" em ") ||
    project.content.heroSubtitle;
  const safeTitle = escapeHtml(
    project.marketing?.seoTitle.trim() ||
      `${project.business.name} — ${project.business.category || "Site oficial"}`,
  );
  const safeDescription = escapeHtml(description);
  const externalHero = safeImageSrc(project.appearance.heroImage);
  const socialImage = externalHero && /^https?:\/\//i.test(externalHero) ? externalHero : null;
  const address = project.business.address.trim();
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: project.business.name,
    description,
    ...(socialImage ? { image: socialImage } : {}),
    ...(address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: address,
            ...(project.business.city ? { addressLocality: project.business.city } : {}),
            ...(project.business.state ? { addressRegion: project.business.state } : {}),
            addressCountry: "BR",
          },
        }
      : {}),
  }).replace(/</g, "\\u003c");
  const css = studioCss.replace(/<\/style/gi, "<\\/style");
  const filters = `<script>(function(){document.querySelectorAll('[data-sx-filter]').forEach(function(button){button.addEventListener('click',function(){var section=button.closest('.sx-site-services');if(!section)return;var selected=button.getAttribute('data-sx-filter');section.querySelectorAll('[data-sx-filter]').forEach(function(other){other.setAttribute('aria-pressed',String(other===button))});section.querySelectorAll('[data-sx-category]').forEach(function(card){card.hidden=selected!=='all'&&card.getAttribute('data-sx-category')!==selected})})})})();</script>`;
  const gallery = `<script>(function(){document.querySelectorAll('.sx-site-gallery').forEach(function(section){var dialog=section.querySelector('dialog');if(!dialog||!dialog.showModal)return;section.querySelectorAll('[data-sx-gallery]').forEach(function(button){button.addEventListener('click',function(){var source=button.querySelector('img'),large=dialog.querySelector('img');if(!source||!large)return;large.src=source.src;large.alt=source.alt;dialog.showModal()})});var close=dialog.querySelector('[data-sx-gallery-close]');if(close)close.addEventListener('click',function(){dialog.close()});dialog.addEventListener('click',function(event){if(event.target===dialog)dialog.close()})})})();</script>`;
  const menu = `<script>(function(){document.querySelectorAll('.sx-site-mobile-menu nav a').forEach(function(link){link.addEventListener('click',function(){var menu=link.closest('details');if(menu)menu.open=false})})})();</script>`;
  return `<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${safeDescription}"><meta property="og:type" content="website"><meta property="og:title" content="${safeTitle}"><meta property="og:description" content="${safeDescription}">${socialImage ? `<meta property="og:image" content="${escapeHtml(socialImage)}">` : ""}<meta name="theme-color" content="${escapeHtml(project.appearance.palette.primary)}"><title>${safeTitle}</title><script type="application/ld+json">${structuredData}</script><style>html{scroll-behavior:smooth}body{margin:0}${css}</style></head><body>${holder.innerHTML}${filters}${gallery}${menu}</body></html>`;
}
