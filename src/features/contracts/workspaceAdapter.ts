import type { ClientRecord, ContractRecord, ContractsState } from "./model";

/** The workspace shape shared by the dashboard and the tenant API. */
export interface ContractsWorkspace {
  businesses: Array<{ id: string; name: string; email?: unknown; phone?: unknown }>;
  sites: Array<{
    id: string;
    title: string;
    slug: string;
    status: "draft" | "published" | "suspended";
    businessId?: string;
    url?: unknown;
  }>;
  contracts: Array<{ id: string; businessId?: string }>;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isContractRecord(
  value: ContractsWorkspace["contracts"][number],
): value is ContractsWorkspace["contracts"][number] & ContractRecord {
  const fields = value as Record<string, unknown>;
  return (
    typeof fields["clientId"] === "string" &&
    (fields["siteId"] === null || typeof fields["siteId"] === "string") &&
    (fields["kind"] === "google-profile" ||
      fields["kind"] === "site-maintenance" ||
      fields["kind"] === "installments") &&
    (fields["status"] === "draft" || fields["status"] === "review") &&
    typeof fields["title"] === "string" &&
    typeof fields["providerName"] === "string" &&
    typeof fields["clientName"] === "string" &&
    typeof fields["scope"] === "string" &&
    typeof fields["amountCents"] === "number" &&
    typeof fields["installments"] === "number" &&
    typeof fields["startsOn"] === "string" &&
    typeof fields["endsOn"] === "string" &&
    typeof fields["firstPaymentOn"] === "string" &&
    typeof fields["createdAt"] === "string" &&
    typeof fields["updatedAt"] === "string"
  );
}

export function contractsStateFromWorkspace(workspace: ContractsWorkspace): ContractsState {
  const clients: ClientRecord[] = workspace.businesses.map((business) => ({
    id: business.id,
    name: business.name,
    email: text(business.email),
    phone: text(business.phone),
    sites: workspace.sites
      .filter((site) => site.businessId === business.id)
      .map((site) => ({ id: site.id, name: site.title, url: text(site.url) })),
  }));
  const clientIds = new Set(clients.map((client) => client.id));
  return {
    version: 1,
    clients,
    contracts: workspace.contracts.filter(
      (contract): contract is ContractsWorkspace["contracts"][number] & ContractRecord =>
        isContractRecord(contract) && clientIds.has(contract.clientId),
    ),
  };
}

/** Preserve unrelated dashboard fields while applying contract-screen changes. */
export function mergeContractsStateIntoWorkspace<T extends ContractsWorkspace>(
  workspace: T,
  state: ContractsState,
): T {
  const oldBusinesses = new Map(workspace.businesses.map((business) => [business.id, business]));
  const oldSites = new Map(workspace.sites.map((site) => [site.id, site]));
  const oldContracts = new Map(workspace.contracts.map((contract) => [contract.id, contract]));
  const existingSlugs = new Set(workspace.sites.map((site) => site.slug));
  const businesses = state.clients.map((client) => ({
    ...oldBusinesses.get(client.id),
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
  }));
  const updatedSites = state.clients.flatMap((client) =>
    client.sites.map((site) => {
      const oldSite = oldSites.get(site.id);
      let slug =
        oldSite?.slug ??
        `site-${site.id
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 70)}`;
      if (!oldSite) {
        const base = slug || "site";
        let suffix = 2;
        while (existingSlugs.has(slug)) slug = `${base.slice(0, 74)}-${suffix++}`;
        existingSlugs.add(slug);
      }
      return {
        ...oldSite,
        id: site.id,
        title: site.name,
        slug,
        status: oldSite?.status ?? ("draft" as const),
        businessId: client.id,
        url: site.url,
      };
    }),
  );
  const editedSiteIds = new Set(updatedSites.map((site) => site.id));
  const sites = [...workspace.sites.filter((site) => !editedSiteIds.has(site.id)), ...updatedSites];
  const updatedContracts = state.contracts.map((contract) => ({
    ...oldContracts.get(contract.id),
    ...contract,
    businessId: contract.clientId,
  }));
  const editedContractIds = new Set(updatedContracts.map((contract) => contract.id));
  const contracts = [
    ...workspace.contracts.filter((contract) => !editedContractIds.has(contract.id)),
    ...updatedContracts,
  ];
  return { ...workspace, businesses, sites, contracts } as T;
}
