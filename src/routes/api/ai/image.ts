import { createFileRoute } from "@tanstack/react-router";
import { AiError } from "../../../lib/integrations/ai";
import {
  createBusinessImage,
  imageAiEnabled,
  imageAiMessage,
  imageInput,
} from "../../../lib/integrations/images";
import { getAuthenticatedUser, isSameOrigin, jsonError, readJson } from "../../../lib/server/auth";
import { integrationEnv } from "../../../lib/server/runtime-env";
import { getStore, StorageUnavailableError } from "../../../lib/server/provider";

function imageDailyLimit(value: string | undefined): number {
  const configured = Number(value);
  return Number.isInteger(configured) && configured >= 1 && configured <= 20 ? configured : 4;
}

export const Route = createFileRoute("/api/ai/image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          if (!(await getAuthenticatedUser(request)))
            return jsonError("Entre na sua conta para consultar integrações.", 401);
          const env = integrationEnv(request);
          return Response.json(
            {
              configured: imageAiEnabled(env),
              dailyLimit: imageDailyLimit(env.SITE_EXPRESS_IMAGE_DAILY_LIMIT),
            },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (error) {
          if (error instanceof StorageUnavailableError) return jsonError(error.message, 503);
          return jsonError("Não foi possível consultar a integração de imagens.", 502);
        }
      },
      POST: async ({ request }) => {
        if (!isSameOrigin(request)) return jsonError("Origem da solicitação não autorizada.", 403);
        try {
          const user = await getAuthenticatedUser(request);
          if (!user) return jsonError("Entre na sua conta para criar imagens.", 401);
          const env = integrationEnv(request);
          if (!imageAiEnabled(env)) throw new AiError("not_configured", 503);
          const input = imageInput.parse(await readJson(request, 2_000_000));
          const day = new Date().toISOString().slice(0, 10);
          const allowed = await getStore(request).consumeImageQuota(
            user.organizationId,
            day,
            imageDailyLimit(env.SITE_EXPRESS_IMAGE_DAILY_LIMIT),
          );
          if (!allowed) throw new AiError("quota_exceeded", 503);
          const image = await createBusinessImage(
            input,
            env.GEMINI_API_KEY,
            fetch,
            env.SITE_EXPRESS_GEMINI_IMAGE_MODEL,
          );
          return Response.json(
            { image, source: "gemini" },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (error) {
          if (error instanceof StorageUnavailableError) return jsonError(error.message, 503);
          const result = imageAiMessage(error);
          return Response.json(
            { error: result.message, code: result.code },
            { status: result.status, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
