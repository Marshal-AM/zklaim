import {
  decodeTokenFromUrl,
  type EncryptedClaimToken,
} from "./claimToken";

/** Parse pasted audit input: JSON token or `?claim=` deep-link URL. */
export function parseClaimTokenInput(raw: string): EncryptedClaimToken {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Paste an encrypted claim token or deep link.");
  }

  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed) as EncryptedClaimToken;
    if (
      parsed.version !== 1 ||
      !parsed.ciphertext ||
      !parsed.ephemeralPublicKey ||
      !parsed.nonce
    ) {
      throw new Error("Invalid encrypted claim token JSON.");
    }
    return parsed;
  }

  let claimParam: string | null = null;
  try {
    if (trimmed.includes("claim=")) {
      const url = trimmed.startsWith("http")
        ? new URL(trimmed)
        : new URL(trimmed, "https://zklaim.local/");
      claimParam = url.searchParams.get("claim");
    } else {
      claimParam = trimmed;
    }
  } catch {
    claimParam = trimmed;
  }

  if (!claimParam) {
    throw new Error("Could not find claim= parameter in URL.");
  }

  return decodeTokenFromUrl(claimParam);
}
