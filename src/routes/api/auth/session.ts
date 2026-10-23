import { createFileRoute } from "@tanstack/react-router";
import {
  expiredSessionCookie,
  getAuthenticatedUser,
  isSameOrigin,
  jsonError,
  readSessionCookie,
} from "../../../lib/server/auth";
import { getStore, StorageUnavailableError } from "../../../lib/server/provider";

export const Route = createFileRoute("/api/auth/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await getAuthenticatedUser(request);
          return user
            ? Response.json({ user }, { headers: { "Cache-Control": "no-store" } })
            : jsonError("Entre na sua conta.", 401);
        } catch (error) {
          return error instanceof StorageUnavailableError
            ? jsonError(error.message, 503)
            : jsonError("Não foi possível verificar a sessão.", 500);
        }
      },
      DELETE: async ({ request }) => {
        if (!isSameOrigin(request)) return jsonError("Origem não permitida.", 403);
        const token = readSessionCookie(request);
        try {
          if (token) await getStore(request).deleteSession(token);
        } catch (error) {
          return error instanceof StorageUnavailableError
            ? jsonError(error.message, 503)
            : jsonError("Não foi possível encerrar a sessão.", 500);
        }
        return Response.json(
          { success: true },
          {
            headers: {
              "Set-Cookie": expiredSessionCookie(request),
              "Cache-Control": "no-store",
            },
          },
        );
      },
    },
  },
});
