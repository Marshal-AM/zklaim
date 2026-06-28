import { opfsReadJson, opfsWriteJson } from "./opfs";
import type { LocalLeafRecord, PassportLocalStore } from "./passport";

const PASSPORT_KEY = "passport_store.json";
const STORE_VERSION = 1;

export async function loadPassportStore(): Promise<PassportLocalStore | null> {
  return opfsReadJson<PassportLocalStore>(PASSPORT_KEY);
}

export async function savePassportStore(store: PassportLocalStore): Promise<void> {
  await opfsWriteJson(PASSPORT_KEY, store);
}

export function createEmptyPassportStore(patientPubkey: string): PassportLocalStore {
  return {
    version: STORE_VERSION,
    patient_pubkey: patientPubkey,
    leaves: [],
  };
}

export async function ensurePassportStore(
  patientPubkey: string,
): Promise<PassportLocalStore> {
  const existing = await loadPassportStore();
  if (existing) return existing;
  const created = createEmptyPassportStore(patientPubkey);
  await savePassportStore(created);
  return created;
}

export async function appendLocalLeaf(
  record: LocalLeafRecord,
  onChainRoot?: string,
): Promise<PassportLocalStore> {
  const store =
    (await loadPassportStore()) ??
    createEmptyPassportStore(record.nullifier.slice(0, 8));
  const next: PassportLocalStore = {
    ...store,
    leaves: [...store.leaves, record],
    on_chain_root: onChainRoot ?? store.on_chain_root,
  };
  await savePassportStore(next);
  return next;
}

export function findLeafByNullifier(
  store: PassportLocalStore,
  nullifier: string,
): LocalLeafRecord | undefined {
  const norm = nullifier.toLowerCase();
  return store.leaves.find((l) => l.nullifier.toLowerCase() === norm);
}
