const STORAGE_KEY = "zklaim_passport_credentials_v1";

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

function readAll(): StoredCredentialSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredCredentialSession[];
  } catch {
    return [];
  }
}

function writeAll(sessions: StoredCredentialSession[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function saveCredentialSession(
  session: Omit<StoredCredentialSession, "id" | "createdAt">,
): StoredCredentialSession {
  const entry: StoredCredentialSession = {
    ...session,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  writeAll([entry, ...readAll()]);
  return entry;
}

export function listCredentialSessions(): StoredCredentialSession[] {
  return readAll();
}

export function findCredentialById(
  credentialId: number,
): { session: StoredCredentialSession; proof: StoredCredentialProof } | null {
  for (const session of readAll()) {
    const proof = session.proofs.find((p) => p.credentialId === credentialId);
    if (proof) return { session, proof };
  }
  return null;
}

export function latestCredentialSession(): StoredCredentialSession | null {
  const all = readAll();
  return all[0] ?? null;
}
