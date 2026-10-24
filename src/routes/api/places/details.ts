import { createFileRoute } from "@tanstack/react-router";
import { isSameOrigin, jsonError, readJson } from "../../../lib/server/auth";
import {
  PlacesError,
  getPlaceDetails,
  placePhotosEnabled,
  placeReviewsEnabled,
  placesEnabled,
  publicPlacesEnabled,
  placesDetailsInput,
  placesMessage,
} from "../../../lib/integrations/places";
import { integrationEnv } from "../../../lib/server/runtime-env";

export const Route = createFileRoute("/api/places/details")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isSameOrigin(request)) return jsonError("Origem da solicitação não autorizada.", 403);
        const env = integrationEnv(request);
        if (!publicPlacesEnabled(env))
          return jsonError("A importação de empresas sem conta ainda não foi ativada.", 503);
        try {
          if (!placesEnabled(env)) throw new PlacesError("not_configured", 503);
          const input = placesDetailsInput.parse(await readJson(request, 1_024));
          const business = await getPlaceDetails(input.placeId, env.GOOGLE_PLACES_API_KEY, fetch, {
            contactFieldsEnabled: env.SITE_EXPRESS_ENABLE_PLACES_CONTACT_FIELDS === "1",
            photoFieldsEnabled: placePhotosEnabled(env),
            reviewFieldsEnabled: placeReviewsEnabled(env),
          });
          return Response.json(
            { business, source: "google_places" },
            {
              headers: { "Cache-Control": "no-store" },
            },
          );
        } catch (error) {
          const result = placesMessage(error);
          return Response.json(
            { error: result.message, code: result.code },
            {
              status: result.status,
              headers: { "Cache-Control": "no-store" },
            },
          );
        }
      },
    },
  },
});
