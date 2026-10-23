import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  daysBetween,
  dueNotifications,
  installmentAmounts,
  parseCalendarDate,
  reminderDates,
  toBrazilCalendarDate,
  type ContractRecord,
} from "./model";
import { contractsStateFromWorkspace, mergeContractsStateIntoWorkspace } from "./workspaceAdapter";

const contract: ContractRecord = {
  id: "contract-1",
  clientId: "business-1",
  siteId: "site-1",
  kind: "site-maintenance",
  status: "review",
  title: "Manutenção do site",
  providerName: "Agência",
  clientName: "Cliente",
  scope: "Atualizações mensais",
  amountCents: 10001,
  installments: 3,
  startsOn: "2028-01-01",
  endsOn: "2028-03-31",
  firstPaymentOn: "2028-01-10",
  createdAt: "2028-01-01T00:00:00.000Z",
  updatedAt: "2028-01-01T00:00:00.000Z",
};

describe("calendar-date reminders", () => {
  it("rejects impossible dates and handles leap years", () => {
    expect(parseCalendarDate("2027-02-29")).toBeNull();
    expect(parseCalendarDate("2028-02-29")).not.toBeNull();
    expect(addCalendarDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(daysBetween("2028-02-29", "2028-03-01")).toBe(1);
  });

  it("uses the Brazil calendar day around UTC midnight", () => {
    expect(toBrazilCalendarDate(new Date("2028-03-16T01:00:00.000Z"))).toBe("2028-03-15");
    expect(toBrazilCalendarDate(new Date("2028-03-16T03:00:00.000Z"))).toBe("2028-03-16");
  });

  it("raises each 30/15/10-day reminder only on its exact calendar day", () => {
    expect(reminderDates("2028-03-31")).toEqual([
      { daysBefore: 30, on: "2028-03-01" },
      { daysBefore: 15, on: "2028-03-16" },
      { daysBefore: 10, on: "2028-03-21" },
    ]);
    expect(dueNotifications([contract], "2028-03-16")).toEqual([
      {
        id: "contract-1:15",
        contractId: "contract-1",
        title: "Manutenção do site",
        daysBefore: 15,
      },
    ]);
    expect(dueNotifications([{ ...contract, status: "draft" }], "2028-03-16")).toEqual([]);
  });

  it("distributes all cents without rounding away the total", () => {
    expect(installmentAmounts(10001, 3)).toEqual([3334, 3334, 3333]);
  });
});

describe("shared workspace adapter", () => {
  it("uses existing business and site records and preserves unrelated workspace data", () => {
    const workspace = {
      businesses: [{ id: "business-1", name: "Cliente", segment: "saúde" }],
      sites: [
        {
          id: "site-1",
          title: "Site atual",
          slug: "site-atual",
          status: "published" as const,
          businessId: "business-1",
          publicData: { hero: "Foto" },
        },
      ],
      contracts: [contract, { id: "legacy", businessId: "business-1", legacyField: "keep" }],
    };
    const state = contractsStateFromWorkspace(workspace);
    expect(state.clients[0]?.sites[0]?.id).toBe("site-1");
    expect(state.contracts).toHaveLength(1);
    const merged = mergeContractsStateIntoWorkspace(workspace, {
      ...state,
      clients: state.clients.map((client) => ({ ...client, phone: "1234" })),
    });
    expect(merged.businesses[0]?.["segment"]).toBe("saúde");
    expect(merged.businesses[0]).toMatchObject({ phone: "1234" });
    expect(merged.sites[0]?.["publicData"]).toEqual({ hero: "Foto" });
    expect(merged.sites[0]?.status).toBe("published");
    expect(merged.contracts.find((item) => item.id === "legacy")).toMatchObject({
      legacyField: "keep",
    });
    expect(merged.contracts.find((item) => item.id === "contract-1")).toMatchObject({
      businessId: "business-1",
    });
  });
});
