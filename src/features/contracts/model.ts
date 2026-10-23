export type ContractKind = "google-profile" | "site-maintenance" | "installments";
export type ContractStatus = "draft" | "review";

export interface ClientSite {
  id: string;
  name: string;
  url: string;
}

export interface ClientRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  sites: ClientSite[];
}

export interface ContractRecord {
  id: string;
  clientId: string;
  siteId: string | null;
  kind: ContractKind;
  status: ContractStatus;
  title: string;
  providerName: string;
  clientName: string;
  scope: string;
  amountCents: number;
  installments: number;
  startsOn: string;
  endsOn: string;
  firstPaymentOn: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContractsState {
  version: 1;
  clients: ClientRecord[];
  contracts: ContractRecord[];
}

export const EMPTY_CONTRACTS_STATE: ContractsState = {
  version: 1,
  clients: [],
  contracts: [],
};

export const CONTRACT_KINDS: Record<ContractKind, { title: string; description: string }> = {
  "google-profile": {
    title: "Gestão do Perfil da Empresa no Google",
    description: "Minuta para registrar um serviço recorrente de gestão do perfil comercial.",
  },
  "site-maintenance": {
    title: "Site, hospedagem e manutenção",
    description: "Minuta para registrar entrega do site, hospedagem e manutenção acordadas.",
  },
  installments: {
    title: "Compromisso de pagamento parcelado",
    description: "Minuta para registrar valor e número de parcelas acordados.",
  },
};

export const REMINDER_DAYS = [30, 15, 10] as const;

/** Calendar dates use UTC so reminders never change with the viewer's timezone. */
export function parseCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}

export function toCalendarDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/** Business reminders follow the Brazilian calendar day, including near UTC midnight. */
export function toBrazilCalendarDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const field = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${field("year")}-${field("month")}-${field("day")}`;
}

export function addCalendarDays(value: string, delta: number): string | null {
  const date = parseCalendarDate(value);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + delta);
  return toCalendarDate(date);
}

export function daysBetween(from: string, to: string): number | null {
  const left = parseCalendarDate(from);
  const right = parseCalendarDate(to);
  if (!left || !right) return null;
  return Math.round((right.getTime() - left.getTime()) / 86_400_000);
}

export function reminderDates(
  endsOn: string,
): Array<{ daysBefore: (typeof REMINDER_DAYS)[number]; on: string }> {
  return REMINDER_DAYS.flatMap((daysBefore) => {
    const on = addCalendarDays(endsOn, -daysBefore);
    return on ? [{ daysBefore, on }] : [];
  });
}

export function dueNotifications(contracts: ContractRecord[], today: string) {
  const result = contracts.flatMap((contract) =>
    contract.status === "review"
      ? reminderDates(contract.endsOn)
          .filter(({ on }) => on === today)
          .map(({ daysBefore }) => ({
            id: `${contract.id}:${daysBefore}`,
            contractId: contract.id,
            title: contract.title,
            daysBefore,
          }))
      : [],
  );
  return Array.from(new Map(result.map((item) => [item.id, item])).values());
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function formatCalendarDate(value: string): string {
  const date = parseCalendarDate(value);
  if (!date) return "Data não definida";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date);
}

export function installmentAmounts(amountCents: number, installments: number): number[] {
  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents < 0 ||
    !Number.isInteger(installments) ||
    installments < 1
  )
    return [];
  const quotient = Math.floor(amountCents / installments);
  const remainder = amountCents % installments;
  return Array.from({ length: installments }, (_, index) => quotient + (index < remainder ? 1 : 0));
}

export function validateContract(contract: ContractRecord): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!contract.title.trim()) errors["title"] = "Informe o título.";
  if (!contract.providerName.trim()) errors["providerName"] = "Informe o nome do prestador.";
  if (!contract.clientName.trim()) errors["clientName"] = "Informe o nome do cliente.";
  if (!contract.scope.trim()) errors["scope"] = "Descreva o serviço acordado.";
  if (!Number.isSafeInteger(contract.amountCents) || contract.amountCents <= 0)
    errors["amountCents"] = "Informe um valor maior que zero.";
  if (
    !Number.isInteger(contract.installments) ||
    contract.installments < 1 ||
    contract.installments > 36
  )
    errors["installments"] = "Use de 1 a 36 parcelas.";
  if (!parseCalendarDate(contract.startsOn))
    errors["startsOn"] = "Informe uma data inicial válida.";
  if (!parseCalendarDate(contract.endsOn)) errors["endsOn"] = "Informe uma data final válida.";
  if (!parseCalendarDate(contract.firstPaymentOn))
    errors["firstPaymentOn"] = "Informe o primeiro vencimento.";
  const duration = daysBetween(contract.startsOn, contract.endsOn);
  if (duration !== null && duration < 0)
    errors["endsOn"] = "A data final deve ser posterior à inicial.";
  return errors;
}

export function createContract(
  client: ClientRecord,
  kind: ContractKind,
  now = new Date(),
): ContractRecord {
  const today = toBrazilCalendarDate(now);
  return {
    id: crypto.randomUUID(),
    clientId: client.id,
    siteId: null,
    kind,
    status: "draft",
    title: CONTRACT_KINDS[kind].title,
    providerName: "",
    clientName: client.name,
    scope: "",
    amountCents: 0,
    installments: 1,
    startsOn: today,
    endsOn: "",
    firstPaymentOn: "",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}
