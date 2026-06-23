import { create } from "zustand";
import type {
  PatientIdentity,
  InboxClaim,
  ClaimHistoryEntry,
} from "../types/patient";

export type { PatientIdentity, InboxClaim, ClaimHistoryEntry };

interface PatientState {
  identity: PatientIdentity | null;
  inbox: InboxClaim[];
  history: ClaimHistoryEntry[];
  setIdentity: (identity: PatientIdentity | null) => void;
  addInboxClaim: (claim: InboxClaim) => void;
  updateInboxClaim: (id: string, patch: Partial<InboxClaim>) => void;
  addHistory: (entry: ClaimHistoryEntry) => void;
  updateAccumulator: (metCents: number) => void;
}

export const usePatientStore = create<PatientState>((set) => ({
  identity: null,
  inbox: [],
  history: [],
  setIdentity: (identity) => set({ identity }),
  addInboxClaim: (claim) =>
    set((s) => ({ inbox: [...s.inbox, claim] })),
  updateInboxClaim: (id, patch) =>
    set((s) => ({
      inbox: s.inbox.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),
  addHistory: (entry) =>
    set((s) => ({ history: [entry, ...s.history] })),
  updateAccumulator: (metCents) =>
    set((s) =>
      s.identity
        ? {
            identity: { ...s.identity, accumulator_met_cents: metCents },
          }
        : {},
    ),
}));
