import { StrKey } from "@stellar/stellar-sdk";

/** Canonical G-address form for Supabase filters and directory lookups. */
export function normalizeStellarAddress(address: string): string {
  const trimmed = address.trim();
  if (!StrKey.isValidEd25519PublicKey(trimmed)) {
    throw new Error(`Invalid Stellar address: ${trimmed}`);
  }
  return StrKey.encodeEd25519PublicKey(
    StrKey.decodeEd25519PublicKey(trimmed),
  );
}

export function tryNormalizeStellarAddress(
  address: string | null | undefined,
): string | null {
  if (!address?.trim()) return null;
  try {
    return normalizeStellarAddress(address);
  } catch {
    return null;
  }
}
