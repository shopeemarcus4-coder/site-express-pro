import { createFileRoute } from "@tanstack/react-router";
import { getAuthenticatedUser, isSameOrigin, jsonError, readJson } from "../../../lib/server/auth";
import {
  placesEnabled,
  placesMessage,
  placesSearchInput,
  searchPlaces,
} from "../../../lib/integrations/places";

export const Route = createFileRoute("/api/places/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await getAuthenticatedUser(request)))
          return jsonError("Entre na sua conta para consultar integrações.", 401);
        return Response.json(
          { configured: placesEnabled() },
          {
            headers: { "Cache-Control": "no-store" },
          },
        );
      },
      POST: async ({ request }) => {
        if (!isSameOrigin(request)) return jsonError("Origem da solicitação não autorizada.", 403);
        if (!(await getAuthenticatedUser(request)))
          return jsonError("Entre na sua conta para buscar empresas.", 401);
        try {
          const input = placesSearchInput.parse(await readJson(request, 1_024));
          const results = await searchPlaces(input.query);
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
