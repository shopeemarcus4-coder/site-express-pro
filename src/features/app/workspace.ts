import type { SiteProject } from "../studio/types";
import type { ContractsWorkspace } from "../contracts";

export interface BusinessRecord {
  id: string;
  name: string;
  category?: string;
  city?: string;
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface SiteRecord {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "suspended";
  businessId?: string;
  publicData?: SiteProject;
  url?: string;
  [key: string]: unknown;
}

export interface AppWorkspace extends ContractsWorkspace {
  businesses: BusinessRecord[];
  sites: SiteRecord[];
  contracts: Array<{ id: string; businessId?: string; [key: string]: unknown }>;
}

export const emptyWorkspace = (): AppWorkspace => ({ businesses: [], sites: [], contracts: [] });

export const DEMO_STORAGE_KEY = "site-express-local-workspace-v1";

export function loadLocalWorkspace(): AppWorkspace {
  try {
    const saved = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!saved) return emptyWorkspace();
    const parsed: unknown = JSON.parse(saved);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "businesses" in parsed &&
      Array.isArray(parsed.businesses) &&
      "sites" in parsed &&
      Array.isArray(parsed.sites) &&
      "contracts" in parsed &&
      Array.isArray(parsed.contracts)
    )
      return parsed as AppWorkspace;
  } catch {
    /* The user can start with an empty local workspace. */
  }
  return emptyWorkspace();
}

export function uniqueSlug(base: string, sites: SiteRecord[], exceptId?: string): string {
  const taken = new Set(sites.filter((site) => site.id !== exceptId).map((site) => site.slug));
  let slug = base;
  let suffix = 2;
  while (taken.has(slug)) slug = `${base.slice(0, 72)}-${suffix++}`;
  return slug;
}
