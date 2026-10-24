import { createFileRoute } from "@tanstack/react-router";
import { AiError } from "../../../lib/integrations/ai";
import {
  createBusinessImage,
  imageAiMessage,
  imageInput,
  publicImageAiEnabled,
} from "../../../lib/integrations/images";
import { isSameOrigin, jsonError, readJson } from "../../../lib/server/auth";
import { D1SiteExpressStore } from "../../../lib/server/d1";
import { getStore, StorageUnavailableError } from "../../../lib/server/provider";
import { integrationEnv } from "../../../lib/server/runtime-env";

function dailyLimit(value: string | undefined, fallback: number, maximum: number): number {
  const configured = Number(value);
  return Number.isInteger(configured) && configured >= 1 && configured <= maximum
    ? configured
    : fallback;
}

function trustedClientIp(request: Request): string | null {
  const runtime = (request as Request & { runtime?: { name?: string; cloudflare?: unknown } })
    .runtime;
  if (runtime?.name !== "cloudflare" && !runtime?.cloudflare) return null;
  // Cloudflare sets this header at its edge. Refuse local/unknown runtimes instead of
  // accepting an arbitrary X-Forwarded-For value supplied by the caller.
  const value = request.headers.get("CF-Connecting-IP")?.trim() ?? "";
  return /^[0-9A-Fa-f:.]{3,45}$/.test(value) ? value : null;
}

async function clientDigest(ip: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(ip)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function guestStore(request: Request): D1SiteExpressStore {
  const store = getStore(request);
  if (!(store instanceof D1SiteExpressStore)) throw new StorageUnavailableError();
  return store;
}

export const Route = createFileRoute("/api/ai/image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const env = integrationEnv(request);
        const perClientLimit = dailyLimit(env.SITE_EXPRESS_IMAGE_DAILY_LIMIT, 4, 20);
        const globalLimit = dailyLimit(env.SITE_EXPRESS_IMAGE_GLOBAL_DAILY_LIMIT, 20, 100);
        let configured = false;
        if (publicImageAiEnabled(env) && trustedClientIp(request)) {
          try {
            guestStore(request);
            configured = true;
          } catch {
            configured = false;
          }
        }
        return Response.json(
          { configured, dailyLimit: perClientLimit, globalDailyLimit: globalLimit },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
      POST: async ({ request }) => {
        if (!isSameOrigin(request)) return jsonError("Origem da solicitação não autorizada.", 403);
        try {
          const env = integrationEnv(request);
          if (!publicImageAiEnabled(env)) throw new AiError("not_configured", 503);
          const store = guestStore(request);
          const ip = trustedClientIp(request);
          if (!ip) return jsonError("Proteção de cota indisponível nesta hospedagem.", 503);
          const input = imageInput.parse(await readJson(request, 2_000_000));
          const day = new Date().toISOString().slice(0, 10);
          const digest = await clientDigest(ip, env.GEMINI_API_KEY!);
          const allowed = await store.consumeGuestImageQuota(
            digest,
            day,
            dailyLimit(env.SITE_EXPRESS_IMAGE_DAILY_LIMIT, 4, 20),
            dailyLimit(env.SITE_EXPRESS_IMAGE_GLOBAL_DAILY_LIMIT, 20, 100),
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
