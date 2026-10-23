import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "../../../lib/server/provider";

export const Route = createFileRoute("/api/public/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const slug = params.slug;
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80)
          return new Response(null, { status: 404 });
        try {
          const site = await getStore(request).getPublicSite(slug);
          return site
            ? Response.json(site, { headers: { "Cache-Control": "public, max-age=60" } })
            : new Response(null, { status: 404 });
        } catch {
          return new Response(null, { status: 503 });
        }
      },
    },
  },
});
