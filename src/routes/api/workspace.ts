import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAuthenticatedUser, isSameOrigin, jsonError, readJson } from "../../lib/server/auth";
import { StoreError } from "../../lib/server/store";
import { getStore, StorageUnavailableError } from "../../lib/server/provider";

const payloadSchema = z.object({ baseVersion: z.number().int().min(0), workspace: z.unknown() });

export const Route = createFileRoute("/api/workspace")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await getAuthenticatedUser(request);
          if (!user) return jsonError("Entre na sua conta.", 401);
          return Response.json(await getStore(request).getWorkspace(user.organizationId), {
            headers: { "Cache-Control": "no-store" },
          });
        } catch (error) {
          return error instanceof StorageUnavailableError
            ? jsonError(error.message, 503)
            : jsonError("Não foi possível carregar seus projetos.", 500);
        }
      },
      PUT: async ({ request }) => {
        if (!isSameOrigin(request)) return jsonError("Origem não permitida.", 403);
        try {
          const user = await getAuthenticatedUser(request);
          if (!user) return jsonError("Entre na sua conta.", 401);
          const payload = payloadSchema.safeParse(await readJson(request, 3_000_000));
          if (!payload.success) return jsonError("Dados inválidos.", 400);
          const result = await getStore(request).saveWorkspace(
            user.organizationId,
            payload.data.baseVersion,
            payload.data.workspace,
          );
          return Response.json(result, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          if (error instanceof StorageUnavailableError) return jsonError(error.message, 503);
          if (error instanceof StoreError)
            return jsonError(
              error.message,
              error.code === "stale_version" || error.code === "duplicate_slug" ? 409 : 400,
            );
          if (error instanceof z.ZodError)
            return jsonError("Confira os dados do projeto antes de salvar.", 400);
          if (
            error instanceof SyntaxError ||
            (error instanceof Error && ["too_large", "content_type"].includes(error.message))
          )
            return jsonError("Envie um JSON válido de até 3 MB.", 400);
          return jsonError("Não foi possível salvar. Tente novamente.", 500);
        }
      },
    },
  },
});
