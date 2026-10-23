import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { PublicSite } from "../../features/studio/PublicSite";
import type { SiteProject } from "../../features/studio/types";

const readPublishedSite = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data }) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data) || data.length > 80) return null;
    const { getRequest } = await import("@tanstack/react-start/server");
    const { getStore } = await import("../../lib/server/provider");
    try {
      const site = await getStore(getRequest()).getPublicSite(data);
      return site
        ? { title: site.title, slug: site.slug, content: site.content as unknown as SiteProject }
        : null;
    } catch {
      return null;
    }
  });

export const Route = createFileRoute("/site/$slug")({
  loader: async ({ params }) => {
    const site = await readPublishedSite({ data: params.slug });
    if (!site) throw notFound();
    return site;
  },
  head: ({ loaderData }) => {
    const content = loaderData?.content;
    const title = content
      ? `${content.business.name} — ${content.business.category || "Site oficial"}`
      : "Site Express";
    const description = content?.content.heroSubtitle || "Site criado com Site Express.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
      ],
    };
  },
  component: PublishedSite,
});

function PublishedSite() {
  const result = Route.useLoaderData();
  return <PublicSite project={result.content} />;
}
