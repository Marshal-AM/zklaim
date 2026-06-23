import { create } from "zustand";

export interface ProviderHistoryEntry {
  claim_hash: string;
  date: string;
  patientAddress: string;
}

interface ProviderState {
  history: ProviderHistoryEntry[];
  addHistory: (entry: ProviderHistoryEntry) => void;
}

export const useProviderStore = create<ProviderState>((set) => ({
  history: [],
  addHistory: (entry) =>
    set((s) => ({ history: [entry, ...s.history] })),
}));
