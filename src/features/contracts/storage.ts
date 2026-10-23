import { EMPTY_CONTRACTS_STATE, type ContractsState } from "./model";

const STORAGE_KEY = "site-express-contracts-drafts-v1";

export function loadContractsState(): ContractsState {
  if (typeof window === "undefined") return EMPTY_CONTRACTS_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_CONTRACTS_STATE;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return EMPTY_CONTRACTS_STATE;
    const state = value as Partial<ContractsState>;
    if (state.version !== 1 || !Array.isArray(state.clients) || !Array.isArray(state.contracts))
      return EMPTY_CONTRACTS_STATE;
    return state as ContractsState;
  } catch {
    return EMPTY_CONTRACTS_STATE;
  }
}

export function saveContractsState(state: ContractsState): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
