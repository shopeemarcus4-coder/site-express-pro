import { createFileRoute } from "@tanstack/react-router";
import {
  getPlacePhoto,
  placePhotosEnabled,
  placePhotoName,
  placesMessage,
  publicPlacesEnabled,
} from "../../../lib/integrations/places";
import { integrationEnv } from "../../../lib/server/runtime-env";

export const Route = createFileRoute("/api/places/photo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const env = integrationEnv(request);
        if (!publicPlacesEnabled(env))
          return new Response("As fotos de empresas sem conta ainda não foram ativadas.", {
            status: 503,
          });
        if (!placePhotosEnabled(env))
          return new Response("Fotos do Google não configuradas.", { status: 503 });
        const params = new URL(request.url).searchParams;
        const name = params.get("name");
        const parsed = placePhotoName.safeParse(name);
        if (!parsed.success) return new Response("Foto inválida.", { status: 400 });
        const widthParam = params.get("maxWidthPx");
        if (widthParam !== null && widthParam !== "360" && widthParam !== "1200")
          return new Response("Tamanho de foto inválido.", { status: 400 });
        const width = widthParam === "1200" ? 1200 : 360;
        try {
          const photo = await getPlacePhoto(parsed.data, env.GOOGLE_PLACES_API_KEY, fetch, width);
          return new Response(photo.bytes, {
            headers: {
              "Content-Type": photo.contentType,
              "Cache-Control": "no-store",
              "Referrer-Policy": "no-referrer",
              "X-Content-Type-Options": "nosniff",
            },
          });
        } catch (error) {
          const result = placesMessage(error);
          return new Response(result.message, {
            status: result.status,
            headers: { "Cache-Control": "no-store" },
          });
        }
      },
    },
  },
});
