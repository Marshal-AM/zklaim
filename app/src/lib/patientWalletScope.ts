import { normalizeStellarAddress, tryNormalizeStellarAddress } from "./stellarAddress";

/** Normalize a Stellar G-address for storage keys and equality checks. */
export function patientWalletId(
  address: string | null | undefined,
): string | null {
  return tryNormalizeStellarAddress(address);
}

export function requirePatientWalletId(address: string | null | undefined): string {
  const id = patientWalletId(address);
  if (!id) {
    throw new Error("Connect a valid Stellar patient wallet first.");
  }
  return id;
}

/** OPFS filename scoped to a patient wallet. */
export function patientScopedOpfsKey(walletId: string, basename: string): string {
  return `patient_${walletId}_${basename}`;
}

export const PATIENT_OPFS_BASENAMES = {
  identity: "identity.json",
  inbox: "inbox.json",
  history: "history.json",
  passport: "passport.json",
} as const;

/** Legacy single-wallet filenames (pre per-wallet migration). */
export const LEGACY_PATIENT_OPFS_KEYS = {
  identity: "patient_identity.json",
  inbox: "patient_inbox.json",
  history: "patient_history.json",
  passport: "passport_store.json",
} as const;

export function providerScopedOpfsKey(walletId: string): string {
  return `provider_${walletId}_history.json`;
}

export const LEGACY_PROVIDER_HISTORY_KEY = "provider_history.json";

export function credentialStorageKey(walletId: string): string {
  return `zklaim_passport_credentials_${walletId}`;
}

export const LEGACY_CREDENTIAL_STORAGE_KEY = "zklaim_passport_credentials_v1";

/** Ensure stored identity belongs to the active wallet. */
export function identityMatchesWallet(
  identity: { stellar_address?: string } | null | undefined,
  walletId: string,
): boolean {
  if (!identity) return false;
  const stored = patientWalletId(identity.stellar_address);
  return stored === walletId;
}

export function assertIdentityWallet(
  identity: { stellar_address?: string },
  walletId: string,
): void {
  if (!identityMatchesWallet(identity, walletId)) {
    throw new Error(
      "Patient identity does not match the connected wallet. Switch wallets or complete setup for this account.",
    );
  }
}

/** Stamp canonical address on identity before persistence. */
export function withCanonicalPatientAddress<T extends { stellar_address?: string }>(
  identity: T,
  walletId: string,
): T & { stellar_address: string } {
  normalizeStellarAddress(walletId);
  return { ...identity, stellar_address: walletId };
}
