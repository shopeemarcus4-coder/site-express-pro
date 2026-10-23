import { createFileRoute } from "@tanstack/react-router";
import { getAuthenticatedUser, isSameOrigin, jsonError, readJson } from "../../../lib/server/auth";
import {
  getPlaceDetails,
  placesDetailsInput,
  placesMessage,
} from "../../../lib/integrations/places";

export const Route = createFileRoute("/api/places/details")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isSameOrigin(request)) return jsonError("Origem da solicitação não autorizada.", 403);
        if (!(await getAuthenticatedUser(request)))
          return jsonError("Entre na sua conta para importar empresas.", 401);
        try {
          const input = placesDetailsInput.parse(await readJson(request, 1_024));
          const business = await getPlaceDetails(input.placeId);
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
