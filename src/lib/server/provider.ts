import { D1SiteExpressStore, type D1Database } from "./d1";
import { getStore as getNodeStore, type SiteExpressStore } from "./store";

export class StorageUnavailableError extends Error {
  constructor() {
    super(
      "Armazenamento não configurado. Vincule um banco D1 como SITE_EXPRESS_DB no ambiente Cloudflare.",
    );
  }
}

type RuntimeRequest = Request & {
  runtime?: { name?: string; cloudflare?: { env?: Record<string, unknown> } };
};

function isD1Database(value: unknown): value is D1Database {
  return (
    typeof value === "object" &&
    value !== null &&
    "prepare" in value &&
    typeof value.prepare === "function" &&
    "batch" in value &&
    typeof value.batch === "function" &&
    "exec" in value &&
    typeof value.exec === "function"
  );
}

export function getStore(request?: Request): SiteExpressStore | D1SiteExpressStore {
  const runtime = (request as RuntimeRequest | undefined)?.runtime;
  if (runtime?.name === "cloudflare" || runtime?.cloudflare) {
    const binding = runtime.cloudflare?.env?.["SITE_EXPRESS_DB"];
    if (!isD1Database(binding)) throw new StorageUnavailableError();
    return new D1SiteExpressStore(binding);
  }
  return getNodeStore();
}
