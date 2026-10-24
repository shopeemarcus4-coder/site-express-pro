type RuntimeRequest = Request & {
  runtime?: { name?: string; cloudflare?: { env?: Record<string, unknown> } };
};

const keys = [
  "GEMINI_API_KEY",
  "GOOGLE_PLACES_API_KEY",
  "SITE_EXPRESS_ENABLE_AI",
  "SITE_EXPRESS_GEMINI_MODEL",
  "SITE_EXPRESS_ENABLE_PLACES",
  "SITE_EXPRESS_ENABLE_PLACES_PHOTOS",
  "SITE_EXPRESS_ENABLE_PLACES_CONTACT_FIELDS",
] as const;

export type IntegrationEnv = Record<(typeof keys)[number], string | undefined>;

/** Read deployed Worker bindings directly; keep Node's process.env for local use. */
export function integrationEnv(request: Request): IntegrationEnv {
  const runtime = (request as RuntimeRequest).runtime;
  const source =
    runtime?.name === "cloudflare" || runtime?.cloudflare ? runtime.cloudflare?.env : process.env;
  return Object.fromEntries(
    keys.map((key) => [key, typeof source?.[key] === "string" ? source[key] : undefined]),
  ) as IntegrationEnv;
}
