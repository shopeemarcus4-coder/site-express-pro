import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getStore, StorageUnavailableError } from "../../../lib/server/provider";
import { isSameOrigin, jsonError, readJson, sessionCookie } from "../../../lib/server/auth";

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
});

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isSameOrigin(request)) return jsonError("Origem não permitida.", 403);
        try {
          const parsed = schema.safeParse(await readJson(request, 16_384));
          if (!parsed.success) return jsonError("E-mail ou senha inválidos.", 400);
          const store = getStore(request);
          const user = await store.login(parsed.data.email, parsed.data.password);
          if (!user) return jsonError("E-mail ou senha inválidos.", 401);
          const session = await store.createSession(user.id);
          return Response.json(
            { user },
            {
              headers: {
                "Set-Cookie": sessionCookie(request, session.token, 7 * 24 * 60 * 60),
                "Cache-Control": "no-store",
              },
            },
          );
        } catch (error) {
          if (error instanceof StorageUnavailableError) return jsonError(error.message, 503);
          if (
            error instanceof SyntaxError ||
            (error instanceof Error && ["too_large", "content_type"].includes(error.message))
          )
            return jsonError("Envie um JSON válido e pequeno.", 400);
          return jsonError("Não foi possível entrar agora.", 500);
        }
      },
    },
  },
});
