import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { StoreError } from "../../../lib/server/store";
import { getStore, StorageUnavailableError } from "../../../lib/server/provider";
import { isSameOrigin, jsonError, readJson, sessionCookie } from "../../../lib/server/auth";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(256),
  organizationName: z.string().trim().min(2).max(120).optional(),
});

export const Route = createFileRoute("/api/auth/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isSameOrigin(request)) return jsonError("Origem não permitida.", 403);
        try {
          const parsed = schema.safeParse(await readJson(request, 16_384));
          if (!parsed.success)
            return jsonError(
              "Confira nome, e-mail e senha. A senha precisa ter ao menos 12 caracteres.",
              400,
            );
          const store = getStore(request);
          const user = await store.register({
            name: parsed.data.name,
            email: parsed.data.email,
            password: parsed.data.password,
            ...(parsed.data.organizationName
              ? { organizationName: parsed.data.organizationName }
              : {}),
          });
          const session = await store.createSession(user.id);
          return Response.json(
            { user },
            {
              status: 201,
              headers: {
                "Set-Cookie": sessionCookie(request, session.token, 7 * 24 * 60 * 60),
                "Cache-Control": "no-store",
              },
            },
          );
        } catch (error) {
          if (error instanceof StorageUnavailableError) return jsonError(error.message, 503);
          if (error instanceof StoreError && error.code === "duplicate_email")
            return jsonError(error.message, 409);
          if (
            error instanceof SyntaxError ||
            (error instanceof Error && ["too_large", "content_type"].includes(error.message))
          )
            return jsonError("Envie um JSON válido e pequeno.", 400);
          return jsonError("Não foi possível criar a conta.", 500);
        }
      },
    },
  },
});
