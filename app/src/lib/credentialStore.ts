import {
  credentialStorageKey,
  LEGACY_CREDENTIAL_STORAGE_KEY,
  patientWalletId,
  requirePatientWalletId,
} from "./patientWalletScope";

export interface StoredCredentialProof {
  credentialId: number;
  excludedCategory: string;
  publicInputHex: string[];
  txHash: string;
}

export interface StoredCredentialSession {
  id: string;
  patient: string;
  verifier: string;
  passportRoot: string;
  claimCount: number;
  circuitId: number;
  ttlLedgers: number;
  proofs: StoredCredentialProof[];
  createdAt: string;
}

function readRawSessions(storageKey: string): StoredCredentialSession[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    return JSON.parse(raw) as StoredCredentialSession[];
  } catch {
    return [];
  }
}

function allCredentialStorageKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("zklaim_passport_credentials_")) {
      keys.push(key);
    }
  }
  if (localStorage.getItem(LEGACY_CREDENTIAL_STORAGE_KEY)) {
    keys.push(LEGACY_CREDENTIAL_STORAGE_KEY);
  }
  return keys;
}

function readAll(walletAddress: string): StoredCredentialSession[] {
  const walletId = patientWalletId(walletAddress);
  if (!walletId) return [];
  try {
    const raw = localStorage.getItem(credentialStorageKey(walletId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredCredentialSession[];
    return parsed.filter((s) => patientWalletId(s.patient) === walletId);
  } catch {
    return [];
  }
}

function writeAll(
  walletAddress: string,
  sessions: StoredCredentialSession[],
): void {
  const walletId = requirePatientWalletId(walletAddress);
  localStorage.setItem(
    credentialStorageKey(walletId),
    JSON.stringify(sessions),
  );
}

/** Migrate legacy global credential list into the given wallet bucket. */
export function migrateLegacyCredentialSessions(walletAddress: string): void {
  const walletId = patientWalletId(walletAddress);
  if (!walletId) return;
  if (localStorage.getItem(credentialStorageKey(walletId))) return;

  try {
    const raw = localStorage.getItem(LEGACY_CREDENTIAL_STORAGE_KEY);
    if (!raw) return;
    const legacy = JSON.parse(raw) as StoredCredentialSession[];
    const owned = legacy.filter((s) => patientWalletId(s.patient) === walletId);
    if (owned.length > 0) {
      writeAll(walletId, owned);
    }
    localStorage.removeItem(LEGACY_CREDENTIAL_STORAGE_KEY);
  } catch {
    // ignore corrupt legacy data
  }
}

export function saveCredentialSession(
  walletAddress: string,
  session: Omit<StoredCredentialSession, "id" | "createdAt">,
): StoredCredentialSession {
  const walletId = requirePatientWalletId(walletAddress);
  if (patientWalletId(session.patient) !== walletId) {
    throw new Error("Credential session patient must match the active wallet.");
  }
  const entry: StoredCredentialSession = {
    ...session,
    patient: walletId,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  writeAll(walletId, [entry, ...readAll(walletId)]);
  return entry;
}

export function listCredentialSessions(
  walletAddress: string,
): StoredCredentialSession[] {
  migrateLegacyCredentialSessions(walletAddress);
  return readAll(walletAddress);
}

export function findCredentialById(
  credentialId: number,
  walletAddress?: string | null,
): { session: StoredCredentialSession; proof: StoredCredentialProof } | null {
  if (walletAddress) {
    migrateLegacyCredentialSessions(walletAddress);
    for (const session of readAll(walletAddress)) {
      const proof = session.proofs.find((p) => p.credentialId === credentialId);
      if (proof) return { session, proof };
    }
  }

  for (const key of allCredentialStorageKeys()) {
    for (const session of readRawSessions(key)) {
      const proof = session.proofs.find((p) => p.credentialId === credentialId);
      if (proof) return { session, proof };
    }
  }
  return null;
}

export function latestCredentialSession(
  walletAddress: string,
): StoredCredentialSession | null {
  const all = listCredentialSessions(walletAddress);
  return all[0] ?? null;
}
