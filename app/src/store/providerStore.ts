import { create } from "zustand";

export interface ProviderHistoryEntry {
  claim_hash: string;
  date: string;
  patientAddress: string;
  /** Present on claims created after metadata enrichment */
  icd_code?: string;
  visit_date?: number;
  amount_cents?: number;
  license_id?: string;
  /** true = Supabase inbox delivery; false = deep link only */
  delivered_to_inbox?: boolean;
}

interface ProviderState {
  activeWalletAddress: string | null;
  history: ProviderHistoryEntry[];
  addHistory: (entry: ProviderHistoryEntry) => void;
}

export const useProviderStore = create<ProviderState>((set) => ({
  activeWalletAddress: null,
  history: [],
  addHistory: (entry) =>
    set((s) => ({ history: [entry, ...s.history] })),
}));
