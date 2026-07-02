import { create } from "zustand";
import type {
  PatientIdentity,
  InboxClaim,
  ClaimHistoryEntry,
} from "../types/patient";

export type { PatientIdentity, InboxClaim, ClaimHistoryEntry };

interface PatientState {
  activeWalletAddress: string | null;
  identity: PatientIdentity | null;
  inbox: InboxClaim[];
  history: ClaimHistoryEntry[];
  setIdentity: (identity: PatientIdentity | null) => void;
  addInboxClaim: (claim: InboxClaim) => void;
  updateInboxClaim: (id: string, patch: Partial<InboxClaim>) => void;
  addHistory: (entry: ClaimHistoryEntry) => void;
  updateAccumulator: (metCents: number) => void;
  resetPatientSession: () => void;
  loadPatientSession: (data: {
    activeWalletAddress: string;
    identity: PatientIdentity | null;
    inbox: InboxClaim[];
    history: ClaimHistoryEntry[];
  }) => void;
}

const EMPTY_PATIENT_STATE = {
  activeWalletAddress: null as string | null,
  identity: null as PatientIdentity | null,
  inbox: [] as InboxClaim[],
  history: [] as ClaimHistoryEntry[],
};

export const usePatientStore = create<PatientState>((set) => ({
  ...EMPTY_PATIENT_STATE,
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
  resetPatientSession: () => set({ ...EMPTY_PATIENT_STATE }),
  loadPatientSession: (data) =>
    set({
      activeWalletAddress: data.activeWalletAddress,
      identity: data.identity,
      inbox: data.inbox,
      history: data.history,
    }),
}));
