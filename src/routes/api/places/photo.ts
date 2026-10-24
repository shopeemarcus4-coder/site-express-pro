import { createFileRoute } from "@tanstack/react-router";
import { getAuthenticatedUser } from "../../../lib/server/auth";
import {
  getPlacePhoto,
  placePhotosEnabled,
  placePhotoName,
  placesMessage,
} from "../../../lib/integrations/places";
import { integrationEnv } from "../../../lib/server/runtime-env";

export const Route = createFileRoute("/api/places/photo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await getAuthenticatedUser(request)))
          return new Response("Entre na sua conta para ver as fotos.", { status: 401 });
        const env = integrationEnv(request);
        if (!placePhotosEnabled(env))
          return new Response("Fotos do Google não configuradas.", { status: 503 });
        const name = new URL(request.url).searchParams.get("name");
        const parsed = placePhotoName.safeParse(name);
        if (!parsed.success) return new Response("Foto inválida.", { status: 400 });
        try {
          const photo = await getPlacePhoto(parsed.data, env.GOOGLE_PLACES_API_KEY);
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
