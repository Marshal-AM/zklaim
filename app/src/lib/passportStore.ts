import { opfsReadJson, opfsWriteJson } from "./opfs";
import {
  PATIENT_OPFS_BASENAMES,
  patientScopedOpfsKey,
  patientWalletId,
  requirePatientWalletId,
} from "./patientWalletScope";
import type { LocalLeafRecord, PassportLocalStore } from "./passport";

const STORE_VERSION = 1;

export async function loadPassportStore(
  walletAddress: string,
): Promise<PassportLocalStore | null> {
  const walletId = patientWalletId(walletAddress);
  if (!walletId) return null;
  const store = await opfsReadJson<PassportLocalStore>(
    patientScopedOpfsKey(walletId, PATIENT_OPFS_BASENAMES.passport),
  );
  if (!store) return null;
  if (store.patient_pubkey !== walletId) {
    return { ...store, patient_pubkey: walletId };
  }
  return store;
}

export async function savePassportStore(
  walletAddress: string,
  store: PassportLocalStore,
): Promise<void> {
  const walletId = requirePatientWalletId(walletAddress);
  const next: PassportLocalStore = {
    ...store,
    patient_pubkey: walletId,
  };
  await opfsWriteJson(
    patientScopedOpfsKey(walletId, PATIENT_OPFS_BASENAMES.passport),
    next,
  );
}

export function createEmptyPassportStore(patientPubkey: string): PassportLocalStore {
  const walletId = requirePatientWalletId(patientPubkey);
  return {
    version: STORE_VERSION,
    patient_pubkey: walletId,
    leaves: [],
  };
}

export async function ensurePassportStore(
  walletAddress: string,
): Promise<PassportLocalStore> {
  const walletId = requirePatientWalletId(walletAddress);
  const existing = await loadPassportStore(walletId);
  if (existing) return existing;
  const created = createEmptyPassportStore(walletId);
  await savePassportStore(walletId, created);
  return created;
}

export async function appendLocalLeaf(
  walletAddress: string,
  record: LocalLeafRecord,
  onChainRoot?: string,
): Promise<PassportLocalStore> {
  const walletId = requirePatientWalletId(walletAddress);
  const store =
    (await loadPassportStore(walletId)) ?? createEmptyPassportStore(walletId);
  const next: PassportLocalStore = {
    ...store,
    leaves: [...store.leaves, record],
    on_chain_root: onChainRoot ?? store.on_chain_root,
  };
  await savePassportStore(walletId, next);
  return next;
}

export function findLeafByNullifier(
  store: PassportLocalStore,
  nullifier: string,
): LocalLeafRecord | undefined {
  const norm = nullifier.toLowerCase();
  return store.leaves.find((l) => l.nullifier.toLowerCase() === norm);
}
