import { opfsDelete, opfsReadJson, opfsWriteJson } from "./opfs";
import {
  LEGACY_PATIENT_OPFS_KEYS,
  LEGACY_PROVIDER_HISTORY_KEY,
  PATIENT_OPFS_BASENAMES,
  identityMatchesWallet,
  patientScopedOpfsKey,
  patientWalletId,
  providerScopedOpfsKey,
  withCanonicalPatientAddress,
} from "./patientWalletScope";
import type {
  PatientIdentity,
  InboxClaim,
  ClaimHistoryEntry,
} from "../types/patient";
import type { ProviderHistoryEntry } from "../store/providerStore";

export async function loadPatientIdentity(
  walletAddress: string,
): Promise<PatientIdentity | null> {
  const walletId = patientWalletId(walletAddress);
  if (!walletId) return null;
  const identity = await opfsReadJson<PatientIdentity>(
    patientScopedOpfsKey(walletId, PATIENT_OPFS_BASENAMES.identity),
  );
  if (!identity) return null;
  if (!identityMatchesWallet(identity, walletId)) return null;
  return identity;
}

export async function loadPatientInbox(walletAddress: string): Promise<InboxClaim[]> {
  const walletId = patientWalletId(walletAddress);
  if (!walletId) return [];
  return (
    (await opfsReadJson<InboxClaim[]>(
      patientScopedOpfsKey(walletId, PATIENT_OPFS_BASENAMES.inbox),
    )) ?? []
  );
}

export async function loadPatientHistory(
  walletAddress: string,
): Promise<ClaimHistoryEntry[]> {
  const walletId = patientWalletId(walletAddress);
  if (!walletId) return [];
  return (
    (await opfsReadJson<ClaimHistoryEntry[]>(
      patientScopedOpfsKey(walletId, PATIENT_OPFS_BASENAMES.history),
    )) ?? []
  );
}

export async function loadPatientPersistence(walletAddress: string): Promise<{
  identity: PatientIdentity | null;
  inbox: InboxClaim[];
  history: ClaimHistoryEntry[];
}> {
  const [identity, inbox, history] = await Promise.all([
    loadPatientIdentity(walletAddress),
    loadPatientInbox(walletAddress),
    loadPatientHistory(walletAddress),
  ]);
  return { identity, inbox, history };
}

export async function savePatientIdentity(
  identity: PatientIdentity,
  walletAddress?: string,
): Promise<void> {
  const walletId =
    patientWalletId(walletAddress) ?? patientWalletId(identity.stellar_address);
  if (!walletId) {
    throw new Error("Cannot save patient identity without a wallet address.");
  }
  const stamped = withCanonicalPatientAddress(identity, walletId);
  await opfsWriteJson(
    patientScopedOpfsKey(walletId, PATIENT_OPFS_BASENAMES.identity),
    stamped,
  );
}

export async function savePatientInbox(
  walletAddress: string,
  inbox: InboxClaim[],
): Promise<void> {
  const walletId = patientWalletId(walletAddress);
  if (!walletId) throw new Error("Invalid patient wallet address.");
  await opfsWriteJson(
    patientScopedOpfsKey(walletId, PATIENT_OPFS_BASENAMES.inbox),
    inbox,
  );
}

export async function savePatientHistory(
  walletAddress: string,
  history: ClaimHistoryEntry[],
): Promise<void> {
  const walletId = patientWalletId(walletAddress);
  if (!walletId) throw new Error("Invalid patient wallet address.");
  await opfsWriteJson(
    patientScopedOpfsKey(walletId, PATIENT_OPFS_BASENAMES.history),
    history,
  );
}

export async function loadProviderHistory(
  walletAddress: string,
): Promise<ProviderHistoryEntry[]> {
  const walletId = patientWalletId(walletAddress);
  if (!walletId) return [];
  return (
    (await opfsReadJson<ProviderHistoryEntry[]>(
      providerScopedOpfsKey(walletId),
    )) ?? []
  );
}

export async function saveProviderHistory(
  walletAddress: string,
  history: ProviderHistoryEntry[],
): Promise<void> {
  const walletId = patientWalletId(walletAddress);
  if (!walletId) throw new Error("Invalid provider wallet address.");
  await opfsWriteJson(providerScopedOpfsKey(walletId), history);
}

/** One-time migration from global OPFS files to per-wallet storage. */
export async function migrateLegacyPatientData(walletAddress: string): Promise<void> {
  const walletId = patientWalletId(walletAddress);
  if (!walletId) return;

  const scopedIdentity = await opfsReadJson<PatientIdentity>(
    patientScopedOpfsKey(walletId, PATIENT_OPFS_BASENAMES.identity),
  );
  if (scopedIdentity) return;

  const legacyIdentity = await opfsReadJson<PatientIdentity>(
    LEGACY_PATIENT_OPFS_KEYS.identity,
  );
  if (!legacyIdentity) return;

  const legacyWallet = patientWalletId(legacyIdentity.stellar_address);
  if (legacyWallet && legacyWallet !== walletId) return;

  const [legacyInbox, legacyHistory, legacyPassport] = await Promise.all([
    opfsReadJson<InboxClaim[]>(LEGACY_PATIENT_OPFS_KEYS.inbox),
    opfsReadJson<ClaimHistoryEntry[]>(LEGACY_PATIENT_OPFS_KEYS.history),
    opfsReadJson<unknown>(LEGACY_PATIENT_OPFS_KEYS.passport),
  ]);

  await savePatientIdentity(legacyIdentity, walletId);
  if (legacyInbox) {
    await savePatientInbox(walletId, legacyInbox);
  }
  if (legacyHistory) {
    await savePatientHistory(walletId, legacyHistory);
  }
  if (legacyPassport) {
    await opfsWriteJson(
      patientScopedOpfsKey(walletId, PATIENT_OPFS_BASENAMES.passport),
      legacyPassport,
    );
  }

  await Promise.all([
    opfsDelete(LEGACY_PATIENT_OPFS_KEYS.identity),
    opfsDelete(LEGACY_PATIENT_OPFS_KEYS.inbox),
    opfsDelete(LEGACY_PATIENT_OPFS_KEYS.history),
    opfsDelete(LEGACY_PATIENT_OPFS_KEYS.passport),
  ]);
}

export async function migrateLegacyProviderHistory(
  walletAddress: string,
): Promise<void> {
  const walletId = patientWalletId(walletAddress);
  if (!walletId) return;

  const scoped = await opfsReadJson<ProviderHistoryEntry[]>(
    providerScopedOpfsKey(walletId),
  );
  if (scoped && scoped.length > 0) return;

  const legacy = await opfsReadJson<ProviderHistoryEntry[]>(
    LEGACY_PROVIDER_HISTORY_KEY,
  );
  if (!legacy || legacy.length === 0) return;

  await saveProviderHistory(walletId, legacy);
  await opfsDelete(LEGACY_PROVIDER_HISTORY_KEY);
}
