import nacl from "tweetnacl";
import { encodeBase64, decodeBase64 } from "tweetnacl-util";

function u8(data: Uint8Array | Buffer): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

export interface ClaimTokenPayload {
  version: 1;
  patientAddress: string;
  icd_code: string;
  amount_cents: number;
  visit_date: number;
  policy_id: string;
  nonce: string;
  policy_floor_cents: number;
  policy_ceiling_cents: number;
  doctor_license_id: string;
  blinding_factor: string;
  doctor_address: string;
  doctor_signature: string;
}

export interface EncryptedClaimToken {
  version: 1;
  ephemeralPublicKey: string;
  nonce: string;
  ciphertext: string;
  cid: string;
}

export function generateBoxKeypair(): {
  publicKey: string;
  secretKey: string;
} {
  const kp = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(kp.publicKey),
    secretKey: encodeBase64(kp.secretKey),
  };
}

export function canonicalClaimPayload(payload: ClaimTokenPayload): string {
  return JSON.stringify({
    version: payload.version,
    patientAddress: payload.patientAddress,
    icd_code: payload.icd_code,
    amount_cents: payload.amount_cents,
    visit_date: payload.visit_date,
    policy_id: payload.policy_id,
    nonce: payload.nonce,
    policy_floor_cents: payload.policy_floor_cents,
    policy_ceiling_cents: payload.policy_ceiling_cents,
    doctor_license_id: payload.doctor_license_id,
    blinding_factor: payload.blinding_factor,
    doctor_address: payload.doctor_address,
  });
}

export async function computeCid(ciphertext: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(ciphertext));
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `ipfs://${hex}`;
}

export async function encryptClaimToken(
  payload: ClaimTokenPayload,
  patientBoxPublicKey: string,
): Promise<EncryptedClaimToken> {
  const patientPub = u8(decodeBase64(patientBoxPublicKey));
  const ephemeral = nacl.box.keyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const message = u8(new TextEncoder().encode(JSON.stringify(payload)));
  const ciphertext = nacl.box(
    message,
    nonce,
    patientPub,
    ephemeral.secretKey,
  );
  const cid = await computeCid(ciphertext);
  return {
    version: 1,
    ephemeralPublicKey: encodeBase64(ephemeral.publicKey),
    nonce: encodeBase64(nonce),
    ciphertext: encodeBase64(ciphertext),
    cid,
  };
}

export function decryptClaimToken(
  token: EncryptedClaimToken,
  patientBoxSecretKey: string,
): ClaimTokenPayload {
  const secretKey = u8(decodeBase64(patientBoxSecretKey));
  const ephemeralPub = u8(decodeBase64(token.ephemeralPublicKey));
  const nonce = u8(decodeBase64(token.nonce));
  const ciphertext = u8(decodeBase64(token.ciphertext));
  const keyPair = nacl.box.keyPair.fromSecretKey(secretKey);
  const opened = nacl.box.open(ciphertext, nonce, ephemeralPub, keyPair.secretKey);
  if (!opened) {
    throw new Error("Failed to decrypt claim token");
  }
  return JSON.parse(new TextDecoder().decode(opened)) as ClaimTokenPayload;
}

export function encodeTokenForUrl(token: EncryptedClaimToken): string {
  const json = JSON.stringify(token);
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeTokenFromUrl(encoded: string): EncryptedClaimToken {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const json = atob(padded + "=".repeat(padLen));
  return JSON.parse(json) as EncryptedClaimToken;
}

export function verifyDoctorSignature(payload: ClaimTokenPayload): boolean {
  return (
    payload.doctor_signature.length > 0 &&
    payload.doctor_address.length > 0
  );
}
