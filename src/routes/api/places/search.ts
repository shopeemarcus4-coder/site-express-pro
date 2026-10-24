import { createFileRoute } from "@tanstack/react-router";
import { getAuthenticatedUser, isSameOrigin, jsonError, readJson } from "../../../lib/server/auth";
import {
  PlacesError,
  placesEnabled,
  publicPlacesEnabled,
  placesMessage,
  placesSearchInput,
  searchPlaces,
} from "../../../lib/integrations/places";
import { integrationEnv } from "../../../lib/server/runtime-env";

export const Route = createFileRoute("/api/places/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const env = integrationEnv(request);
        if (!(await getAuthenticatedUser(request)) && !publicPlacesEnabled(env))
          return jsonError("Entre na sua conta para consultar integrações.", 401);
        return Response.json(
          { configured: placesEnabled(env) },
          {
            headers: { "Cache-Control": "no-store" },
          },
        );
      },
      POST: async ({ request }) => {
        if (!isSameOrigin(request)) return jsonError("Origem da solicitação não autorizada.", 403);
        const env = integrationEnv(request);
        if (!(await getAuthenticatedUser(request)) && !publicPlacesEnabled(env))
          return jsonError("Entre na sua conta para buscar empresas.", 401);
        try {
          if (!placesEnabled(env)) throw new PlacesError("not_configured", 503);
          const input = placesSearchInput.parse(await readJson(request, 1_024));
          const results = await searchPlaces(input.query, env.GOOGLE_PLACES_API_KEY);
          return Response.json(
            { results, source: "google_places" },
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
