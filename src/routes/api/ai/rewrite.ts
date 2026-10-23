import { createFileRoute } from "@tanstack/react-router";
import { getAuthenticatedUser, isSameOrigin, jsonError, readJson } from "../../../lib/server/auth";
import { aiEnabled, aiMessage, rewriteCopy, rewriteInput } from "../../../lib/integrations/ai";

export const Route = createFileRoute("/api/ai/rewrite")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await getAuthenticatedUser(request)))
          return jsonError("Entre na sua conta para consultar integrações.", 401);
        return Response.json(
          { configured: aiEnabled() },
          {
            headers: { "Cache-Control": "no-store" },
          },
        );
      },
      POST: async ({ request }) => {
        if (!isSameOrigin(request)) return jsonError("Origem da solicitação não autorizada.", 403);
        if (!(await getAuthenticatedUser(request)))
          return jsonError("Entre na sua conta para reescrever o texto.", 401);
        try {
          const input = rewriteInput.parse(await readJson(request, 4_096));
          const text = await rewriteCopy(input);
          return Response.json(
            { text, source: "gemini" },
            {
              headers: { "Cache-Control": "no-store" },
            },
          );
        } catch (error) {
          const result = aiMessage(error);
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
