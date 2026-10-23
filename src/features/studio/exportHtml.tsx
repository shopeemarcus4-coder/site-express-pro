import { renderToStaticMarkup } from "react-dom/server";
import { SitePreview } from "./SitePreview";
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
  const css = studioCss.replace(/<\/style/gi, "<\\/style");
  const filters = `<script>(function(){document.querySelectorAll('[data-sx-filter]').forEach(function(button){button.addEventListener('click',function(){var section=button.closest('.sx-site-services');if(!section)return;var selected=button.getAttribute('data-sx-filter');section.querySelectorAll('[data-sx-filter]').forEach(function(other){other.setAttribute('aria-pressed',String(other===button))});section.querySelectorAll('[data-sx-category]').forEach(function(card){card.hidden=selected!=='all'&&card.getAttribute('data-sx-category')!==selected})})})})();</script>`;
  return `<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${safeDescription}"><title>${safeTitle}</title><style>html{scroll-behavior:smooth}body{margin:0}${css}</style></head><body>${holder.innerHTML}${filters}</body></html>`;
}
